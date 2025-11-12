"""
Migration script to add usage tracking fields to User model.
Run this once to update the database schema.
"""
from app import app, db
from sqlalchemy import text

with app.app_context():
    try:
        # Check if columns already exist
        with db.engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result]
            
            if 'explore_count' not in columns:
                print("Adding explore_count column...")
                conn.execute(text("ALTER TABLE users ADD COLUMN explore_count INTEGER DEFAULT 0"))
                conn.commit()
                print("✓ Added explore_count column")
            else:
                print("explore_count column already exists")
            
            if 'last_explore_date' not in columns:
                print("Adding last_explore_date column...")
                conn.execute(text("ALTER TABLE users ADD COLUMN last_explore_date DATE"))
                conn.commit()
                print("✓ Added last_explore_date column")
            else:
                print("last_explore_date column already exists")
        
        print("\n✓ Database migration completed successfully!")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        raise
