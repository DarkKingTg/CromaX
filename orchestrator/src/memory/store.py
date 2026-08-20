# orchestrator/src/memory/store.py
#
# SQLite FTS5 cross-session memory store, ported from Hermes Agent (NousResearch/hermes-agent, MIT).
# Provides fast full-text search over past sessions and learned skills.

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional


@dataclass
class MemoryRecord:
    session_id: str
    summary: str
    tags: str
    created_at: str


class MemoryStore:
    def __init__(self, db_path: str | Path = ":memory:") -> None:
        self.db_path = str(db_path)
        self._conn: Optional[sqlite3.Connection] = None
        if self.db_path == ":memory:":
            self._conn = sqlite3.connect(":memory:")
            self._conn.row_factory = sqlite3.Row
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        if self._conn is not None:
            return self._conn
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        conn = self._get_connection()
        conn.execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS session_memory
            USING fts5(session_id, summary, tags, created_at)
            """
        )
        conn.commit()
        if self._conn is None:
            conn.close()

    def save_session_memory(
        self, session_id: str, summary: str, tags: str = ""
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        conn = self._get_connection()
        try:
            conn.execute(
                """
                INSERT INTO session_memory(session_id, summary, tags, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (session_id, summary, tags, now),
            )
            conn.commit()
        finally:
            if self._conn is None:
                conn.close()

    def search_memories(self, query: str, limit: int = 5) -> List[MemoryRecord]:
        clean_query = "".join(c if c.isalnum() or c.isspace() else " " for c in query).strip()
        if not clean_query:
            return []

        fts_query = " OR ".join(clean_query.split())
        conn = self._get_connection()
        try:
            cursor = conn.execute(
                """
                SELECT session_id, summary, tags, created_at
                FROM session_memory
                WHERE session_memory MATCH ?
                ORDER BY rank
                LIMIT ?
                """,
                (fts_query, limit),
            )
            rows = cursor.fetchall()
            return [
                MemoryRecord(
                    session_id=r["session_id"],
                    summary=r["summary"],
                    tags=r["tags"],
                    created_at=r["created_at"],
                )
                for r in rows
            ]
        except sqlite3.OperationalError:
            return []
        finally:
            if self._conn is None:
                conn.close()

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

