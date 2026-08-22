"""Add database authentication and product categories.

Revision ID: 0002_auth_categories
Revises: 0001_initial
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_auth_categories"
down_revision: str | Sequence[str] | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "product_categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=30), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_product_categories_name", "product_categories", ["name"])
    op.create_index("ix_product_categories_enabled", "product_categories", ["enabled"])

    op.add_column("products", sa.Column("category_id", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("cover_url", sa.String(length=500), nullable=True))
    op.add_column("products", sa.Column("detail_images_json", sa.Text(), nullable=True))
    op.add_column(
        "products", sa.Column("version", sa.Integer(), nullable=False, server_default="1")
    )
    op.add_column(
        "products",
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.add_column(
        "products",
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_products_category_id", "products", ["category_id"])
    op.create_foreign_key(
        "fk_products_category_id", "products", "product_categories", ["category_id"], ["id"]
    )

    connection = op.get_bind()
    connection.execute(sa.text("UPDATE products SET detail_images_json='[]'"))
    op.alter_column("products", "detail_images_json", existing_type=sa.Text(), nullable=False)
    category_rows = connection.execute(
        sa.text(
            "SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category"
        )
    ).all()
    for sort_order, row in enumerate(category_rows, start=1):
        connection.execute(
            sa.text(
                "INSERT INTO product_categories(name, sort_order, enabled) "
                "VALUES (:name, :sort_order, 1)"
            ),
            {"name": row[0], "sort_order": sort_order},
        )
    connection.execute(
        sa.text(
            "UPDATE products p JOIN product_categories c ON c.name=p.category "
            "SET p.category_id=c.id"
        )
    )

    op.add_column("users", sa.Column("username", sa.String(length=60), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))
    op.add_column(
        "users", sa.Column("role", sa.String(length=20), nullable=False, server_default="USER")
    )
    op.add_column(
        "users", sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true())
    )
    op.add_column("users", sa.Column("wechat_openid", sa.String(length=128), nullable=True))
    op.add_column(
        "users",
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.add_column(
        "users",
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    connection.execute(
        sa.text(
            "UPDATE users SET username=CONCAT('user', id), password_hash='', role='USER' "
            "WHERE username IS NULL"
        )
    )
    op.alter_column("users", "username", existing_type=sa.String(length=60), nullable=False)
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=False)
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_enabled", "users", ["enabled"])
    op.create_index("uq_users_wechat_openid", "users", ["wechat_openid"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_users_wechat_openid", table_name="users")
    op.drop_index("ix_users_enabled", table_name="users")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    for column in (
        "updated_at",
        "created_at",
        "wechat_openid",
        "enabled",
        "role",
        "password_hash",
        "username",
    ):
        op.drop_column("users", column)
    op.drop_constraint("fk_products_category_id", "products", type_="foreignkey")
    op.drop_index("ix_products_category_id", table_name="products")
    for column in (
        "updated_at",
        "created_at",
        "version",
        "detail_images_json",
        "cover_url",
        "category_id",
    ):
        op.drop_column("products", column)
    op.drop_table("product_categories")
