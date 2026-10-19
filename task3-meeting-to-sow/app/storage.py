import json
import sqlite3
from pathlib import Path
from typing import Any

DATABASE_PATH = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "meetings.db"
)


def get_connection() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS proposals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_name TEXT NOT NULL,
                project_name TEXT NOT NULL,
                transcript TEXT NOT NULL,
                analysis_json TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS scope_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proposal_id INTEGER NOT NULL,
                original_scope TEXT NOT NULL,
                follow_up_transcript TEXT NOT NULL,
                analysis_json TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (proposal_id) REFERENCES proposals(id)
            )
            """
        )


def save_proposal(
    client_name: str,
    project_name: str,
    transcript: str,
    analysis: dict[str, Any],
) -> int:
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO proposals (
                client_name,
                project_name,
                transcript,
                analysis_json
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                client_name,
                project_name,
                transcript,
                json.dumps(analysis, ensure_ascii=False),
            ),
        )

        return int(cursor.lastrowid)


def get_proposal(proposal_id: int) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT *
            FROM proposals
            WHERE id = ?
            """,
            (proposal_id,),
        ).fetchone()

    if row is None:
        return None

    result = dict(row)
    result["analysis"] = json.loads(result.pop("analysis_json"))
    return result


def list_proposals() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, client_name, project_name,
                   status, created_at, updated_at
            FROM proposals
            ORDER BY id DESC
            """
        ).fetchall()

    return [dict(row) for row in rows]


def update_proposal_status(
    proposal_id: int,
    status: str,
) -> bool:
    if status not in {"approved", "rejected"}:
        raise ValueError("Status must be approved or rejected.")

    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE proposals
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'pending'
            """,
            (status, proposal_id),
        )

        return cursor.rowcount > 0


def save_scope_change(
    proposal_id: int,
    original_scope: str,
    follow_up_transcript: str,
    analysis: dict[str, Any],
) -> int:
    with get_connection() as connection:
        proposal = connection.execute(
            "SELECT id FROM proposals WHERE id = ?",
            (proposal_id,),
        ).fetchone()

        if proposal is None:
            raise ValueError("The original proposal does not exist.")

        cursor = connection.execute(
            """
            INSERT INTO scope_changes (
                proposal_id,
                original_scope,
                follow_up_transcript,
                analysis_json
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                proposal_id,
                original_scope,
                follow_up_transcript,
                json.dumps(analysis, ensure_ascii=False),
            ),
        )

        return int(cursor.lastrowid)


def get_scope_change(
    scope_change_id: int,
) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT *
            FROM scope_changes
            WHERE id = ?
            """,
            (scope_change_id,),
        ).fetchone()

    if row is None:
        return None

    result = dict(row)
    result["analysis"] = json.loads(result.pop("analysis_json"))
    return result


initialize_database()