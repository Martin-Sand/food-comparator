#!/usr/bin/env python3
"""Mark a user as admin.

Usage:
  python3 scripts/make_admin.py user@example.com

Notes:
- Assumes the database schema already includes `users.is_admin` (via Alembic).
- Works for both SQLite and Postgres depending on DATABASE_URL.
"""

import sys


def main() -> int:
    if len(sys.argv) != 2:
        print('Usage: python3 scripts/make_admin.py user@example.com')
        return 2

    email = sys.argv[1].strip().lower()
    if not email:
        print('Email cannot be empty')
        return 2

    from app.app import app, db, User  # noqa: E402

    with app.app_context():
        user = User.query.filter_by(email=email).first()
        if not user:
            print(f'User not found: {email}')
            return 1

        user.is_admin = True
        db.session.commit()
        print(f'OK: set is_admin=True for {email}')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
