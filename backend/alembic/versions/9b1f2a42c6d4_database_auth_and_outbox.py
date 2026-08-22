"""database auth and outbox

Revision ID: 9b1f2a42c6d4
Revises: 508aac2de30d
Create Date: 2026-08-20 14:05:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b1f2a42c6d4"
down_revision: Union[str, None] = "508aac2de30d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("wechat_openid", sa.String(length=128), nullable=True))
    op.add_column("users", sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("users", sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()))
    op.add_column("users", sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()))
    op.create_unique_constraint("uq_users_wechat_openid", "users", ["wechat_openid"])
    op.execute("UPDATE payments SET provider='MANUAL' WHERE provider='MOCK'")
    op.execute("UPDATE notification_outbox SET status='PENDING' WHERE status='MOCKED'")


def downgrade() -> None:
    op.drop_constraint("uq_users_wechat_openid", "users", type_="unique")
    op.drop_column("users", "updated_at")
    op.drop_column("users", "created_at")
    op.drop_column("users", "enabled")
    op.drop_column("users", "wechat_openid")
    op.drop_column("users", "password_hash")
