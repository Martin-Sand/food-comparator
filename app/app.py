import os
import csv
import json
import time
from collections import defaultdict, deque
from typing import List, Dict, Any, Optional
from datetime import datetime
from functools import wraps
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash, abort
from dotenv import load_dotenv
import secrets
import requests
from PIL import Image
import pytesseract
import io
from openai import OpenAI
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from flask_migrate import Migrate
import stripe

# Load environment variables from .env file
load_dotenv()

# Initialize OpenAI client
openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

# Initialize Stripe
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')
STRIPE_PRICE_ID = os.environ.get('STRIPE_PRICE_ID')  # Your recurring price ID from Stripe Dashboard

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(16))

# ============================
# Database Configuration
# ============================
# Use SQLite for development, PostgreSQL for production
# Use absolute path for SQLite to avoid path issues
basedir = os.path.abspath(os.path.dirname(__file__))
database_url = os.environ.get('DATABASE_URL')

# If no DATABASE_URL is set, use SQLite with absolute path
if not database_url:
    database_url = f'sqlite:///{os.path.join(basedir, "comparator.db")}'
    print(f"Using SQLite database at: {database_url}")
else:
    # Fix for Heroku/Railway PostgreSQL URL (postgres:// -> postgresql://)
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    print(f"Using PostgreSQL database")

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
migrate = Migrate(app, db)

# ============================
# Authentication Configuration
# ============================
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = None  # Don't show flash message on redirect

# ============================
# Database Models
# ============================
class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_admin = db.Column(db.Boolean, default=False)
    
    # Subscription fields
    subscription_status = db.Column(db.String(20), default='free')  # free, active, cancelled
    subscription_end_date = db.Column(db.DateTime, nullable=True)
    stripe_customer_id = db.Column(db.String(100), nullable=True)
    
    # Usage tracking for free users
    explore_count = db.Column(db.Integer, default=0)
    last_explore_date = db.Column(db.Date, nullable=True)
    compare_count = db.Column(db.Integer, default=0)
    last_compare_date = db.Column(db.Date, nullable=True)
    
    # Relationships
    saved_searches = db.relationship('SavedSearch', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def is_subscribed(self):
        """Check if user has an active subscription"""
        # If subscription status is active, consider them subscribed
        # Even if end_date is not set yet (it will be updated by subsequent webhooks)
        if self.subscription_status == 'active':
            # If we have an end date, check if it's still valid
            if self.subscription_end_date:
                return self.subscription_end_date > datetime.utcnow()
            # If no end date yet but status is active, trust the status
            return True
        return False
    
    def can_explore(self):
        """Check if user can perform an explore (free users: 3 per day, premium: unlimited)"""
        if self.is_subscribed():
            return True
        
        today = datetime.utcnow().date()
        
        # Reset count if it's a new day
        if self.last_explore_date != today:
            self.explore_count = 0
            self.last_explore_date = today
            db.session.commit()
        
        return self.explore_count < 3
    
    def increment_explore_count(self):
        """Increment the explore count for free users"""
        if not self.is_subscribed():
            today = datetime.utcnow().date()
            
            # Reset count if it's a new day
            if self.last_explore_date != today:
                self.explore_count = 0
                self.last_explore_date = today
            
            self.explore_count += 1
            db.session.commit()
    
    def get_remaining_explores(self):
        """Get remaining explores for today (free users only)"""
        if self.is_subscribed():
            return float('inf')  # Unlimited
        
        today = datetime.utcnow().date()
        
        # Reset count if it's a new day
        if self.last_explore_date != today:
            return 3
        
        return max(0, 3 - self.explore_count)
    
    def can_compare(self):
        """Check if user can perform a compare (free users: 1 per day, premium: unlimited)"""
        if self.is_subscribed():
            return True
        
        today = datetime.utcnow().date()
        
        # Reset count if it's a new day
        if self.last_compare_date != today:
            self.compare_count = 0
            self.last_compare_date = today
            db.session.commit()
        
        return self.compare_count < 1
    
    def increment_compare_count(self):
        """Increment the compare count for free users"""
        if not self.is_subscribed():
            today = datetime.utcnow().date()
            
            # Reset count if it's a new day
            if self.last_compare_date != today:
                self.compare_count = 0
                self.last_compare_date = today
            
            self.compare_count += 1
            db.session.commit()
    
    def get_remaining_compares(self):
        """Get remaining compares for today (free users only)"""
        if self.is_subscribed():
            return float('inf')  # Unlimited
        
        today = datetime.utcnow().date()
        
        # Reset count if it's a new day
        if self.last_compare_date != today:
            return 1
        
        return max(0, 1 - self.compare_count)
    
    def __repr__(self):
        return f'<User {self.email}>'


class SavedSearch(db.Model):
    __tablename__ = 'saved_searches'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    selected_categories = db.Column(db.JSON, nullable=False)
    user_product_data = db.Column(db.JSON, nullable=True)
    mode = db.Column(db.String(20), default='compare')  # 'compare' or 'explore'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_accessed = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<SavedSearch {self.name}>'


class SharedComparison(db.Model):
    __tablename__ = 'shared_comparisons'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(32), unique=True, nullable=False, index=True)
    comparison_data = db.Column(db.JSON, nullable=False)  # Store full comparison data
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    view_count = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    user = db.relationship('User', backref='shared_comparisons')
    
    def __repr__(self):
        return f'<SharedComparison {self.token}>'


class ProductDataCache(db.Model):
    """Temporary storage for product comparison data (works across Railway instances)"""
    __tablename__ = 'product_data_cache'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    cache_key = db.Column(db.String(32), unique=True, nullable=False, index=True)
    data = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<ProductDataCache {self.cache_key}>'


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

# ============================
# Authentication Routes
# ============================
@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        confirm_password = data.get('confirm_password', '')
        
        # Validation
        if not email or not password:
            if request.is_json:
                return jsonify({'success': False, 'error': 'Email and password are required'}), 400
            flash('Email and password are required', 'error')
            return render_template('register.html')
        
        if password != confirm_password:
            if request.is_json:
                return jsonify({'success': False, 'error': 'Passwords do not match'}), 400
            flash('Passwords do not match', 'error')
            return render_template('register.html')
        
        if len(password) < 8:
            if request.is_json:
                return jsonify({'success': False, 'error': 'Password must be at least 8 characters'}), 400
            flash('Password must be at least 8 characters', 'error')
            return render_template('register.html')
        
        # Check if user already exists
        if User.query.filter_by(email=email).first():
            if request.is_json:
                return jsonify({'success': False, 'error': 'Email already registered'}), 400
            flash('Email already registered. Please log in.', 'error')
            return render_template('register.html')
        
        # Create new user
        user = User(email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        
        # Log them in automatically
        login_user(user)
        
        if request.is_json:
            return jsonify({'success': True, 'message': 'Registration successful'})
        flash('Registration successful! Welcome!', 'success')
        return redirect(url_for('index'))
    
    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        remember = data.get('remember', False)
        
        if not email or not password:
            if request.is_json:
                return jsonify({'success': False, 'error': 'Email and password are required'}), 400
            flash('Email and password are required', 'error')
            return render_template('login.html')
        
        user = User.query.filter_by(email=email).first()
        
        if user and user.check_password(password):
            login_user(user, remember=remember)
            next_page = request.args.get('next')
            if request.is_json:
                return jsonify({'success': True, 'message': 'Login successful', 'next': next_page or url_for('index')})
            return redirect(next_page or url_for('index'))
        
        if request.is_json:
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401
        flash('Invalid email or password', 'error')
        return render_template('login.html')
    
    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out', 'info')
    return redirect(url_for('index'))


# ============================
# Profile Page
# ============================
@app.route('/profile')
@login_required
def profile_page():
    """Display user profile page."""
    return render_template('profile.html')


@app.route('/api/update_email', methods=['POST'])
@login_required
def update_email():
    """Update user email."""
    try:
        data = request.get_json()
        new_email = data.get('email', '').strip().lower()
        
        if not new_email:
            return jsonify({'success': False, 'error': 'Email is required'}), 400
        
        # Check if email is already taken by another user
        existing_user = User.query.filter(User.email == new_email, User.id != current_user.id).first()
        if existing_user:
            return jsonify({'success': False, 'error': 'Email already in use'}), 400
        
        current_user.email = new_email
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Email updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/update_password', methods=['POST'])
@login_required
def update_password():
    """Update user password."""
    try:
        data = request.get_json()
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        confirm_password = data.get('confirm_password', '')
        
        if not current_password or not new_password or not confirm_password:
            return jsonify({'success': False, 'error': 'All fields are required'}), 400
        
        # Verify current password
        if not current_user.check_password(current_password):
            return jsonify({'success': False, 'error': 'Current password is incorrect'}), 400
        
        # Check new password matches confirmation
        if new_password != confirm_password:
            return jsonify({'success': False, 'error': 'New passwords do not match'}), 400
        
        # Validate password length
        if len(new_password) < 6:
            return jsonify({'success': False, 'error': 'Password must be at least 6 characters'}), 400
        
        current_user.set_password(new_password)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Password updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================
# Stripe Payment Integration
# ============================
@app.route('/create-checkout-session', methods=['POST'])
@login_required
def create_checkout_session():
    """Create a Stripe Checkout session for subscription."""
    try:
        # Get or create Stripe customer
        if not current_user.stripe_customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                metadata={'user_id': current_user.id}
            )
            current_user.stripe_customer_id = customer.id
            db.session.commit()
        
        # Create Checkout Session
        checkout_session = stripe.checkout.Session.create(
            customer=current_user.stripe_customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price': STRIPE_PRICE_ID,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=url_for('payment_success', _external=True) + '?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=url_for('profile_page', _external=True),
            metadata={'user_id': current_user.id}
        )
        
        return jsonify({'checkout_url': checkout_session.url})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/create-portal-session', methods=['POST'])
@login_required
def create_portal_session():
    """Create a Stripe Customer Portal session for subscription management."""
    try:
        print(f"Portal session requested by user: {current_user.email}")
        print(f"Customer ID: {current_user.stripe_customer_id}")
        print(f"Subscription status: {current_user.subscription_status}")
        
        if not current_user.stripe_customer_id:
            return jsonify({'error': 'No Stripe customer ID found. Please contact support.'}), 404
        
        portal_session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=url_for('profile_page', _external=True),
        )
        
        print(f"Portal session created: {portal_session.url}")
        return jsonify({'portal_url': portal_session.url})
    except Exception as e:
        print(f"Error creating portal session: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/webhook', methods=['POST'])
def stripe_webhook():
    """Handle Stripe webhook events."""
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        # Invalid payload
        return jsonify({'error': str(e)}), 400
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        return jsonify({'error': str(e)}), 400
    
    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        handle_checkout_session_completed(session)
    
    elif event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        handle_subscription_updated(subscription)
    
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        handle_subscription_deleted(subscription)
    
    elif event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        handle_invoice_payment_succeeded(invoice)
    
    elif event['type'] == 'invoice.payment_failed':
        invoice = event['data']['object']
        handle_invoice_payment_failed(invoice)
    
    return jsonify({'success': True}), 200


def handle_checkout_session_completed(session):
    """Handle successful checkout session."""
    user_id = session.get('metadata', {}).get('user_id')
    if not user_id:
        print("No user_id in session metadata")
        return
    
    user = db.session.get(User, int(user_id))
    if user:
        print(f"Setting user {user.email} to active subscription")
        user.subscription_status = 'active'
        # Store the Stripe customer ID if not already set
        if not user.stripe_customer_id and session.get('customer'):
            user.stripe_customer_id = session['customer']
            print(f"Set customer ID: {session['customer']}")
        # Get subscription end date from Stripe - expand to get all fields
        if session.get('subscription'):
            try:
                subscription = stripe.Subscription.retrieve(
                    session['subscription'],
                    expand=['latest_invoice']
                )
                if subscription.get('current_period_end'):
                    end_date = datetime.fromtimestamp(subscription['current_period_end'])
                    user.subscription_end_date = end_date
                    print(f"Set subscription end date: {end_date}")
                else:
                    print("No current_period_end in subscription")
            except Exception as e:
                print(f"Error retrieving subscription details: {e}")
        db.session.commit()
        print(f"User subscription status: {user.subscription_status}, end_date: {user.subscription_end_date}")
    else:
        print(f"User not found with ID: {user_id}")


def handle_subscription_updated(subscription):
    """Handle subscription updates."""
    customer_id = subscription.get('customer')
    user = User.query.filter_by(stripe_customer_id=customer_id).first()
    
    if user:
        status = subscription.get('status')
        if status == 'active':
            user.subscription_status = 'active'
            # Use dictionary access for subscription data from webhook
            user.subscription_end_date = datetime.fromtimestamp(subscription.get('current_period_end'))
        elif status in ['canceled', 'unpaid', 'past_due']:
            user.subscription_status = 'cancelled'
        
        db.session.commit()


def handle_subscription_deleted(subscription):
    """Handle subscription cancellation."""
    customer_id = subscription.get('customer')
    user = User.query.filter_by(stripe_customer_id=customer_id).first()
    
    if user:
        user.subscription_status = 'cancelled'
        db.session.commit()


def handle_invoice_payment_succeeded(invoice):
    """Handle successful payment."""
    customer_id = invoice.get('customer')
    user = User.query.filter_by(stripe_customer_id=customer_id).first()
    
    if user and user.subscription_status != 'active':
        user.subscription_status = 'active'
        # Update subscription end date
        if invoice.get('subscription'):
            try:
                subscription = stripe.Subscription.retrieve(invoice['subscription'])
                if subscription.get('current_period_end'):
                    user.subscription_end_date = datetime.fromtimestamp(subscription['current_period_end'])
            except Exception as e:
                print(f"Error retrieving subscription details: {e}")
        db.session.commit()


def handle_invoice_payment_failed(invoice):
    """Handle failed payment."""
    customer_id = invoice.get('customer')
    user = User.query.filter_by(stripe_customer_id=customer_id).first()
    
    if user:
        # You might want to send an email notification here
        pass


@app.route('/payment-success')
@login_required
def payment_success():
    """Display payment success page."""
    return render_template('payment_success.html')


@app.route('/pricing')
def pricing_page():
    """Display pricing page."""
    return render_template('pricing.html')


# ============================
# Admin Panel
# ============================
def admin_required(f):
    """Decorator to check if user is admin."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            abort(403)
        return f(*args, **kwargs)
    return decorated_function


@app.route('/admin')
@login_required
@admin_required
def admin_dashboard():
    """Display admin dashboard with statistics."""
    # Get user statistics
    total_users = User.query.count()
    premium_users = User.query.filter_by(subscription_status='active').count()
    free_users = total_users - premium_users
    
    # Get recent signups (last 10)
    recent_users = User.query.order_by(User.created_at.desc()).limit(10).all()
    
    # Get saved searches count
    total_searches = SavedSearch.query.count()
    
    # Get shared links statistics
    total_shared_links = SharedComparison.query.count()
    active_shared_links = SharedComparison.query.filter_by(is_active=True).count()
    total_views = db.session.query(db.func.sum(SharedComparison.view_count)).scalar() or 0
    
    # Get most viewed shared comparisons
    popular_shared = SharedComparison.query.order_by(SharedComparison.view_count.desc()).limit(5).all()
    
    return render_template('admin.html',
        total_users=total_users,
        premium_users=premium_users,
        free_users=free_users,
        recent_users=recent_users,
        total_searches=total_searches,
        total_shared_links=total_shared_links,
        active_shared_links=active_shared_links,
        total_views=total_views,
        popular_shared=popular_shared
    )


@app.route('/admin/users')
@login_required
@admin_required
def admin_users():
    """Display user management page."""
    # Get all users with ordering
    sort_by = request.args.get('sort', 'created_at')
    order = request.args.get('order', 'desc')
    search = request.args.get('search', '')
    
    query = User.query
    
    # Apply search filter
    if search:
        query = query.filter(User.email.ilike(f'%{search}%'))
    
    # Apply sorting
    if sort_by == 'email':
        query = query.order_by(User.email.desc() if order == 'desc' else User.email.asc())
    elif sort_by == 'subscription_status':
        query = query.order_by(User.subscription_status.desc() if order == 'desc' else User.subscription_status.asc())
    else:  # created_at
        query = query.order_by(User.created_at.desc() if order == 'desc' else User.created_at.asc())
    
    users = query.all()
    
    return render_template('admin_users.html',
        users=users,
        sort_by=sort_by,
        order=order,
        search=search
    )


@app.route('/admin/users/<int:user_id>/toggle-subscription', methods=['POST'])
@login_required
@admin_required
def admin_toggle_subscription(user_id):
    """Manually toggle user subscription (for support purposes)."""
    user = User.query.get_or_404(user_id)
    
    if user.subscription_status == 'active':
        user.subscription_status = 'inactive'
        message = f'Deactivated subscription for {user.email}'
    else:
        user.subscription_status = 'active'
        message = f'Activated subscription for {user.email}'
    
    db.session.commit()
    
    return jsonify({'success': True, 'message': message})


@app.route('/admin/shared-links')
@login_required
@admin_required
def admin_shared_links():
    """Display shared links management page."""
    sort_by = request.args.get('sort', 'created_at')
    order = request.args.get('order', 'desc')
    
    query = SharedComparison.query
    
    # Apply sorting
    if sort_by == 'view_count':
        query = query.order_by(SharedComparison.view_count.desc() if order == 'desc' else SharedComparison.view_count.asc())
    elif sort_by == 'is_active':
        query = query.order_by(SharedComparison.is_active.desc() if order == 'desc' else SharedComparison.is_active.asc())
    else:  # created_at
        query = query.order_by(SharedComparison.created_at.desc() if order == 'desc' else SharedComparison.created_at.asc())
    
    shared_links = query.all()
    
    return render_template('admin_shared_links.html',
        shared_links=shared_links,
        sort_by=sort_by,
        order=order
    )


@app.route('/admin/shared-links/<int:link_id>/toggle-active', methods=['POST'])
@login_required
@admin_required
def admin_toggle_link(link_id):
    """Toggle shared link active status."""
    shared_link = SharedComparison.query.get_or_404(link_id)
    
    shared_link.is_active = not shared_link.is_active
    db.session.commit()
    
    status = 'activated' if shared_link.is_active else 'deactivated'
    return jsonify({'success': True, 'message': f'Link {status} successfully'})


@app.route('/admin/categories')
@login_required
@admin_required
def admin_categories():
    """Display category management page."""
    search = request.args.get('search', '')
    show_inactive = request.args.get('show_inactive', 'false') == 'true'
    
    # Load all categories
    all_cats = load_categories()
    
    # Get count statistics
    total_categories = len(all_cats)
    active_categories = len([c for c in all_cats if c.get('is_active', True)])
    inactive_categories = total_categories - active_categories
    
    # Build tree structure (don't filter by active status here - show all in tree)
    categories_to_show = all_cats
    
    # Apply search filter if provided
    if search:
        search_lower = search.lower()
        # Find all matching categories and their ancestors
        matching_ids = set()
        id_to_cat = {c['id']: c for c in all_cats}
        
        for cat in all_cats:
            if search_lower in cat['name'].lower():
                # Add this category
                matching_ids.add(cat['id'])
                # Add all ancestors
                current = cat
                while current.get('parent_id'):
                    matching_ids.add(current['parent_id'])
                    current = id_to_cat.get(current['parent_id'])
                    if not current:
                        break
        
        categories_to_show = [c for c in all_cats if c['id'] in matching_ids]
    
    tree = build_category_tree(categories_to_show)
    
    return render_template('admin_categories.html',
        tree=tree,
        search=search,
        show_inactive=show_inactive,
        total_categories=total_categories,
        active_categories=active_categories,
        inactive_categories=inactive_categories
    )


@app.route('/admin/categories/<int:category_id>/toggle-active', methods=['POST'])
@login_required
@admin_required
def admin_toggle_category(category_id):
    """Toggle category active status with cascading to children."""
    try:
        csv_path = os.path.join(os.path.dirname(__file__), 'static', 'categories.csv')
        
        # Read all categories
        rows = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames
            for row in reader:
                rows.append(row)
        
        # Find the target category
        target_cat = next((r for r in rows if r['id'] == str(category_id)), None)
        if not target_cat:
            return jsonify({'success': False, 'error': 'Category not found'}), 404
        
        # Determine new status (toggle)
        new_status = 'False' if target_cat.get('is_active', 'True') == 'True' else 'True'
        
        # If deactivating, cascade to all children
        if new_status == 'False':
            # Build parent-child relationships
            children_map = {}
            for row in rows:
                parent_id = row.get('parent_id')
                if parent_id:
                    if parent_id not in children_map:
                        children_map[parent_id] = []
                    children_map[parent_id].append(row['id'])
            
            # Recursively find all descendants
            def get_all_descendants(cat_id):
                descendants = []
                if cat_id in children_map:
                    for child_id in children_map[cat_id]:
                        descendants.append(child_id)
                        descendants.extend(get_all_descendants(child_id))
                return descendants
            
            affected_ids = [str(category_id)] + get_all_descendants(str(category_id))
            
            # Update all affected categories
            for row in rows:
                if row['id'] in affected_ids:
                    row['is_active'] = new_status
            
            affected_count = len(affected_ids)
        else:
            # Just activate this single category
            target_cat['is_active'] = new_status
            affected_count = 1
        
        # Write back to CSV
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        status = 'activated' if new_status == 'True' else 'deactivated'
        message = f'Category {status} successfully'
        if affected_count > 1:
            message += f' ({affected_count} categories total including subcategories)'
        
        return jsonify({'success': True, 'message': message})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================
# Saved Searches API
# ============================
@app.route('/api/save_search', methods=['POST'])
@login_required
def save_search():
    """Save a search with categories and user product data."""
    try:
        # Free users cannot save searches
        if not current_user.is_subscribed():
            return jsonify({
                'success': False, 
                'error': 'Saving searches is a Premium feature. Upgrade to Premium to save your searches!',
                'upgrade_required': True
            }), 403
        
        data = request.get_json()
        name = data.get('name', '').strip()
        selected_categories = data.get('selected_categories', [])
        user_product_data = data.get('user_product_data')
        mode = data.get('mode', 'compare')  # Get the mode from request
        
        if not name:
            return jsonify({'success': False, 'error': 'Search name is required'}), 400
        
        if not selected_categories:
            return jsonify({'success': False, 'error': 'No categories selected'}), 400
        
        # Create new saved search
        saved_search = SavedSearch(
            user_id=current_user.id,
            name=name,
            selected_categories=selected_categories,
            user_product_data=user_product_data,
            mode=mode
        )
        
        db.session.add(saved_search)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Search saved successfully!',
            'search_id': saved_search.id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/saved_searches', methods=['GET'])
@login_required
def get_saved_searches():
    """Get all saved searches for the current user."""
    mode = request.args.get('mode')  # Get optional mode filter
    
    query = SavedSearch.query.filter_by(user_id=current_user.id)
    
    # Filter by mode if provided
    if mode:
        query = query.filter_by(mode=mode)
    
    searches = query.order_by(SavedSearch.created_at.desc()).all()
    
    return jsonify({
        'success': True,
        'searches': [{
            'id': s.id,
            'name': s.name,
            'mode': s.mode,
            'created_at': s.created_at.isoformat(),
            'last_accessed': s.last_accessed.isoformat() if s.last_accessed else None,
            'category_count': len(s.selected_categories) if s.selected_categories else 0
        } for s in searches],
        'is_premium': current_user.is_subscribed(),
        'limit': None if current_user.is_subscribed() else 3
    })


@app.route('/api/load_search/<int:search_id>', methods=['GET'])
@login_required
def load_search(search_id):
    """Load a specific saved search."""
    saved_search = SavedSearch.query.filter_by(id=search_id, user_id=current_user.id).first()
    
    if not saved_search:
        return jsonify({'success': False, 'error': 'Search not found'}), 404
    
    # Update last accessed time
    saved_search.last_accessed = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'success': True,
        'search': {
            'id': saved_search.id,
            'name': saved_search.name,
            'selected_categories': saved_search.selected_categories,
            'user_product_data': saved_search.user_product_data,
            'created_at': saved_search.created_at.isoformat()
        }
    })


@app.route('/api/delete_search/<int:search_id>', methods=['DELETE'])
@login_required
def delete_search(search_id):
    """Delete a saved search."""
    saved_search = SavedSearch.query.filter_by(id=search_id, user_id=current_user.id).first()
    
    if not saved_search:
        return jsonify({'success': False, 'error': 'Search not found'}), 404
    
    db.session.delete(saved_search)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Search deleted successfully'})


@app.route('/api/update_search/<int:search_id>', methods=['PUT'])
@login_required
def update_search(search_id):
    """Update an existing saved search."""
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    
    saved_search = SavedSearch.query.filter_by(id=search_id, user_id=current_user.id).first()
    
    if not saved_search:
        return jsonify({'success': False, 'error': 'Search not found'}), 404
    
    # Update the search
    if 'name' in data:
        saved_search.name = data['name']
    
    if 'selected_categories' in data:
        saved_search.selected_categories = data['selected_categories']
    
    if 'user_product_data' in data:
        saved_search.user_product_data = data['user_product_data']
    
    # Update last accessed timestamp
    saved_search.last_accessed = datetime.utcnow()
    
    try:
        db.session.commit()
        return jsonify({
            'success': True,
            'message': 'Search updated successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================
# Basic page
# ============================
@app.route('/')
@login_required
def index():
    # If you have a template, render it; else leave as-is
    return render_template('index.html')


@app.route('/saved_searches')
@login_required
def saved_searches_page():
    """Display the saved searches page."""
    return render_template('saved_searches.html')


@app.route('/edit_categories')
@login_required
def edit_categories_page():
    """Display the category editor page."""
    return render_template('edit_categories.html')


@app.route('/edit_nutrition')
@login_required
def edit_nutrition_page():
    """Display the nutrition editor page."""
    return render_template('edit_nutrition.html')


# ============================
# Taxonomy helpers
# ============================
def load_categories() -> List[Dict[str, str]]:
    """
    Always loads from static/categories.csv
    CSV headers: id,parent_id,name,is_active
    """
    cats: List[Dict[str, str]] = []
    static_path = os.path.join(os.path.dirname(__file__), 'static', 'categories.csv')
    with open(static_path, encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cats.append({
                'id': str(row['id']),
                'parent_id': (row['parent_id'] or None),
                'name': row['name'],
                'is_active': row.get('is_active', 'True') == 'True',
            })
    return cats

def build_category_tree(categories: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    """
    Turns flat list into a nested tree for your front-end selectors.
    """
    tree: List[Dict[str, Any]] = []
    children: Dict[Optional[str], List[Dict[str, str]]] = defaultdict(list)
    for cat in categories:
        children[cat['parent_id']].append(cat)
    # Sort children lists by name for stable alphabetical ordering
    for pid in list(children.keys()):
        children[pid].sort(key=lambda c: (c.get('name') or '').lower())

    def build_node(cat: Dict[str, str]) -> Dict[str, Any]:
        return {
            'id': cat['id'],
            'name': cat['name'],
            'is_active': cat.get('is_active', True),
            'children': [build_node(child) for child in children.get(cat['id'], [])]
        }

    # Roots: those with no parent_id, already sorted in children[None]
    for cat in children.get(None, []):
        tree.append(build_node(cat))
    return tree

# Build a full breadcrumb from a target id
def find_category_path(categories: List[Dict[str, str]], target_id: str) -> Optional[str]:
    by_id = {str(c['id']): c for c in categories}
    parent = {str(c['id']): str(c.get('parent_id') or '') for c in categories}

    tid = str(target_id)
    if tid not in by_id:
        return None

    chain = []
    seen = set()
    cur = tid
    while cur and cur in by_id and cur not in seen:
        seen.add(cur)
        chain.append(by_id[cur]['name'])
        cur = parent.get(cur) or ''
        if not cur:
            break

    chain.reverse()
    return " > ".join(chain) if chain else None


def build_children_index(categories: List[Dict[str, str]]) -> Dict[Optional[str], List[Dict[str, str]]]:
    children: Dict[Optional[str], List[Dict[str, str]]] = defaultdict(list)
    for c in categories:
        children[c.get('parent_id')].append(c)
    return children


def get_leaf_descendants(categories: List[Dict[str, str]], root_id: str) -> List[str]:
    """
    Given a flat categories list and a root id, return all descendant ids that are leaves (no children).
    If the root itself is a leaf, return [root_id].
    """
    by_id = {str(c['id']): c for c in categories}
    children_index = build_children_index(categories)

    root = by_id.get(str(root_id))
    if not root:
        return []

    # BFS to collect descendants; then filter leaves
    result: List[str] = []
    q: deque[Dict[str, str]] = deque([root])

    while q:
        node = q.popleft()
        node_id = str(node['id'])
        kids = children_index.get(node_id, [])
        if not kids:
            result.append(node_id)
        else:
            for k in kids:
                q.append(k)

    return result


# ============================
# Merge helper (server-side union)
# ============================
def add_unique_categories(suggestions: List[Dict[str, Any]],
                          existing_categories: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    suggestions: list[{id,name,full_path?}]
    existing_categories: list[{id,name,full_path?}]
    Returns a merged list without duplicate ids. Existing first, then new.
    """
    existing_ids = set(str(c.get("id")) for c in existing_categories)
    merged = list(existing_categories)
    for s in suggestions:
        sid = str(s.get("id"))
        if sid and sid not in existing_ids:
            merged.append(s)
            existing_ids.add(sid)
    return merged





# ============================
# Page routes
# ============================
@app.route('/comparison')
@login_required
def comparison():
    return render_template('comparison.html', product_data=session.get('product_data'))


@app.route('/create-share-link', methods=['POST'])
@login_required
def create_share_link():
    """Create a shareable link for the current comparison (premium only)."""
    if not current_user.is_subscribed():
        return jsonify({'error': 'Share feature is available for premium users only'}), 403
    
    try:
        data = request.json
        comparison_data = data.get('comparison_data')
        
        if not comparison_data:
            return jsonify({'error': 'No comparison data provided'}), 400
        
        # Generate unique token
        token = secrets.token_urlsafe(16)
        
        # Create shared comparison
        shared_comp = SharedComparison(
            user_id=current_user.id,
            token=token,
            comparison_data=comparison_data
        )
        
        db.session.add(shared_comp)
        db.session.commit()
        
        # Generate full URL
        share_url = url_for('view_shared_comparison', token=token, _external=True)
        
        return jsonify({
            'success': True,
            'share_url': share_url,
            'token': token
        })
    
    except Exception as e:
        print(f"Error creating share link: {e}")
        return jsonify({'error': 'Failed to create share link'}), 500


@app.route('/share/<token>')
def view_shared_comparison(token):
    """Public view of a shared comparison (no login required)."""
    shared_comp = SharedComparison.query.filter_by(token=token, is_active=True).first()
    
    if not shared_comp:
        return render_template('error.html', 
                             error_title='Comparison Not Found',
                             error_message='This shared comparison does not exist or has been removed.'), 404
    
    # Increment view count
    shared_comp.view_count += 1
    db.session.commit()
    
    # Get the user who shared it
    owner = shared_comp.user
    
    return render_template('shared_comparison.html', 
                         comparison_data=shared_comp.comparison_data,
                         owner_email=owner.email,
                         view_count=shared_comp.view_count,
                         created_at=shared_comp.created_at,
                         is_public=True)


# ============================
# API Endpoints (used by your JS)
# ============================



@app.route('/category_tree', methods=['GET'])
@login_required
def category_tree():
    cats = load_categories()
    # Filter out inactive categories
    active_cats = [c for c in cats if c.get('is_active', True)]
    tree = build_category_tree(active_cats)
    return jsonify({'tree': tree})


@app.route('/extract_nutrition_from_image', methods=['POST'])
@login_required
def extract_nutrition_from_image():
    """
    Endpoint for extracting nutrition values directly from images using GPT-4 Vision.
    Accepts multipart/form-data with an 'image' field.
    Returns JSON: {'nutrition': {field: value, ...}} or {'error': message}
    
    This bypasses OCR entirely - GPT-4 Vision reads the label directly!
    """
    # Check if OpenAI API key is configured
    if not os.environ.get('OPENAI_API_KEY'):
        return jsonify({'error': 'OpenAI API key not configured. Please add OPENAI_API_KEY to .env file.'}), 500
    
    # Check if image was provided
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    file = request.files['image']
    
    # Check if filename is empty (no file selected)
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Validate file type
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp'}
    file_ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if file_ext not in allowed_extensions:
        return jsonify({'error': f'Unsupported file type: {file_ext}. Allowed: {", ".join(allowed_extensions)}'}), 400
    
    try:
        # Read image and convert to base64
        image_data = file.read()
        import base64
        base64_image = base64.b64encode(image_data).decode('utf-8')
        
        # Determine MIME type
        mime_types = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
            'tiff': 'image/tiff',
            'webp': 'image/webp'
        }
        mime_type = mime_types.get(file_ext, 'image/jpeg')
        
        # Call GPT-4 Vision API
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",  # Supports vision and is cost-effective
            messages=[
                {
                    "role": "system",
                    "content": """You are a nutrition label reader. Extract nutrition values from the image.

CRITICAL RULES:
- All values are per 100g/100ml
- Return ONLY numbers (no units)
- Use decimal points (not commas): 2.8 not 2,8
- Maximum 2 decimal places
- DO NOT confuse letters with numbers (g is NOT 9)
- Typical ranges: salt 0.5-5g, protein 1-90g, carbs 0-100g, fat 0-100g, fiber 0-30g, sugar 0-100g
- Energy: kcal 0-900, kJ 0-4000
- If unclear or not found, use null

Return JSON with these exact fields:
{
  "energy_kcal": number or null,
  "energy_kj": number or null,
  "fat_total": number or null,
  "fat_saturated": number or null,
  "carbs": number or null,
  "sugar": number or null,
  "fiber": number or null,
  "protein": number or null,
  "salt": number or null
}"""
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Please extract all nutrition values from this nutrition label image. Read carefully - don't confuse 'g' (grams) with '9' (number nine)."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            response_format={"type": "json_object"},
            max_tokens=500,
            temperature=0.1
        )
        
        # Parse the JSON response
        result = json.loads(response.choices[0].message.content)
        
        # Filter out null values
        nutrition = {k: v for k, v in result.items() if v is not None}
        
        return jsonify({'nutrition': nutrition})
        
    except Exception as e:
        print(f"Error processing image with Vision API: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to process image: {str(e)}'}), 500


@app.route('/extract_nutrition_ai', methods=['POST'])
@login_required
def extract_nutrition_ai():
    """
    Endpoint for extracting nutrition values from text using OpenAI API.
    Accepts JSON: {'text': raw_text_from_ocr_or_paste}
    Returns JSON: {'nutrition': {field: value, ...}} or {'error': message}
    
    Uses GPT-4 to intelligently parse nutrition text in any format (Norwegian, English, etc.)
    and extract structured data with proper value correction.
    """
    # Check if OpenAI API key is configured
    if not os.environ.get('OPENAI_API_KEY'):
        return jsonify({'error': 'OpenAI API key not configured'}), 500
    
    data = request.json or {}
    text = data.get('text', '').strip()
    
    if not text:
        return jsonify({'error': 'No text provided'}), 400
    
    try:
        # Call OpenAI API with structured output
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",  # Fast and cost-effective
            messages=[
                {
                    "role": "system",
                    "content": """You are a nutrition label parser. Extract nutrition values from text (OCR or typed).

Rules:
- All values are per 100g
- Return numbers only (no units)
- Use decimal point (not comma)
- Max 2 decimal places
- If value unclear, use null
- Correct OCR errors (e.g., "179" for salt is likely "1.79")
- Typical ranges: salt 0.5-5g, protein 5-80g, carbs 10-80g, fat 0-100g, fiber 0-30g, sugar 0-50g

Return JSON with these fields (use null if not found):
{
  "energy_kcal": number or null,
  "energy_kj": number or null,
  "fat_total": number or null,
  "fat_saturated": number or null,
  "carbs": number or null,
  "sugar": number or null,
  "fiber": number or null,
  "protein": number or null,
  "salt": number or null
}"""
                },
                {
                    "role": "user",
                    "content": f"Extract nutrition values from this text:\n\n{text}"
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.1  # Low temperature for consistent parsing
        )
        
        # Parse the JSON response
        result = json.loads(response.choices[0].message.content)
        
        # Filter out null values
        nutrition = {k: v for k, v in result.items() if v is not None}
        
        return jsonify({'nutrition': nutrition})
        
    except Exception as e:
        print(f"Error in AI extraction: {e}")
        return jsonify({'error': f'Failed to extract nutrition values: {str(e)}'}), 500


# Product data storage/retrieval using database (works across Railway instances)
@app.route('/set_product_data', methods=['POST'])
@login_required
def set_product_data():
    payload = request.json
    if not isinstance(payload, dict):
        return jsonify({'error': 'Invalid payload'}), 400
    
    try:
        # Clean up old cache entries (older than 1 hour)
        from datetime import timedelta
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        ProductDataCache.query.filter(ProductDataCache.created_at < one_hour_ago).delete()
        
        # Create new cache entry
        key = secrets.token_urlsafe(16)
        cache_entry = ProductDataCache(
            user_id=current_user.id,
            cache_key=key,
            data=payload
        )
        db.session.add(cache_entry)
        db.session.commit()
        
        return jsonify({'ok': True, 'key': key})
    except Exception as e:
        db.session.rollback()
        print(f"Error storing product data: {e}")
        return jsonify({'error': 'Failed to store data'}), 500


@app.route('/get_product_data', methods=['GET'])
@login_required
def get_product_data():
    key = request.args.get('key')
    if not key:
        return jsonify({'error': 'Missing key'}), 400
    
    try:
        # Find cache entry
        cache_entry = ProductDataCache.query.filter_by(
            cache_key=key,
            user_id=current_user.id
        ).first()
        
        if not cache_entry:
            return jsonify({'error': 'Not found or expired'}), 404
        
        return jsonify(cache_entry.data)
    except Exception as e:
        print(f"Error retrieving product data: {e}")
        return jsonify({'error': 'Failed to retrieve data'}), 500


# Product search and comparison
@app.route('/find_products', methods=['POST'])
@login_required
def find_products():
    import time
    from datetime import datetime, timedelta
    import os

    # Get the API token from environment variable
    api_token = os.environ.get('KASSAL_API_TOKEN')
    if not api_token:
        return jsonify({'error': 'API token not configured'}), 500

    data = request.json or {}
    selected_categories = data.get('selected_categories', [])
    user_product = data.get('user_product')  # optional client-provided baseline product
    mode = data.get('mode', 'compare')  # 'compare' or 'explore'
    nutrition_unit = data.get('nutrition_unit', 'g')  # 'g' or 'ml'
    
    if not selected_categories:
        return jsonify({'error': 'No categories selected'}), 400
    
    # Check usage limits based on mode
    if mode == 'explore':
        if not current_user.can_explore():
            remaining = current_user.get_remaining_explores()
            if current_user.is_subscribed():
                return jsonify({'error': 'Unable to process request'}), 403
            else:
                return jsonify({
                    'error': 'Daily explore limit reached',
                    'message': f'Free users can explore 3 times per day. You have used all your explores for today. Upgrade to Premium for unlimited access!',
                    'remaining': remaining
                }), 429
        
        # Increment explore count
        current_user.increment_explore_count()
    elif mode == 'compare':
        if not current_user.can_compare():
            remaining = current_user.get_remaining_compares()
            if current_user.is_subscribed():
                return jsonify({'error': 'Unable to process request'}), 403
            else:
                return jsonify({
                    'error': 'Daily compare limit reached',
                    'message': f'Free users can compare 1 time per day. You have used your compare for today. Upgrade to Premium for unlimited access!',
                    'remaining': remaining
                }), 429
        
        # Increment compare count
        current_user.increment_compare_count()

    # Parameters for pagination and rate limiting
    page_size = 100  # Max allowed by API
    rate_limit = 60  # requests per minute
    rate_window = 60  # seconds
    request_timestamps = []
    
    # API headers
    headers = {
        'Authorization': f'Bearer {api_token}',
        'Accept': 'application/json'
    }

    all_products = []
    seen_products = set()  # To avoid duplicates by (EAN, store) combination

    # Expand selected categories to leaf category ids (so non-leaf selections include all sub-leaf categories)
    cats_flat = load_categories()
    expanded_category_ids: Dict[str, str] = {}  # leaf_id -> pretty name path (best effort)
    for category in selected_categories:
        cid = str(category['id'])
        leaf_ids = get_leaf_descendants(cats_flat, cid)
        # if nothing returned (unknown id), just include original id
        if not leaf_ids:
            leaf_ids = [cid]
        # try to compute a readable name for the group origin (fallback to provided name)
        origin_name = category.get('name') or find_category_path(cats_flat, cid) or str(cid)
        for lid in leaf_ids:
            expanded_category_ids[lid] = origin_name

    leaf_id_list = list(expanded_category_ids.keys())

    # Process each (leaf) category id
    for category_id in leaf_id_list:
        page = 1
        
        while True:
            # Rate limiting
            now = time.time()
            request_timestamps = [ts for ts in request_timestamps if now - ts < rate_window]
            if len(request_timestamps) >= rate_limit:
                sleep_time = rate_window - (now - request_timestamps[0])
                if sleep_time > 0:
                    time.sleep(sleep_time)
            
            # Make API request
            try:
                params = {
                    'category_id': int(category_id),  # API expects integer
                    'size': page_size,
                    'page': page
                }
                # Print the fully resolved GET URL for troubleshooting (copyable into Postman)
                prepared = requests.Request(
                    'GET', 'https://kassal.app/api/v1/products', params=params
                ).prepare()
                print(f"[GET] {prepared.url}")

                response = requests.get(
                    'https://kassal.app/api/v1/products',
                    headers=headers,
                    params=params
                )
                request_timestamps.append(time.time())
                
                if response.status_code != 200:
                    print(f"API error for category {category_id}: {response.status_code}")
                    break

                data = response.json()
                products = data.get('data', [])
                links = data.get('links', {})
                
                # Add current page products (including last page)
                for product in products:
                    ean = product.get('ean')
                    
                    # Get store info - API returns store as a single object (not array)
                    store = product.get('store')
                    if store and isinstance(store, dict):
                        store_name = store.get('name', 'Unknown')
                    else:
                        store_name = 'Unknown'
                    
                    # Create unique key combining EAN and store to allow same product from different stores
                    # If no EAN, use product ID to ensure uniqueness
                    if ean:
                        product_key = (ean, store_name)
                    else:
                        # Products without EAN are considered unique (use ID)
                        product_key = (product.get('id'), store_name)
                    
                    if product_key not in seen_products:
                        seen_products.add(product_key)
                        
                        # Filter by nutrition unit - only include products with matching weight_unit
                        product_weight_unit = product.get('weight_unit', '')
                        if product_weight_unit != nutrition_unit:
                            continue  # Skip products that don't match the selected unit
                        
                        # Get category info
                        categories = product.get('category', [])
                        category_names = [c.get('name') for c in categories if c.get('name')]
                        origin_name = expanded_category_ids.get(str(category_id))
                        category_path = ' > '.join(category_names) if category_names else origin_name
                        
                        all_products.append({
                            'id': product['id'],
                            'name': product['name'],
                            'ean': ean,
                            'brand': product.get('brand'),
                            'current_price': product.get('current_price'),
                            'current_unit_price': product.get('current_unit_price'),
                            'weight': product.get('weight'),
                            'weight_unit': product.get('weight_unit'),
                            'image': product.get('image'),
                            'url': product.get('url'),
                            'updated_at': product.get('updated_at'),  # Add last updated date
                            'nutrition': {
                                item['code']: {
                                    'amount': item['amount'],
                                    'unit': item['unit']
                                }
                                for item in product.get('nutrition', [])
                            },
                            'allergens': {
                                item['code']: item['contains']
                                for item in product.get('allergens', [])
                            },
                            'store': store_name,
                            'category_name': category_path,
                            'ingredients': product.get('ingredients'),
                            'description': product.get('description'),
                            'vendor': product.get('vendor')
                        })

                # Stop if no more products or no next page
                links = data.get('links', {})
                if not products or not links.get('next'):
                    break
                    
                page += 1

            except Exception as e:
                print(f"Error fetching products for category {category_id}: {e}")
                break

    # Group products by relevant properties for comparison
    product_matrix = {
        'products': all_products,
        'nutrition_codes': sorted(set(
            code
            for p in all_products
            for code in p['nutrition'].keys()
        )),
        'allergen_codes': sorted(set(
            code
            for p in all_products
            for code in p['allergens'].keys()
        )),
        'stores': sorted(set(
            p['store'] for p in all_products if p['store']
        )),
        'categories': [c.get('name') or find_category_path(cats_flat, c.get('id')) or str(c.get('id')) for c in selected_categories],
        'selected_categories': selected_categories,  # Keep original structure with IDs for saving
        'user_product': user_product,
        'nutrition_unit': nutrition_unit,  # Pass the selected unit to the comparison page
        'timestamp': datetime.now().isoformat()
    }
    print(f"Found {len(all_products)} unique products across {len(leaf_id_list)} leaf categories (from {len(selected_categories)} selections).")

    return jsonify(product_matrix)


# Price history endpoint: fetches price development per store for given product IDs
@app.route('/price_history', methods=['POST'])
@login_required
def price_history():
    api_token = os.environ.get('KASSAL_API_TOKEN')
    if not api_token:
        return jsonify({'error': 'API token not configured'}), 500

    data = request.json or {}
    product_ids = data.get('product_ids') or []
    if not isinstance(product_ids, list) or not product_ids:
        return jsonify({'series': {}})

    headers = {
        'Authorization': f'Bearer {api_token}',
        'Accept': 'application/json'
    }

    series: Dict[str, list] = {}
    for pid in product_ids:
        try:
            url = f'https://kassal.app/api/v1/products/{pid}'
            print(f"[GET] {url}")
            resp = requests.get(url, headers=headers)
            if resp.status_code != 200:
                continue
            body = resp.json()
            # Try common shapes to find price history
            product = body.get('data') if isinstance(body, dict) else None
            if not product:
                product = body if isinstance(body, dict) else None

            # Get store name from root when history items lack it
            store_name_root = None
            try:
                s = product.get('store') if isinstance(product, dict) else None
                if isinstance(s, dict):
                    store_name_root = s.get('name') or s.get('store')
                elif isinstance(s, str):
                    store_name_root = s
            except Exception:
                store_name_root = None

            history_lists = []
            if product:
                if isinstance(product.get('prices'), list):
                    history_lists.append(product['prices'])
                if isinstance(product.get('price_history'), list):
                    history_lists.append(product['price_history'])
                if isinstance(product.get('priceHistory'), list):
                    history_lists.append(product['priceHistory'])

            for hist in history_lists:
                for item in hist:
                    price = item.get('price') or item.get('amount') or item.get('value')
                    dt = item.get('date') or item.get('created_at') or item.get('updated_at') or item.get('timestamp')
                    # Extract store name
                    store_obj = item.get('store') if isinstance(item, dict) else None
                    store_name = None
                    if isinstance(store_obj, dict):
                        store_name = store_obj.get('name') or store_obj.get('store')
                    if not store_name:
                        store_name = item.get('store') if isinstance(item, dict) else None
                    if not store_name:
                        store_name = store_name_root
                    if store_name and price is not None and dt:
                        series.setdefault(store_name, []).append({'date': str(dt)[:10], 'price': float(price)})
        except Exception as e:
            print(f"Error fetching price history for product {pid}: {e}")
            continue

    # Sort by date and collapse duplicates per date/store by last value
    for store, pts in series.items():
        pts.sort(key=lambda x: x['date'])
        collapsed = {}
        for pt in pts:
            collapsed[pt['date']] = pt['price']
        series[store] = [{'date': d, 'price': p} for d, p in sorted(collapsed.items())]

    return jsonify({'series': series})


# ============================
# One-Time Migration Endpoint (DELETE AFTER FIRST USE)
# ============================
@app.route('/create-product-cache-table-migration-xyz123')
def create_product_cache_table():
    """
    ONE-TIME MIGRATION: Creates the ProductDataCache table.
    Visit this URL once, then DELETE this route from the code.
    """
    try:
        with app.app_context():
            # Create the table if it doesn't exist
            ProductDataCache.__table__.create(db.engine, checkfirst=True)
            return jsonify({
                'success': True, 
                'message': 'ProductDataCache table created successfully! You can now delete this endpoint from app.py'
            })
    except Exception as e:
        return jsonify({
            'success': False, 
            'error': str(e)
        }), 500


# ============================
# Main
# ============================
if __name__ == '__main__':
    static_path = os.path.join(os.path.dirname(__file__), 'static', 'categories.csv')
    if not os.path.exists(static_path):
        print(f"[WARN] Expected taxonomy at {static_path} (headers: id,parent_id,name)")
    # Allow overriding port via PORT env var; default to 5050 to avoid 5000 conflicts
    port = int(os.environ.get('PORT', '5050'))
    print(f"Starting server at http://127.0.0.1:{port} (debug=True)")
    app.run(debug=True, port=port)
