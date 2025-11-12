#!/usr/bin/env python3
"""Create a premium user for testing."""

from app import app, db, User
from datetime import datetime, timedelta

def create_premium_user(email, password):
    """Create or update a user to premium status."""
    with app.app_context():
        # Check if user exists
        user = User.query.filter_by(email=email).first()
        
        if user:
            print(f"✅ User {email} already exists. Upgrading to premium...")
        else:
            print(f"✅ Creating new user {email}...")
            user = User(email=email)
            user.set_password(password)
            db.session.add(user)
        
        # Set premium status
        user.subscription_status = 'active'
        user.subscription_end_date = datetime.utcnow() + timedelta(days=365)  # 1 year
        user.stripe_customer_id = 'test_customer_premium'
        
        db.session.commit()
        
        print(f"🎉 Premium user created successfully!")
        print(f"📧 Email: {email}")
        print(f"💎 Status: {user.subscription_status}")
        print(f"📅 Expires: {user.subscription_end_date.strftime('%Y-%m-%d')}")
        print(f"\n✅ You can now login with this account!")

if __name__ == '__main__':
    # Create premium user
    email = "masand97@gmail.com"
    password = "testpass123"  # Change this to your preferred password
    
    create_premium_user(email, password)
