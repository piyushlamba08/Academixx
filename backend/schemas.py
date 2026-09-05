from pydantic import BaseModel, Field
from typing import List, Optional


# ── Smart Node Output ─────────────────────────

class SmartPlan(BaseModel):
    total_questions: int = Field(description="Total number of questions counted in the text")
    chunks: List[str] = Field(description="Exactly 4 equal parts of the input text")


# ── Generator Node Output ─────────────────────

class MockQuestion(BaseModel):
    question: str = Field(description="The new question text")
    options: List[str] = Field(description="Exactly 4 answer options")
    answer: str = Field(description="Must exactly match one of the 4 options")


class MockQuestionList(BaseModel):
    questions: List[MockQuestion] = Field(description="List of generated mock questions")


# ── Practice Endpoints (Addition, Square, Cube, etc.) ──

class PracticeRequest(BaseModel):
    digits: int = 2
    terms: int = 2
    count: int = 20
    allow_decimals: bool = False
    table_from: int = 2
    table_to: int = 12
    multiplier_from: int = 1
    multiplier_to: int = 12


class PracticeQuestion(BaseModel):
    question: str
    correctAnswer: str
    options: List[str] = []


class PracticeResponse(BaseModel):
    questions: List[PracticeQuestion]


# ── Progress Tracking (SQLite-backed, replaces frontend localStorage) ──

class TestQuestionIn(BaseModel):
    question: str
    options: List[str] = []
    correctAnswer: str
    userAnswer: Optional[str] = None
    isCorrect: bool = False
    timeSpentSeconds: int = 0


class TestIn(BaseModel):
    topic: Optional[str] = None
    sourceName: Optional[str] = None
    durationSeconds: int = 0
    score: float = 0
    correctCount: int = 0
    wrongCount: int = 0
    skippedCount: int = 0
    questions: List[TestQuestionIn]


class TestQuestionOut(BaseModel):
    number: int
    question: str
    options: List[str]
    correctAnswer: str
    userAnswer: Optional[str] = None
    result: str
    timeSpentSeconds: int


class TestOut(BaseModel):
    id: str
    completedAt: str
    topic: Optional[str] = None
    sourceName: Optional[str] = None
    durationSeconds: int
    score: float
    correctCount: int
    wrongCount: int
    skippedCount: int
    total: int
    questions: List[TestQuestionOut]


class MistakeOut(BaseModel):
    key: str
    question: str
    options: List[str]
    correctAnswer: str
    topic: Optional[str] = None
    timesSeen: int
    timesWrong: int
    timesSkipped: int
    timesCorrect: int
    lastResult: str
    active: bool


class TopicsOut(BaseModel):
    topics: List[str]


class StreakOut(BaseModel):
    bestStreak: int


class StreakIn(BaseModel):
    candidate: int


class ShortcutRequest(BaseModel):
    question: str
    options: List[str] = []
    correct_answer: str
    user_answer: Optional[str] = None
    topic: Optional[str] = None


class ShortcutResponse(BaseModel):
    trick_title: str
    topper_shortcut: str
    traditional_vs_shortcut: Optional[str] = None
    key_takeaway: str
    target_time_seconds: int = 15
