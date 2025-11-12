"""
Migration script to add ProductDataCache table to the database.
Run this once after deploying the updated code.
"""
from app.app import app, db
from datetime import datetime

# Define the ProductDataCache model (same as in app.py)
class ProductDataCache(db.Model):
    """Temporary storage for product comparison data (works across Railway instances)"""
    __tablename__ = 'product_data_cache'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    cache_key = db.Column(db.String(32), unique=True, nullable=False, index=True)
    data = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

if __name__ == '__main__':
    with app.app_context():
        print("Creating ProductDataCache table...")
        
        # Create only the new table (won't affect existing tables)
        ProductDataCache.__table__.create(db.engine, checkfirst=True)
        
        print("✅ ProductDataCache table created successfully!")
        print("\nYou can now use the database-based product data cache.")
