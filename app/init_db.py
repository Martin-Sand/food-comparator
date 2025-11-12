#!/usr/bin/env python3
"""Initialize the database with all tables."""

from app import app, db

if __name__ == '__main__':
    with app.app_context():
        # Create all tables
        db.create_all()
        print(f"✅ Database initialized successfully!")
        print(f"📁 Database location: {app.config['SQLALCHEMY_DATABASE_URI']}")
        
        # Verify tables were created
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        print(f"📋 Tables created: {', '.join(tables)}")
