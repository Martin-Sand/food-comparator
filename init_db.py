#!/usr/bin/env python3
"""
Initialize database tables for the food comparator app.
Creates all tables defined in the SQLAlchemy models.
"""
from app.app import app, db

if __name__ == '__main__':
    with app.app_context():
        print("Creating database tables...")
        db.create_all()
        print("✅ All tables created successfully!")
