"""Legacy helper.

Original purpose: create tables via `db.create_all()`.
Prefer Alembic migrations instead:
- `flask --app app.app:app db upgrade`
"""

from app.app import app, db


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("✅ All tables created successfully!")
