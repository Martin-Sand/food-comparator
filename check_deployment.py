#!/usr/bin/env python3
"""
Pre-deployment checklist script
Run this before deploying to production
"""

import os
import sys
from pathlib import Path

def check_env_vars():
    """Check if all required environment variables are set"""
    required = [
        'SECRET_KEY',
        'OPENAI_API_KEY',
        'STRIPE_SECRET_KEY',
        'STRIPE_PUBLISHABLE_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'STRIPE_PRICE_ID'
    ]
    
    missing = []
    for var in required:
        if not os.getenv(var):
            missing.append(var)
    
    if missing:
        print(f"❌ Missing environment variables: {', '.join(missing)}")
        return False
    
    print("✅ All required environment variables are set")
    return True

def check_files():
    """Check if all required files exist"""
    required = [
        'app/app.py',
        'app/static/categories.csv',
        'app/templates/index.html',
        'Dockerfile',
        'requirements.txt'
    ]
    
    missing = []
    for file in required:
        if not Path(file).exists():
            missing.append(file)
    
    if missing:
        print(f"❌ Missing files: {', '.join(missing)}")
        return False
    
    print("✅ All required files exist")
    return True

def check_database():
    """Check database configuration"""
    db_url = os.getenv('DATABASE_URL')
    
    if not db_url:
        print("⚠️  DATABASE_URL not set - will use SQLite by default")
        print("   For production, set DATABASE_URL to PostgreSQL connection string")
        return True
    
    if db_url.startswith('sqlite'):
        print("⚠️  Using SQLite database")
        print("   For production, use PostgreSQL for better performance")
        return True
    
    if db_url.startswith('postgres'):
        print("✅ Using PostgreSQL database")
        return True
    
    print("❌ Invalid DATABASE_URL format")
    return False

def check_stripe_keys():
    """Check if using production Stripe keys"""
    sk = os.getenv('STRIPE_SECRET_KEY', '')
    pk = os.getenv('STRIPE_PUBLISHABLE_KEY', '')
    
    if sk.startswith('sk_test_') or pk.startswith('pk_test_'):
        print("⚠️  Using Stripe TEST keys")
        print("   For production, use LIVE keys (sk_live_... and pk_live_...)")
        return True
    
    if sk.startswith('sk_live_') and pk.startswith('pk_live_'):
        print("✅ Using Stripe LIVE keys")
        return True
    
    print("❌ Invalid Stripe key format")
    return False

def check_debug_mode():
    """Check if debug mode is disabled"""
    debug = os.getenv('DEBUG', 'False')
    
    if debug.lower() == 'true':
        print("⚠️  DEBUG mode is enabled")
        print("   For production, set DEBUG=False")
        return True
    
    print("✅ DEBUG mode is disabled")
    return True

def main():
    print("=" * 60)
    print("Pre-Deployment Checklist")
    print("=" * 60)
    print()
    
    checks = [
        ("Environment Variables", check_env_vars),
        ("Required Files", check_files),
        ("Database Configuration", check_database),
        ("Stripe Keys", check_stripe_keys),
        ("Debug Mode", check_debug_mode)
    ]
    
    all_passed = True
    for name, check_func in checks:
        print(f"\n{name}:")
        print("-" * 60)
        if not check_func():
            all_passed = False
    
    print()
    print("=" * 60)
    if all_passed:
        print("✅ All checks passed! Ready to deploy")
        print()
        print("Next steps:")
        print("1. Push your code to GitHub")
        print("2. Connect to Railway or Render")
        print("3. Set environment variables in platform dashboard")
        print("4. Deploy!")
        print("5. Run database migrations")
        print("6. Update Stripe webhook URL")
        return 0
    else:
        print("❌ Some checks failed. Please fix issues before deploying")
        return 1

if __name__ == '__main__':
    sys.exit(main())
