"""Baseline: create core tables (safe)

Revision ID: b7d0f1a2c3d4
Revises: 
Create Date: 2025-12-29

This migration is intentionally written to be safe to run against an existing
production database that may have been created via db.create_all().

- If tables already exist, it will not recreate them.
- It creates tables using the current model schema as a baseline.

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7d0f1a2c3d4'
down_revision = None
branch_labels = None
depends_on = None


def _get_existing_columns(inspector: sa.Inspector, table_name: str) -> set[str]:
    try:
        return {c['name'] for c in inspector.get_columns(table_name)}
    except Exception:
        return set()


def _ensure_index(inspector: sa.Inspector, table: str, index_name: str, columns: list[str], unique: bool = False) -> None:
    existing = {idx.get('name') for idx in inspector.get_indexes(table)}
    existing |= {uc.get('name') for uc in inspector.get_unique_constraints(table)}
    if index_name in existing:
        return
    op.create_index(index_name, table, columns, unique=unique)


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if 'users' not in existing_tables:
        op.create_table(
            'users',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('email', sa.String(length=120), nullable=False, unique=True),
            sa.Column('password_hash', sa.String(length=200), nullable=False),
            sa.Column('name', sa.String(length=100), nullable=True),
            sa.Column('phone_number', sa.String(length=20), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('is_admin', sa.Boolean(), nullable=True, server_default=sa.text('false')),
            sa.Column('is_verified', sa.Boolean(), nullable=True, server_default=sa.text('false')),
            sa.Column('verification_code', sa.String(length=6), nullable=True),
            sa.Column('verification_code_expires', sa.DateTime(), nullable=True),
            sa.Column('subscription_status', sa.String(length=20), nullable=True, server_default=sa.text("'free'")),
            sa.Column('subscription_end_date', sa.DateTime(), nullable=True),
            sa.Column('stripe_customer_id', sa.String(length=100), nullable=True),
            sa.Column('theme', sa.String(length=10), nullable=False, server_default=sa.text("'light'")),
            sa.Column('explore_count', sa.Integer(), nullable=True, server_default=sa.text('0')),
            sa.Column('last_explore_date', sa.Date(), nullable=True),
            sa.Column('compare_count', sa.Integer(), nullable=True, server_default=sa.text('0')),
            sa.Column('last_compare_date', sa.Date(), nullable=True),
        )
        _ensure_index(inspector, 'users', 'ix_users_email', ['email'], unique=False)
    else:
        # No-op for existing table; later migrations handle adding missing columns.
        pass

    if 'saved_searches' not in existing_tables:
        op.create_table(
            'saved_searches',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('name', sa.String(length=200), nullable=False),
            sa.Column('selected_categories', sa.JSON(), nullable=False),
            sa.Column('user_product_data', sa.JSON(), nullable=True),
            sa.Column('mode', sa.String(length=20), nullable=True, server_default=sa.text("'compare'")),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('last_accessed', sa.DateTime(), nullable=True),
        )

    if 'shared_comparisons' not in existing_tables:
        op.create_table(
            'shared_comparisons',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('token', sa.String(length=32), nullable=False, unique=True),
            sa.Column('comparison_data', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('view_count', sa.Integer(), nullable=True, server_default=sa.text('0')),
            sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        )
        _ensure_index(inspector, 'shared_comparisons', 'ix_shared_comparisons_token', ['token'], unique=True)

    if 'product_data_cache' not in existing_tables:
        op.create_table(
            'product_data_cache',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('cache_key', sa.String(length=32), nullable=False, unique=True),
            sa.Column('data', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        _ensure_index(inspector, 'product_data_cache', 'ix_product_data_cache_cache_key', ['cache_key'], unique=True)


def downgrade():
    # Downgrade intentionally drops tables only if they exist.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if 'product_data_cache' in existing_tables:
        op.drop_table('product_data_cache')
    if 'shared_comparisons' in existing_tables:
        op.drop_table('shared_comparisons')
    if 'saved_searches' in existing_tables:
        op.drop_table('saved_searches')
    if 'users' in existing_tables:
        op.drop_table('users')
