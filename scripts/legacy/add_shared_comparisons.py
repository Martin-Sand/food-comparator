"""Legacy helper (pre-migrations).

Original purpose: create the `shared_comparisons` table via db.create_all().
Prefer Alembic migrations instead.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + '/../..')

from app.app import app, db  # noqa: E402


with app.app_context():
    db.create_all()
    print("✓ Created shared_comparisons table successfully!")
