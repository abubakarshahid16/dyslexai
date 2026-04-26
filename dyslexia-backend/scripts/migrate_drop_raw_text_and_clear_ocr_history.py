"""Drop ocr_runs.raw_text (if present) and clear old OCR history rows.

This migration is intended for both PostgreSQL (Supabase) and SQLite.
It is safe to run multiple times.
"""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import inspect, text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import engine


def main() -> None:
    with engine.begin() as conn:
        # Clear old OCR history so only fresh runs remain in teacher/student history.
        conn.execute(text("DELETE FROM ocr_runs"))

        inspector = inspect(conn)
        cols = {c["name"] for c in inspector.get_columns("ocr_runs")}
        if "raw_text" in cols:
            dialect = conn.dialect.name
            if dialect == "postgresql":
                conn.execute(text("ALTER TABLE ocr_runs DROP COLUMN IF EXISTS raw_text"))
            elif dialect == "sqlite":
                # SQLite support for DROP COLUMN depends on version.
                # Try it and continue if unsupported.
                try:
                    conn.execute(text("ALTER TABLE ocr_runs DROP COLUMN raw_text"))
                except Exception as e:
                    print(f"[migration] sqlite drop raw_text skipped: {e}")
            else:
                try:
                    conn.execute(text("ALTER TABLE ocr_runs DROP COLUMN raw_text"))
                except Exception as e:
                    print(f"[migration] drop raw_text skipped for {dialect}: {e}")

    print("[migration] OCR history cleared. raw_text column removal attempted.")


if __name__ == "__main__":
    main()
