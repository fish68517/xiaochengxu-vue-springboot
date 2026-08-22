"""Create initial mall and admin tables.

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-17
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("subtitle", sa.String(length=120), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("original_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("sales", sa.Integer(), nullable=False),
        sa.Column("stock", sa.Integer(), nullable=False),
        sa.Column("image_key", sa.String(length=30), nullable=False),
        sa.Column("badge", sa.String(length=20), nullable=True),
        sa.Column("tags", sa.String(length=200), nullable=False),
        sa.Column("species", sa.String(length=60), nullable=True),
        sa.Column("age", sa.String(length=60), nullable=True),
        sa.Column("health", sa.String(length=60), nullable=True),
        sa.Column("size", sa.String(length=60), nullable=True),
        sa.Column("gender", sa.String(length=60), nullable=True),
        sa.Column("care_advice", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_products_name", "products", ["name"])
    op.create_index("ix_products_category", "products", ["category"])
    op.create_index("ix_products_is_active", "products", ["is_active"])

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nickname", sa.String(length=60), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("coupons", sa.Integer(), nullable=False),
        sa.Column("favorites", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "lottery_activities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("subtitle", sa.String(length=160), nullable=False),
        sa.Column("registration_start_at", sa.DateTime(), nullable=False),
        sa.Column("registration_end_at", sa.DateTime(), nullable=False),
        sa.Column("draw_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("participant_count", sa.Integer(), nullable=False),
        sa.Column("prizes_json", sa.Text(), nullable=False),
        sa.Column("rules_json", sa.Text(), nullable=False),
        sa.Column("winners_json", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_lottery_activities_status", "lottery_activities", ["status"])

    op.create_table(
        "lottery_participants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("activity_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("joined_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["activity_id"], ["lottery_activities.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("activity_id", "user_id", name="uq_activity_user"),
    )
    op.create_index("ix_lottery_participants_activity_id", "lottery_participants", ["activity_id"])
    op.create_index("ix_lottery_participants_user_id", "lottery_participants", ["user_id"])

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_no", sa.String(length=40), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("product_name", sa.String(length=80), nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("discount", sa.Numeric(10, 2), nullable=False),
        sa.Column("shipping_fee", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("address_name", sa.String(length=40), nullable=False),
        sa.Column("address_phone", sa.String(length=30), nullable=False),
        sa.Column("address_detail", sa.String(length=240), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("shipping_company", sa.String(length=60), nullable=True),
        sa.Column("tracking_no", sa.String(length=80), nullable=True),
        sa.Column("shipped_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_orders_order_no", "orders", ["order_no"], unique=True)
    op.create_index("ix_orders_product_id", "orders", ["product_id"])
    op.create_index("ix_orders_user_id", "orders", ["user_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("operator", sa.String(length=60), nullable=False),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("resource_type", sa.String(length=50), nullable=False),
        sa.Column("resource_id", sa.String(length=60), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_operator", "audit_logs", ["operator"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_resource_type", "audit_logs", ["resource_type"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("orders")
    op.drop_table("lottery_participants")
    op.drop_table("lottery_activities")
    op.drop_table("users")
    op.drop_table("products")
