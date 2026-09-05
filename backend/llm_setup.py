import os
from langchain_groq import ChatGroq


def get_parsing_llm():
    api_key = os.getenv("GROQ_API_KEY_1")
    if not api_key:
        raise ValueError("GROQ_API_KEY_1 is not set.")

    llm = ChatGroq(
        model="openai/gpt-oss-120b",
        api_key=api_key,
        temperature=0,
        model_kwargs={"response_format": {"type": "json_object"}}
    )

    return llm.with_retry(stop_after_attempt=3, wait_exponential_jitter=True)


def get_generation_llm():
    api_key = os.getenv("GROQ_API_KEY_2")
    if not api_key:
        raise ValueError("GROQ_API_KEY_2 is not set.")

    llm = ChatGroq(
        model="openai/gpt-oss-20b",
        api_key=api_key,
        temperature=0.2,
        model_kwargs={"response_format": {"type": "json_object"}}
    )

    return llm.with_retry(stop_after_attempt=3, wait_exponential_jitter=True)
