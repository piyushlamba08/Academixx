import os
import re
import json
import math
import operator
from typing import TypedDict, List, Annotated

from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langgraph.graph import StateGraph, START, END

from schemas import MockQuestionList

load_dotenv()

# ─────────────────────────────────────────────
# STATE
# ─────────────────────────────────────────────

class GraphState(TypedDict):
    raw_text: str
    chunks: List[str]
    to_generate: int
    mock_questions: Annotated[List[dict], operator.add]


# ─────────────────────────────────────────────
# NODE 1 — SMART NODE (pure Python, no LLM)
# ─────────────────────────────────────────────

def group_lines_into_questions(lines: List[str]) -> List[str]:
    questions = []
    buffer: List[str] = []

    def has_all_options(buf_lines: List[str]) -> bool:
        text = " ".join(buf_lines).lower()
        return all(f"({opt})" in text for opt in ("a", "b", "c", "d"))

    for line in lines:
        buffer.append(line)
        if has_all_options(buffer):
            questions.append("\n".join(buffer))
            buffer = []

    if buffer:
        leftover_text = " ".join(buffer).lower()
        marker_count = sum(1 for opt in ("a", "b", "c", "d") if f"({opt})" in leftover_text)
        if marker_count >= 2:
            questions.append("\n".join(buffer))
        else:
            print(f"[Smart Node] {len(buffer)} trailing line(s) discard kiye (noise)")

    return questions


def split_into_n_chunks(items: List[str], n: int) -> List[str]:
    if not items:
        return ["" for _ in range(n)]

    k, m = divmod(len(items), n)
    groups = []
    idx = 0
    for i in range(n):
        size = k + (1 if i < m else 0)
        group = items[idx:idx + size]
        idx += size
        if group:
            groups.append("\n\n".join(group))
        else:
            groups.append(groups[-1] if groups else "")
    return groups


def node_smart(state: GraphState) -> dict:
    raw_text = state["raw_text"]
    print(f"[Smart Node] START — raw_text length: {len(raw_text)} chars")

    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
    question_lines = group_lines_into_questions(lines)

    if not question_lines:
        print("[Smart Node] ⚠️ No (a)(b)(c)(d) pattern found — using all lines as fallback")
        question_lines = lines

    total_questions = len(question_lines)
    chunks = split_into_n_chunks(question_lines, 4)
    to_generate = max(1, math.floor(total_questions * 0.4 / 4))

    chunk_sizes = [len(c.split("\n\n")) if c else 0 for c in chunks]
    print(f"[Smart Node] DONE ✅ — total: {total_questions}, per node: {to_generate}, per chunk: {chunk_sizes}")

    for i, chunk in enumerate(chunks, 1):
        print(f"\n[Smart Node] ── CHUNK {i} ──────────────────────────────")
        print(chunk)
        print(f"[Smart Node] ── END CHUNK {i} ──────────────────────────\n")

    return {"chunks": chunks, "to_generate": to_generate}


# ─────────────────────────────────────────────
# GENERATOR HELPER
# ─────────────────────────────────────────────
# Root cause: complex reasoning questions (coding-decoding jaise) mein
# har question ka JSON lamba hota hai — options bhi encoded strings hote
# hain. Salvage logic safety net hai — agar poora JSON kabhi truncate ho
# jaaye, toh jo COMPLETE {question, options, answer} objects bane hain
# unhe bacha lete hain, sirf adhura wala discard hota hai.

def salvage_questions(raw_text: str) -> List[dict]:
    """Truncated/invalid JSON se bhi complete question-objects nikal leta hai."""
    pattern = re.compile(
        r'\{\s*"question"\s*:\s*"(?:[^"\\]|\\.)*"\s*,\s*"options"\s*:\s*\[(?:[^\[\]]*)\]\s*,\s*"answer"\s*:\s*"(?:[^"\\]|\\.)*"\s*\}',
        re.DOTALL
    )
    valid = []
    for match in pattern.finditer(raw_text):
        try:
            obj = json.loads(match.group(0))
            if is_valid_generated_question(obj):
                valid.append({"question": obj["question"], "options": obj["options"], "answer": obj["answer"]})
        except Exception:
            continue
    return valid


def is_valid_generated_question(question: dict) -> bool:
    """Reject incomplete AI output before it reaches the scoring UI."""
    answer = str(question.get("answer", "")).strip()
    options = question.get("options", [])
    invalid_answers = {"", "undefined", "null", "none", "n/a", "na"}
    return (
        isinstance(options, list)
        and len(options) == 4
        and answer.lower() not in invalid_answers
        and answer in [str(option).strip() for option in options]
    )


def run_generator(chunk: str, to_generate: int, api_key: str, name: str) -> List[dict]:
    print(f"[{name}] START — chunk: {len(chunk)} chars, to_generate: {to_generate}")

    model = ChatGroq(
        model="openai/gpt-oss-120b",
        temperature=0.4,
        api_key=api_key
        # max_tokens jaan bujh kar set nahi kiya — pehle 4096/8192 cap
        # lagayi thi jo khud hi truncation ki wajah ban rahi thi. Ab Groq
        # apni model default limit use karega. Salvage logic safety net
        # ke roop mein rahega agar phir bhi kabhi truncate ho.
    )
    parser = PydanticOutputParser(pydantic_object=MockQuestionList)
    prompt = PromptTemplate(
        template=(
            "You are an expert test creator for competitive exams like SSC and IBPS.\n"
            "Generate exactly {to_generate} NEW MCQ questions based on the same concept as the practice questions below.\n"
            "Rules:\n"
            "- Use different numbers, words, or scenarios — but keep the same concept.\n"
            "- Every question MUST have exactly 4 options.\n"
            "- answer MUST exactly match one of the 4 options word for word.\n"
            "- Calculate and verify the answer before responding. Never use undefined, null, N/A, or an option label as the answer.\n"
            "- Do NOT include any explanation, solution steps, or hints inside the question.\n"
            "- Only provide the question stem and 4 options. Nothing else.\n"
            "- Keep every question and option short and concise — no long sentences.\n\n"
            "{format_instructions}\n\n"
            "Practice Questions:\n{chunk}"
        ),
        input_variables=["chunk", "to_generate"],
        partial_variables={"format_instructions": parser.get_format_instructions()}
    )

    # Parser ko chain se alag rakha — taaki raw response text access kar sakein
    # (salvage ke liye zaroori hai, warna truncated JSON par LangChain khud
    # exception raise karke raw text discard kar deta hai)
    chain = prompt | model

    for attempt in (1, 2):
        raw_content = ""
        try:
            ai_message = chain.invoke({"chunk": chunk, "to_generate": to_generate})
            raw_content = ai_message.content

            result = parser.parse(raw_content)
            valid = [{"question": q.question, "options": q.options, "answer": q.answer}
                     for q in result.questions if is_valid_generated_question(q.model_dump())]
            print(f"[{name}] DONE ✅ — {len(valid)} valid (raw: {len(result.questions)})")
            return valid

        except Exception as e:
            print(f"[{name}] ⚠️ Attempt {attempt} parse FAILED — {type(e).__name__}: {e}")

            # Salvage try karo — jo bhi complete questions bane hain unhe bacha lo
            salvaged = salvage_questions(raw_content) if raw_content else []
            if salvaged:
                print(f"[{name}] 🩹 Salvaged {len(salvaged)} complete question(s) from truncated response")
                return salvaged

            if attempt == 2:
                print(f"[{name}] ❌ Giving up after 2 attempts, 0 questions")
                return []
            print(f"[{name}] 🔁 Retrying once...")


# ─────────────────────────────────────────────
# NODES 2-5 — PARALLEL GENERATORS
# ─────────────────────────────────────────────

def node_generator_1(state: GraphState) -> dict:
    return {"mock_questions": run_generator(state["chunks"][0], state["to_generate"], os.getenv("GROQ_API_KEY_1"), "Generator 1")}

def node_generator_2(state: GraphState) -> dict:
    return {"mock_questions": run_generator(state["chunks"][1], state["to_generate"], os.getenv("GROQ_API_KEY_2"), "Generator 2")}

def node_generator_3(state: GraphState) -> dict:
    return {"mock_questions": run_generator(state["chunks"][2], state["to_generate"], os.getenv("GROQ_API_KEY_3"), "Generator 3")}

def node_generator_4(state: GraphState) -> dict:
    return {"mock_questions": run_generator(state["chunks"][3], state["to_generate"], os.getenv("GROQ_API_KEY_4"), "Generator 4")}


# ─────────────────────────────────────────────
# BUILD GRAPH
# ─────────────────────────────────────────────

graph = StateGraph(GraphState)

graph.add_node("smart", node_smart)
graph.add_node("generator_1", node_generator_1)
graph.add_node("generator_2", node_generator_2)
graph.add_node("generator_3", node_generator_3)
graph.add_node("generator_4", node_generator_4)

graph.add_edge(START, "smart")
graph.add_edge("smart", "generator_1")
graph.add_edge("smart", "generator_2")
graph.add_edge("smart", "generator_3")
graph.add_edge("smart", "generator_4")
graph.add_edge("generator_1", END)
graph.add_edge("generator_2", END)
graph.add_edge("generator_3", END)
graph.add_edge("generator_4", END)

agent = graph.compile()


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────

def run_mock_pipeline(raw_text: str) -> dict:
    print(f"[Pipeline] START — input text: {len(raw_text)} chars")

    result = agent.invoke({
        "raw_text": raw_text,
        "chunks": [],
        "to_generate": 0,
        "mock_questions": []
    })

    questions = result.get("mock_questions", [])
    print(f"[Pipeline] COMPLETE ✅ — {len(questions)} total questions")
    return {"questions": questions}
