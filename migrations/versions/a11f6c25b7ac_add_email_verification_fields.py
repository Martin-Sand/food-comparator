"""Add email verification fields

Revision ID: a11f6c25b7ac
Revises: 3028734f938c
Create Date: 2025-11-14 23:03:03.535458

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a11f6c25b7ac'
down_revision = '3028734f938c'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c['name'] for c in inspector.get_columns('users')}

    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'is_verified' not in existing_cols:
            batch_op.add_column(sa.Column('is_verified', sa.Boolean(), nullable=True))
        if 'verification_code' not in existing_cols:
            batch_op.add_column(sa.Column('verification_code', sa.String(length=6), nullable=True))
        if 'verification_code_expires' not in existing_cols:
            batch_op.add_column(sa.Column('verification_code_expires', sa.DateTime(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c['name'] for c in inspector.get_columns('users')}

    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'verification_code_expires' in existing_cols:
            batch_op.drop_column('verification_code_expires')
        if 'verification_code' in existing_cols:
            batch_op.drop_column('verification_code')
        if 'is_verified' in existing_cols:
            batch_op.drop_column('is_verified')
