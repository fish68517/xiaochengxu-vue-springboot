"""Normalize lottery prizes and winners; remove seeded counts.

Revision ID: 0005_lottery_real_data
Revises: 0004_order_payment
"""

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_lottery_real_data"
down_revision: str | Sequence[str] | None = "0004_order_payment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "lottery_prizes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("activity_id", sa.Integer(), nullable=False),
        sa.Column("level_name", sa.String(length=40), nullable=False),
        sa.Column("prize_name", sa.String(length=100), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["activity_id"], ["lottery_activities.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_lottery_prizes_activity_id", "lottery_prizes", ["activity_id"])

    op.create_table(
        "lottery_winners",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("activity_id", sa.Integer(), nullable=False),
        sa.Column("participant_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("prize_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["activity_id"], ["lottery_activities.id"]),
        sa.ForeignKeyConstraint(["participant_id"], ["lottery_participants.id"]),
        sa.ForeignKeyConstraint(["prize_id"], ["lottery_prizes.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("activity_id", "participant_id", name="uq_winner_activity_participant"),
    )
    op.create_index("ix_lottery_winners_activity_id", "lottery_winners", ["activity_id"])
    op.create_index("ix_lottery_winners_participant_id", "lottery_winners", ["participant_id"])
    op.create_index("ix_lottery_winners_user_id", "lottery_winners", ["user_id"])
    op.create_index("ix_lottery_winners_prize_id", "lottery_winners", ["prize_id"])

    connection = op.get_bind()
    activities = connection.execute(
        sa.text("SELECT id, prizes_json FROM lottery_activities ORDER BY id")
    ).all()
    for activity_id, prizes_json in activities:
        try:
            prizes = json.loads(prizes_json or "[]")
        except json.JSONDecodeError:
            prizes = []
        for sort_order, prize in enumerate(prizes, start=1):
            connection.execute(
                sa.text(
                    "INSERT INTO lottery_prizes"
                    "(activity_id,level_name,prize_name,quantity,sort_order) "
                    "VALUES (:activity_id,:level_name,:prize_name,:quantity,:sort_order)"
                ),
                {
                    "activity_id": activity_id,
                    "level_name": str(prize.get("level", "奖项"))[:40],
                    "prize_name": str(prize.get("name", "奖品"))[:100],
                    "quantity": max(0, int(prize.get("quantity", 0))),
                    "sort_order": sort_order,
                },
            )
    connection.execute(
        sa.text(
            "UPDATE lottery_activities a SET participant_count="
            "(SELECT COUNT(*) FROM lottery_participants p WHERE p.activity_id=a.id), "
            "winners_json='[]'"
        )
    )
    connection.execute(
        sa.text(
            "UPDATE lottery_activities SET status='CLOSED' "
            "WHERE status='DRAWN' AND participant_count=0"
        )
    )


def downgrade() -> None:
    op.drop_table("lottery_winners")
    op.drop_table("lottery_prizes")
