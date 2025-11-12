"""
Migration script to add is_admin field and set masand97@gmail.com as admin.
Run this once to update your database schema.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.app import app, db, User

with app.app_context():
    # Add the is_admin column to users table using raw SQL
    try:
        db.session.execute(db.text('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0'))
        db.session.commit()
        print("✓ Added is_admin field to users table successfully!")
    except Exception as e:
        if 'duplicate column name' in str(e).lower():
            print("⚠ is_admin column already exists")
        else:
            print(f"Error adding column: {e}")
        db.session.rollback()
    
    # Set masand97@gmail.com as admin
    admin_user = User.query.filter_by(email='masand97@gmail.com').first()
    if admin_user:
        admin_user.is_admin = True
        db.session.commit()
        print(f"✓ Set {admin_user.email} as admin!")
    else:
        print("⚠ User masand97@gmail.com not found. Please register this account first.")

