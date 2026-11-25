import os
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool

# PostgreSQL via Supabase Session Pooler (IPv4 compatible) — set DATABASE_URL in Render
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    # Fallback to SQLite for local development
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "progress.db")
    DATABASE_URL = f"sqlite:///{DB_PATH}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # SQLAlchemy 2.1+ defaults postgresql:// to psycopg (v3); force psycopg2-binary explicitly
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
    # NullPool recommended for Supabase Supavisor pooler
    engine = create_engine(DATABASE_URL, poolclass=NullPool)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
