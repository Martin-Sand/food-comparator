"""Legacy one-off SQLite migration script.

Original purpose: add usage-tracking columns using SQLite PRAGMA/ALTER.
Prefer Alembic migrations instead.
"""

from sqlalchemy import text

from app import app, db  # type: ignore


with app.app_context():
    with db.engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(users)"))
        columns = [row[1] for row in result]

        if 'explore_count' not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN explore_count INTEGER DEFAULT 0"))
            conn.commit()

        if 'last_explore_date' not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN last_explore_date DATE"))
            conn.commit()

    print("✓ Done")
