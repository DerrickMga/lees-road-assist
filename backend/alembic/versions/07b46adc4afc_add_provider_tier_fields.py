"""add_provider_tier_fields

Revision ID: 07b46adc4afc
Revises: 
Create Date: 2026-03-15 20:44:56.103046

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '07b46adc4afc'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the new enum type first (PostgreSQL requires explicit enum creation)
    providertier_enum = sa.Enum('bronze', 'silver', 'gold', 'platinum', name='providertier')
    providertier_enum.create(op.get_bind(), checkfirst=True)

    op.add_column('provider_profiles', sa.Column(
        'tier', sa.Enum('bronze', 'silver', 'gold', 'platinum', name='providertier'),
        nullable=False, server_default='bronze'
    ))
    op.add_column('provider_profiles', sa.Column(
        'max_active_jobs', sa.Integer(), nullable=False, server_default='5'
    ))
    op.add_column('provider_profiles', sa.Column(
        'service_radius_km', sa.Float(), nullable=False, server_default='50.0'
    ))


def downgrade() -> None:
    op.drop_column('provider_profiles', 'service_radius_km')
    op.drop_column('provider_profiles', 'max_active_jobs')
    op.drop_column('provider_profiles', 'tier')
    sa.Enum(name='providertier').drop(op.get_bind(), checkfirst=True)
