"""Initial schema

Revision ID: 1f0c2d3e4a5b
Revises:
Create Date: 2025-12-29

This is a fresh baseline migration for a new Railway staging/prod setup.
It creates the current core tables using Alembic so deploys can reliably run
`flask --app app.app:app db upgrade` without manual one-off scripts.

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1f0c2d3e4a5b'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(length=120), nullable=False),
        sa.Column('password_hash', sa.String(length=200), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=True),
        sa.Column('phone_number', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('verification_code', sa.String(length=6), nullable=True),
        sa.Column('verification_code_expires', sa.DateTime(), nullable=True),
        sa.Column('subscription_status', sa.String(length=20), nullable=False, server_default=sa.text("'free'")),
        sa.Column('subscription_end_date', sa.DateTime(), nullable=True),
        sa.Column('stripe_customer_id', sa.String(length=100), nullable=True),
        sa.Column('theme', sa.String(length=10), nullable=False, server_default=sa.text("'light'")),
        sa.Column('explore_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('last_explore_date', sa.Date(), nullable=True),
        sa.Column('compare_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('last_compare_date', sa.Date(), nullable=True),
        sa.UniqueConstraint('email', name='uq_users_email'),
    )
    op.create_index('ix_users_email', 'users', ['email'])

    op.create_table(
        'saved_searches',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('selected_categories', sa.JSON(), nullable=False),
        sa.Column('user_product_data', sa.JSON(), nullable=True),
        sa.Column('mode', sa.String(length=20), nullable=False, server_default=sa.text("'compare'")),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('last_accessed', sa.DateTime(), nullable=True),
    )

    op.create_table(
        'shared_comparisons',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('token', sa.String(length=32), nullable=False),
        sa.Column('comparison_data', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('view_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.UniqueConstraint('token', name='uq_shared_comparisons_token'),
    )
    op.create_index('ix_shared_comparisons_token', 'shared_comparisons', ['token'])

    op.create_table(
        'product_data_cache',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('cache_key', sa.String(length=32), nullable=False),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('cache_key', name='uq_product_data_cache_cache_key'),
    )
    op.create_index('ix_product_data_cache_cache_key', 'product_data_cache', ['cache_key'])


def downgrade():
    op.drop_index('ix_product_data_cache_cache_key', table_name='product_data_cache')
    op.drop_table('product_data_cache')

    op.drop_index('ix_shared_comparisons_token', table_name='shared_comparisons')
    op.drop_table('shared_comparisons')

    op.drop_table('saved_searches')

    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
