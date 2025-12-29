"""Add name and phone_number to users

Revision ID: 3028734f938c
Revises: 
Create Date: 2025-11-14 22:21:55.162666

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3028734f938c'
down_revision = 'b7d0f1a2c3d4'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c['name'] for c in inspector.get_columns('users')}

    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'name' not in existing_cols:
            batch_op.add_column(sa.Column('name', sa.String(length=100), nullable=True))
        if 'phone_number' not in existing_cols:
            batch_op.add_column(sa.Column('phone_number', sa.String(length=20), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c['name'] for c in inspector.get_columns('users')}

    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'phone_number' in existing_cols:
            batch_op.drop_column('phone_number')
        if 'name' in existing_cols:
            batch_op.drop_column('name')
