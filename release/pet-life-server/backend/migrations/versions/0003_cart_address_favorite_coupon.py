"""Add cart, address, favorite and coupon tables.

Revision ID: 0003_customer_data
Revises: 0002_auth_categories
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_customer_data"
down_revision: str | Sequence[str] | None = "0002_auth_categories"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cart_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "product_id", name="uq_cart_user_product"),
    )
    op.create_index("ix_cart_items_user_id", "cart_items", ["user_id"])
    op.create_index("ix_cart_items_product_id", "cart_items", ["product_id"])

    op.create_table(
        "addresses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("receiver_name", sa.String(length=40), nullable=False),
        sa.Column("phone", sa.String(length=30), nullable=False),
        sa.Column("province", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("city", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("district", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("detail", sa.String(length=240), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_addresses_user_id", "addresses", ["user_id"])
    op.create_index("ix_addresses_is_default", "addresses", ["is_default"])

    op.create_table(
        "favorites",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "product_id", name="uq_favorite_user_product"),
    )
    op.create_index("ix_favorites_user_id", "favorites", ["user_id"])
    op.create_index("ix_favorites_product_id", "favorites", ["product_id"])

    op.create_table(
        "coupons",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("threshold_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("discount_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("start_at", sa.DateTime(), nullable=False),
        sa.Column("end_at", sa.DateTime(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_coupons_enabled", "coupons", ["enabled"])

    op.create_table(
        "user_coupons",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("coupon_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="AVAILABLE"),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("received_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["coupon_id"], ["coupons.id"]),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_coupons_user_id", "user_coupons", ["user_id"])
    op.create_index("ix_user_coupons_coupon_id", "user_coupons", ["coupon_id"])
    op.create_index("ix_user_coupons_order_id", "user_coupons", ["order_id"])
    op.create_index("ix_user_coupons_status", "user_coupons", ["status"])


def downgrade() -> None:
    op.drop_table("user_coupons")
    op.drop_table("coupons")
    op.drop_table("favorites")
    op.drop_table("addresses")
    op.drop_table("cart_items")
