"""Legacy helper (pre-migrations).

Original purpose: create `product_data_cache` table via SQLAlchemy table.create.
Prefer Alembic migrations instead.
"""

from datetime import datetime

from app.app import app, db  # type: ignore


class ProductDataCache(db.Model):
    __tablename__ = 'product_data_cache'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    cache_key = db.Column(db.String(32), unique=True, nullable=False, index=True)
    data = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


if __name__ == '__main__':
    with app.app_context():
        ProductDataCache.__table__.create(db.engine, checkfirst=True)
        print("✅ ProductDataCache table created successfully!")
