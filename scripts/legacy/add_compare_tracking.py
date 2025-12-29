"""Legacy one-off SQLite migration script.

Original purpose: add compare tracking fields to the SQLite DB.
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
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]

        changes_made = False

        if 'compare_count' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN compare_count INTEGER DEFAULT 0")
            changes_made = True
            print("✓ Added 'compare_count' column")

        if 'last_compare_date' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN last_compare_date DATE")
            changes_made = True
            print("✓ Added 'last_compare_date' column")

        if changes_made:
            conn.commit()
            print("✓ Migration completed successfully!")
        else:
            print("✓ No migration needed")

    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
    finally:
        conn.close()


if __name__ == '__main__':
    migrate()
