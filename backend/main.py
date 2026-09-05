import json
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import Depends, FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlalchemy import distinct
from sqlalchemy.orm import Session

from file_extractor import extract_text_from_file
from graph import run_mock_pipeline
from schemas import (
    PracticeRequest, PracticeResponse,
    TestIn, TestOut, TestQuestionOut, MistakeOut, TopicsOut, StreakOut, StreakIn,
    ShortcutRequest, ShortcutResponse,
)
import practice_generator
import models as db_models
from database import Base, engine, get_db

load_dotenv()

app = FastAPI(title="Mock Test API")

# Creates progress.db and all tables on first run — safe to call every startup.
Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = (".pdf", ".docx")


@app.post("/api/process-pdf")
async def process_file(file: UploadFile = File(...)):
    filename = file.filename.lower()

    if not any(filename.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

    print(f"[API] Received file: {file.filename}")

    try:
        file_bytes = await file.read()
        print(f"[API] File read OK — {len(file_bytes)} bytes")

        if len(file_bytes) > 10 * 1024 * 1024:
            print("[API] ❌ REJECTED — file too large")
            raise HTTPException(status_code=400, detail="File too large — max 10MB supported.")

        # Step 1: Extract Text
        print("[API] STEP 1/2 — Extracting text from file...")
        try:
            raw_text = extract_text_from_file(file_bytes, file.filename)
            print(f"[API] STEP 1/2 DONE ✅ — extracted {len(raw_text)} chars")
        except ValueError as e:
            print(f"[API] ❌ STEP 1/2 FAILED (text extraction) — {e}")
            raise HTTPException(status_code=400, detail=str(e))

        # Step 2: LangGraph pipeline
        print("[API] STEP 2/2 — Running LangGraph mock-question pipeline...")
        try:
            final_mock = run_mock_pipeline(raw_text)
            print(f"[API] STEP 2/2 DONE ✅ — {len(final_mock.get('questions', []))} questions")
        except Exception as e:
            print(f"[API] ❌ STEP 2/2 FAILED (pipeline) — {type(e).__name__}: {e}")
            raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")

        valid_questions = []
        invalid_answers = {"", "undefined", "null", "none", "n/a", "na"}
        for question in final_mock.get("questions", []):
            answer = str(question.get("answer", "")).strip()
            options = [str(option).strip() for option in question.get("options", [])]
            if len(options) == 4 and answer.lower() not in invalid_answers and answer in options:
                valid_questions.append({
                    "question": question.get("question", ""),
                    "options": options,
                    "correctAnswer": answer,
                })

        if not valid_questions:
            print("[API] ❌ No questions in final result")
            raise HTTPException(status_code=500, detail="No questions generated. Please try again.")

        print("[API] ✅ Request complete, returning response")
        return {"questions": valid_questions}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] ❌ UNEXPECTED ERROR — {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


# ──────────────────────────────────────────────────────────
# PRACTICE ENDPOINTS — one dedicated route per topic, matching /api/process-pdf's
# pattern. Each is a thin wrapper around practice_generator.generate_practice_set;
# behaviour is identical to what random-math.js used to generate in the browser.
# ──────────────────────────────────────────────────────────

def _generate_practice(topic: str, req: PracticeRequest) -> PracticeResponse:
    print(f"[Practice:{topic}] Received request — count={req.count}, digits={req.digits}, terms={req.terms}")
    try:
        questions = practice_generator.generate_practice_set(topic, req)
        print(f"[Practice:{topic}] DONE ✅ — {len(questions)} questions")
        return PracticeResponse(questions=questions)
    except Exception as e:
        print(f"[Practice:{topic}] ❌ FAILED — {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate {topic} questions: {e}")


@app.post("/api/practice/addition", response_model=PracticeResponse)
async def practice_addition(req: PracticeRequest):
    return _generate_practice("addition", req)


@app.post("/api/practice/subtraction", response_model=PracticeResponse)
async def practice_subtraction(req: PracticeRequest):
    return _generate_practice("subtraction", req)


@app.post("/api/practice/multiplication", response_model=PracticeResponse)
async def practice_multiplication(req: PracticeRequest):
    return _generate_practice("multiplication", req)


@app.post("/api/practice/division", response_model=PracticeResponse)
async def practice_division(req: PracticeRequest):
    return _generate_practice("division", req)


@app.post("/api/practice/square", response_model=PracticeResponse)
async def practice_square(req: PracticeRequest):
    return _generate_practice("square", req)


@app.post("/api/practice/cube", response_model=PracticeResponse)
async def practice_cube(req: PracticeRequest):
    return _generate_practice("cube", req)


@app.post("/api/practice/square-root", response_model=PracticeResponse)
async def practice_square_root(req: PracticeRequest):
    return _generate_practice("square-root", req)


@app.post("/api/practice/tables", response_model=PracticeResponse)
async def practice_tables(req: PracticeRequest):
    return _generate_practice("tables", req)


# ── Progress Endpoints ──

@app.post("/api/progress/tests", response_model=TestOut)
def save_test(test_in: TestIn, db: Session = Depends(get_db)):
    completed_at = datetime.now(timezone.utc).isoformat()
    test_id = str(uuid.uuid4())
    
    test_db = db_models.Test(
        id=test_id,
        completed_at=completed_at,
        topic=test_in.topic,
        source_name=test_in.sourceName,
        duration_seconds=test_in.durationSeconds,
        score=test_in.score,
        correct_count=test_in.correctCount,
        wrong_count=test_in.wrongCount,
        skipped_count=test_in.skippedCount,
        total=len(test_in.questions)
    )
    db.add(test_db)
    
    for i, q in enumerate(test_in.questions):
        result = "correct" if q.isCorrect else ("wrong" if q.userAnswer else "skipped")
        tq = db_models.TestQuestion(
            test_id=test_id,
            number=i + 1,
            question=q.question,
            options=json.dumps(q.options) if q.options else "[]",
            correct_answer=q.correctAnswer,
            user_answer=q.userAnswer,
            result=result,
            time_spent_seconds=q.timeSpentSeconds
        )
        db.add(tq)
        
        # Mistake Logic
        key = f"{q.question}|{q.correctAnswer}".lower()
        existing = db.query(db_models.Mistake).filter(db_models.Mistake.key == key).first()
        
        if result in ("wrong", "skipped"):
            if existing:
                existing.last_attempted_at = completed_at
                existing.times_seen += 1
                if result == "wrong":
                    existing.times_wrong += 1
                elif result == "skipped":
                    existing.times_skipped += 1
                existing.last_result = result
                existing.active = True
            else:
                new_mistake = db_models.Mistake(
                    key=key,
                    question=q.question,
                    options=json.dumps(q.options) if q.options else "[]",
                    correct_answer=q.correctAnswer,
                    topic=test_in.topic,
                    first_mistake_at=completed_at,
                    last_attempted_at=completed_at,
                    times_seen=1,
                    times_wrong=1 if result == "wrong" else 0,
                    times_skipped=1 if result == "skipped" else 0,
                    times_correct=0,
                    last_result=result,
                    active=True
                )
                db.add(new_mistake)
        else:
            if existing:
                existing.last_attempted_at = completed_at
                existing.times_seen += 1
                existing.times_correct += 1
                existing.last_result = "correct"
                existing.active = False
                
    db.commit()
    db.refresh(test_db)
    
    questions_out = [
        TestQuestionOut(
            number=tq.number,
            question=tq.question,
            options=json.loads(tq.options),
            correctAnswer=tq.correct_answer,
            userAnswer=tq.user_answer,
            result=tq.result,
            timeSpentSeconds=tq.time_spent_seconds
        ) for tq in test_db.questions
    ]
    return TestOut(
        id=test_db.id,
        completedAt=test_db.completed_at,
        topic=test_db.topic,
        sourceName=test_db.source_name,
        durationSeconds=test_db.duration_seconds,
        score=test_db.score,
        correctCount=test_db.correct_count,
        wrongCount=test_db.wrong_count,
        skippedCount=test_db.skipped_count,
        total=test_db.total,
        questions=questions_out
    )


@app.get("/api/progress/tests", response_model=List[TestOut])
def get_tests(db: Session = Depends(get_db)):
    tests = db.query(db_models.Test).order_by(db_models.Test.completed_at.desc()).all()
    res = []
    for t in tests:
        questions_out = [
            TestQuestionOut(
                number=tq.number,
                question=tq.question,
                options=json.loads(tq.options),
                correctAnswer=tq.correct_answer,
                userAnswer=tq.user_answer,
                result=tq.result,
                timeSpentSeconds=tq.time_spent_seconds
            ) for tq in t.questions
        ]
        res.append(TestOut(
            id=t.id,
            completedAt=t.completed_at,
            topic=t.topic,
            sourceName=t.source_name,
            durationSeconds=t.duration_seconds,
            score=t.score,
            correctCount=t.correct_count,
            wrongCount=t.wrong_count,
            skippedCount=t.skipped_count,
            total=t.total,
            questions=questions_out
        ))
    return res


@app.get("/api/progress/mistakes", response_model=List[MistakeOut])
def get_mistakes(topic: str = "all", activeOnly: str = "true", db: Session = Depends(get_db)):
    query = db.query(db_models.Mistake)
    if topic != "all":
        query = query.filter(db_models.Mistake.topic == topic)
    if activeOnly.lower() == "true":
        query = query.filter(db_models.Mistake.active == True)
    
    mistakes = query.order_by(db_models.Mistake.last_attempted_at.desc()).all()
    return [MistakeOut(
        key=m.key,
        question=m.question,
        options=json.loads(m.options),
        correctAnswer=m.correct_answer,
        topic=m.topic,
        timesSeen=m.times_seen,
        timesWrong=m.times_wrong,
        timesSkipped=m.times_skipped,
        timesCorrect=m.times_correct,
        lastResult=m.last_result,
        active=m.active
    ) for m in mistakes]


@app.get("/api/progress/topics", response_model=List[str])
def get_topics(db: Session = Depends(get_db)):
    test_topics = db.query(distinct(db_models.Test.topic)).filter(db_models.Test.topic.isnot(None)).all()
    mistake_topics = db.query(distinct(db_models.Mistake.topic)).filter(db_models.Mistake.topic.isnot(None)).all()
    topics = set([t[0] for t in test_topics if t[0]] + [m[0] for m in mistake_topics if m[0]])
    return sorted(list(topics))


@app.get("/api/progress/streak", response_model=StreakOut)
def get_streak(db: Session = Depends(get_db)):
    streak = db.query(db_models.StreakRecord).first()
    return StreakOut(bestStreak=streak.best_streak if streak else 0)


@app.post("/api/progress/streak", response_model=StreakOut)
def update_streak(streak_in: StreakIn, db: Session = Depends(get_db)):
    streak = db.query(db_models.StreakRecord).first()
    if not streak:
        streak = db_models.StreakRecord(best_streak=streak_in.candidate)
        db.add(streak)
    elif streak_in.candidate > streak.best_streak:
        streak.best_streak = streak_in.candidate
    db.commit()
    db.refresh(streak)
    return StreakOut(bestStreak=streak.best_streak)


# ── AI Topper Shortcut Trick ──

@app.post("/api/ai/shortcut-trick", response_model=ShortcutResponse)
async def generate_shortcut_trick(req: ShortcutRequest):
    try:
        from llm_setup import get_generation_llm
        llm = get_generation_llm()
        
        prompt = f"""You are an elite competitive exam coach (All India Rank 1 trainer for Quant/Aptitude).
Analyze this question and provide the fastest, smartest "10-Second Topper's Shortcut Trick" (e.g. Unit Digit, Digital Root, Vedic Math, Elimination, or Approximation).

Question: {req.question}
Options: {', '.join(req.options) if req.options else 'N/A'}
Correct Answer: {req.correct_answer}
User's Attempt: {req.user_answer or 'Skipped/Wrong'}
Topic: {req.topic or 'Quantitative Aptitude'}

Return a JSON object matching this schema EXACTLY:
{{
    "trick_title": "Short catchy name for the trick (e.g., ⚡ 10-Second Digital Sum & Option Elimination)",
    "topper_shortcut": "Clear step-by-step 2-3 sentence explanation of the ultra-fast trick that solves this in under 15 seconds.",
    "traditional_vs_shortcut": "Why traditional school formula wastes 60s vs how this shortcut saves time.",
    "key_takeaway": "One golden rule to remember for future similar questions.",
    "target_time_seconds": 15
}}
"""
        response = await llm.ainvoke(prompt)
        data = json.loads(response.content)
        return ShortcutResponse(
            trick_title=data.get("trick_title", "⚡ Speed Elimination Shortcut"),
            topper_shortcut=data.get("topper_shortcut", "Use unit digit verification and option elimination to find the answer instantly."),
            traditional_vs_shortcut=data.get("traditional_vs_shortcut", "Standard algebraic steps take 45-60s; direct substitution takes < 15s."),
            key_takeaway=data.get("key_takeaway", "Always check the last digits of options before doing full calculation."),
            target_time_seconds=int(data.get("target_time_seconds", 15))
        )
    except Exception as e:
        print(f"[AI Shortcut Error]: {e}")
        return ShortcutResponse(
            trick_title="⚡ Smart Mental Math Shortcut",
            topper_shortcut=f"For '{req.question}', examine the last digit of the numbers first. Match the unit digit with the options to eliminate 3 choices instantly without computing the full equation.",
            traditional_vs_shortcut="Long multiplication/division takes 40s+, whereas Unit Digit and Digital Sum take under 10 seconds.",
            key_takeaway="Check options first: if unit digits are distinct, calculation is never required!",
            target_time_seconds=12
        )
