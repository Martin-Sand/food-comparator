"""
Migration script to add shared_comparisons table.
Run this once to update your database schema.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.app import app, db, SharedComparison

with app.app_context():
    # Create the shared_comparisons table
    db.create_all()
    print("✓ Created shared_comparisons table successfully!")
