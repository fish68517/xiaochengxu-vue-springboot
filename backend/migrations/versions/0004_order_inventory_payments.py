"""Add order items, inventory records and payments.

Revision ID: 0004_order_payment
Revises: 0003_customer_data
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_order_payment"
down_revision: str | Sequence[str] | None = "0003_customer_data"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("coupon_id", sa.Integer(), nullable=True))
    op.add_column(
        "orders",
        sa.Column("payment_status", sa.String(length=20), nullable=False, server_default="UNPAID"),
    )
    op.add_column("orders", sa.Column("remark", sa.String(length=300), nullable=True))
    op.add_column(
        "orders",
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.add_column("orders", sa.Column("cancelled_at", sa.DateTime(), nullable=True))
    op.add_column("orders", sa.Column("completed_at", sa.DateTime(), nullable=True))
    op.create_index("ix_orders_status", "orders", ["status"])
    op.create_index("ix_orders_payment_status", "orders", ["payment_status"])

    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("product_name", sa.String(length=80), nullable=False),
        sa.Column("product_image_url", sa.String(length=500), nullable=True),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("line_amount", sa.Numeric(10, 2), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"])
    op.create_index("ix_order_items_product_id", "order_items", ["product_id"])

    op.create_table(
        "inventory_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("change_quantity", sa.Integer(), nullable=False),
        sa.Column("before_stock", sa.Integer(), nullable=False),
        sa.Column("after_stock", sa.Integer(), nullable=False),
        sa.Column("business_type", sa.String(length=30), nullable=False),
        sa.Column("business_id", sa.String(length=60), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventory_records_product_id", "inventory_records", ["product_id"])
    op.create_index("ix_inventory_records_business_type", "inventory_records", ["business_type"])
    op.create_index("ix_inventory_records_business_id", "inventory_records", ["business_id"])

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("payment_no", sa.String(length=50), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False, server_default="MANUAL"),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
        sa.Column("provider_transaction_id", sa.String(length=100), nullable=True),
        sa.Column("confirmed_by", sa.Integer(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["confirmed_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("payment_no"),
        sa.UniqueConstraint("provider_transaction_id"),
    )
    op.create_index("ix_payments_payment_no", "payments", ["payment_no"], unique=True)
    op.create_index("ix_payments_order_id", "payments", ["order_id"])
    op.create_index("ix_payments_status", "payments", ["status"])

    connection = op.get_bind()
    connection.execute(
        sa.text(
            "INSERT INTO order_items"
            "(order_id,product_id,product_name,unit_price,quantity,line_amount) "
            "SELECT id,product_id,product_name,unit_price,quantity,unit_price*quantity FROM orders"
        )
    )
    connection.execute(
        sa.text(
            "UPDATE orders SET payment_status='PAID' WHERE status IN ('PAID','SHIPPED','COMPLETED')"
        )
    )
    connection.execute(
        sa.text(
            "INSERT INTO payments(payment_no,order_id,provider,amount,status,confirmed_at) "
            "SELECT CONCAT('HISTORY-',order_no),id,'MANUAL',total_amount,'SUCCESS',paid_at "
            "FROM orders WHERE status IN ('PAID','SHIPPED','COMPLETED')"
        )
    )


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("inventory_records")
    op.drop_table("order_items")
    op.drop_index("ix_orders_payment_status", table_name="orders")
    op.drop_index("ix_orders_status", table_name="orders")
    for column in (
        "completed_at",
        "cancelled_at",
        "updated_at",
        "remark",
        "payment_status",
        "coupon_id",
    ):
        op.drop_column("orders", column)
