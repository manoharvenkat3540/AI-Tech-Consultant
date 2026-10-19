import json
import sqlite3
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[2]
DATABASE_PATH = PROJECT_DIR / "knowledge.db"


def get_connection():
    """Create a connection to the SQLite knowledge database."""
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    """Create the articles table if it doesn't exist."""
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS articles (
                url TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                images_json TEXT NOT NULL DEFAULT '[]',
                content_hash TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)


def save_article(article):
    """Save a crawled support article or update an existing one."""
    with get_connection() as connection:
        connection.execute("""
            INSERT INTO articles (
                url, title, content, images_json, updated_at
            )
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(url) DO UPDATE SET
                title = excluded.title,
                content = excluded.content,
                images_json = excluded.images_json,
                updated_at = CURRENT_TIMESTAMP
        """, (
            article.url,
            article.title or "Untitled",
            article.content or "",
            json.dumps(article.images or []),
        ))


def get_article_count():
    """Return the number of articles stored."""
    initialize_database()

    with get_connection() as connection:
        row = connection.execute(
            "SELECT COUNT(*) FROM articles"
        ).fetchone()

        return row[0]
    