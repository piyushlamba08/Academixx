import uuid

from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database import Base


class Test(Base):
    __tablename__ = "tests"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    completed_at = Column(String, nullable=False)
    topic = Column(String, nullable=True)
    source_name = Column(String, nullable=True)
    duration_seconds = Column(Integer, default=0)
    score = Column(Float, default=0)
    correct_count = Column(Integer, default=0)
    wrong_count = Column(Integer, default=0)
    skipped_count = Column(Integer, default=0)
    total = Column(Integer, default=0)

    questions = relationship(
        "TestQuestion",
        back_populates="test",
        cascade="all, delete-orphan",
        order_by="TestQuestion.number",
    )


class TestQuestion(Base):
    __tablename__ = "test_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    test_id = Column(String, ForeignKey("tests.id"), nullable=False)
    number = Column(Integer, nullable=False)
    question = Column(Text, nullable=False)
    options = Column(Text, default="[]")  # JSON-encoded list of strings
    correct_answer = Column(String, nullable=False)
    user_answer = Column(String, nullable=True)
    result = Column(String, nullable=False)  # correct | wrong | skipped
    time_spent_seconds = Column(Integer, default=0)

    test = relationship("Test", back_populates="questions")


class Mistake(Base):
    __tablename__ = "mistakes"

    key = Column(String, primary_key=True)
    question = Column(Text, nullable=False)
    options = Column(Text, default="[]")
    correct_answer = Column(String, nullable=False)
    topic = Column(String, nullable=True)
    first_mistake_at = Column(String, nullable=False)
    last_attempted_at = Column(String, nullable=False)
    times_seen = Column(Integer, default=0)
    times_wrong = Column(Integer, default=0)
    times_skipped = Column(Integer, default=0)
    times_correct = Column(Integer, default=0)
    last_result = Column(String, nullable=False)
    active = Column(Boolean, default=True)


class StreakRecord(Base):
    __tablename__ = "streak"

    id = Column(Integer, primary_key=True)
    best_streak = Column(Integer, default=0)
