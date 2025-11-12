#!/usr/bin/env python3
"""
Migration script to add mode field to saved_searches table.
This allows filtering saved searches by whether they were created in compare or explore mode.
"""

import sqlite3
import os

def migrate():
    # Get database path - should be in app/comparator.db based on app.py config
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
        # Check if column already exists
        cursor.execute("PRAGMA table_info(saved_searches)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'mode' in columns:
            print("✓ Column 'mode' already exists in saved_searches table")
            return
        
        print("Adding 'mode' column to saved_searches table...")
        
        # Add mode column with default value 'compare'
        cursor.execute("""
            ALTER TABLE saved_searches 
            ADD COLUMN mode VARCHAR(20) DEFAULT 'compare'
        """)
        
        conn.commit()
        print("✓ Successfully added 'mode' column to saved_searches table")
        
        # Show current searches and their modes
        cursor.execute("SELECT id, name, mode FROM saved_searches")
        searches = cursor.fetchall()
        
        if searches:
            print(f"\nCurrent saved searches ({len(searches)} total):")
            for search_id, name, mode in searches:
                print(f"  - {name} (ID: {search_id}, Mode: {mode})")
        else:
            print("\nNo saved searches found in database")
            
    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
