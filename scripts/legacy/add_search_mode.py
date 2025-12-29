"""Legacy one-off SQLite migration script.

Original purpose: add `mode` to `saved_searches` in SQLite.
Prefer Alembic migrations instead.
"""

import sqlite3
import os


def migrate():
    db_path = os.path.join(os.path.dirname(__file__), '..', '..', 'app', 'comparator.db')

    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        print("Start the app first (or run migrations) then retry.")
        return

    print(f"Using database at: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(saved_searches)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'mode' in columns:
            print("✓ Column 'mode' already exists")
            return

        cursor.execute("ALTER TABLE saved_searches ADD COLUMN mode VARCHAR(20) DEFAULT 'compare'")
        conn.commit()
        print("✓ Successfully added 'mode' column")

    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
    finally:
        conn.close()


if __name__ == '__main__':
    migrate()
