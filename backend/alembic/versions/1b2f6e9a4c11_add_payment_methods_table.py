"""add_payment_methods_table

Revision ID: 1b2f6e9a4c11
Revises: 07b46adc4afc
Create Date: 2026-03-16 02:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '1b2f6e9a4c11'
down_revision: Union[str, None] = '07b46adc4afc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'payment_methods',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('provider_name', sa.String(length=50), nullable=False),
        sa.Column('payment_type', sa.String(length=30), nullable=False),
        sa.Column('masked_reference', sa.String(length=100), nullable=True),
        sa.Column('token_reference', sa.String(length=255), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_payment_methods_user_id', 'payment_methods', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_payment_methods_user_id', table_name='payment_methods')
    op.drop_table('payment_methods')
