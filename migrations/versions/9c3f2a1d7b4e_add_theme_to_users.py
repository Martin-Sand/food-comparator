"""Add theme preference to users

Revision ID: 9c3f2a1d7b4e
Revises: a11f6c25b7ac
Create Date: 2025-12-28

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9c3f2a1d7b4e'
down_revision = 'a11f6c25b7ac'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c['name'] for c in inspector.get_columns('users')}

    if 'theme' in existing_cols:
        return

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('theme', sa.String(length=10), nullable=False, server_default='light'))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c['name'] for c in inspector.get_columns('users')}

    if 'theme' not in existing_cols:
        return

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('theme')
