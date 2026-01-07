#!/usr/bin/env python3
"""Mark a user as premium (subscription active).

Usage:
  python3 scripts/make_premium.py user@example.com

Notes:
- Works for both SQLite and Postgres depending on DATABASE_URL.
- Does not create users; register first if needed.
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def main() -> int:
    if len(sys.argv) != 2:
        print('Usage: python3 scripts/make_premium.py user@example.com')
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
            print('Create the user first by registering locally, then rerun this command.')
            return 1

        user.subscription_status = 'active'
        user.subscription_end_date = datetime.utcnow() + timedelta(days=365)
        db.session.commit()

        print(f'OK: set subscription_status=active for {email}')
        print(f'OK: set subscription_end_date={user.subscription_end_date.isoformat()}')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
