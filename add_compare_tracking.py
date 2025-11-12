#!/usr/bin/env python3
"""
Migration script to add compare tracking fields to users table.
This allows tracking daily compare usage for free users (1 compare per day).
"""

import sqlite3
import os

def migrate():
    # Get database path
    db_path = os.path.join(os.path.dirname(__file__), 'app', 'comparator.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        print("The database will be created when the app starts.")
        print("Start the Flask app first to create the database, then run this migration.")
        return
    
    print(f"Using database at: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        changes_made = False
        
        if 'compare_count' not in columns:
            print("Adding 'compare_count' column to users table...")
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN compare_count INTEGER DEFAULT 0
            """)
            changes_made = True
            print("✓ Added 'compare_count' column")
        else:
            print("✓ Column 'compare_count' already exists")
        
        if 'last_compare_date' not in columns:
            print("Adding 'last_compare_date' column to users table...")
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN last_compare_date DATE
            """)
            changes_made = True
            print("✓ Added 'last_compare_date' column")
        else:
            print("✓ Column 'last_compare_date' already exists")
        
        if changes_made:
            conn.commit()
            print("\n✓ Migration completed successfully!")
        else:
            print("\n✓ All columns already exist, no migration needed")
        
        # Show user count
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        print(f"\nTotal users in database: {user_count}")
            
    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
