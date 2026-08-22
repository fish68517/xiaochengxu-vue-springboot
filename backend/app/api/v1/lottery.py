from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_current_user, get_optional_user
from app.db.session import get_db
from app.models.entities import (
    LotteryActivity,
    LotteryParticipant,
    LotteryPrize,
    LotteryWinner,
    User,
)
from app.schemas.api import JoinOut, LotteryActivityOut, LotteryResultOut
from app.services.serializers import activity_out, activity_prizes

router = APIRouter(prefix="/lottery/activities", tags=["抽奖活动"])


@router.get("/current", response_model=LotteryActivityOut)
def current_activity(
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> LotteryActivityOut:
    now = datetime.now()
    activity = db.scalar(
        select(LotteryActivity)
        .where(
            LotteryActivity.status == "REGISTERING",
            LotteryActivity.registration_start_at <= now,
            LotteryActivity.registration_end_at >= now,
        )
        .order_by(LotteryActivity.registration_start_at.desc(), LotteryActivity.id.desc())
    )
    if activity is None:
        activity = db.scalar(
            select(LotteryActivity)
            .where(LotteryActivity.status.in_(["PUBLISHED", "REGISTERING"]))
            .order_by(LotteryActivity.registration_start_at.desc(), LotteryActivity.id.desc())
        )
    if activity is None:
        raise HTTPException(status_code=404, detail={"message": "当前没有可用活动"})
    return activity_out(db, activity, current_user.id if current_user else None)


@router.get("/{activity_id}", response_model=LotteryActivityOut)
def get_activity(
    activity_id: int,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> LotteryActivityOut:
    activity = db.get(LotteryActivity, activity_id)
    if activity is None:
        raise HTTPException(status_code=404, detail={"message": "活动不存在"})
    return activity_out(db, activity, current_user.id if current_user else None)


@router.post("/{activity_id}/join", response_model=JoinOut)
def join_activity(
    activity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JoinOut:
    activity = db.scalar(
        select(LotteryActivity).where(LotteryActivity.id == activity_id).with_for_update()
    )
    if activity is None:
        raise HTTPException(status_code=404, detail={"message": "活动不存在"})
    now = datetime.now()
    if (
        activity.status != "REGISTERING"
        or now < activity.registration_start_at
        or now > activity.registration_end_at
    ):
        raise HTTPException(status_code=409, detail={"message": "活动当前不能报名"})
    existing = db.scalar(
        select(LotteryParticipant.id).where(
            LotteryParticipant.activity_id == activity_id,
            LotteryParticipant.user_id == current_user.id,
        )
    )
    if existing is not None:
        count = (
            db.scalar(
                select(func.count(LotteryParticipant.id)).where(
                    LotteryParticipant.activity_id == activity_id
                )
            )
            or 0
        )
        return JoinOut(
            joined=True,
            already_joined=True,
            participant_count=count,
            message="您已报名",
        )
    db.add(LotteryParticipant(activity_id=activity_id, user_id=current_user.id))
    try:
        db.flush()
        count = (
            db.scalar(
                select(func.count(LotteryParticipant.id)).where(
                    LotteryParticipant.activity_id == activity_id
                )
            )
            or 0
        )
        activity.participant_count = count
        db.commit()
    except IntegrityError:
        db.rollback()
        count = (
            db.scalar(
                select(func.count(LotteryParticipant.id)).where(
                    LotteryParticipant.activity_id == activity_id
                )
            )
            or 0
        )
        return JoinOut(
            joined=True,
            already_joined=True,
            participant_count=count,
            message="您已报名",
        )
    return JoinOut(
        joined=True,
        already_joined=False,
        participant_count=count,
        message="报名成功",
    )


@router.get("/{activity_id}/result", response_model=LotteryResultOut)
def lottery_result(
    activity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LotteryResultOut:
    activity = db.get(LotteryActivity, activity_id)
    if activity is None:
        raise HTTPException(status_code=404, detail={"message": "活动不存在"})
    count = (
        db.scalar(
            select(func.count(LotteryParticipant.id)).where(
                LotteryParticipant.activity_id == activity_id
            )
        )
        or 0
    )
    rows = db.execute(
        select(LotteryWinner, User, LotteryPrize)
        .join(User, User.id == LotteryWinner.user_id)
        .join(LotteryPrize, LotteryPrize.id == LotteryWinner.prize_id)
        .where(LotteryWinner.activity_id == activity_id)
        .order_by(LotteryPrize.sort_order, LotteryWinner.id)
    ).all()
    winners = [
        {
            "nickname": user.nickname,
            "level": prize.level_name,
            "prize": prize.prize_name,
        }
        for _, user, prize in rows
    ]
    my_winner = next((row for row in rows if row[0].user_id == current_user.id), None)
    my_result = (
        {
            "won": True,
            "message": "恭喜中奖",
            "prize": my_winner[2].prize_name,
            "points": 0,
        }
        if my_winner
        else {"won": False, "message": "未中奖", "points": 0}
    )
    return LotteryResultOut(
        activity_id=activity.id,
        title=activity.title,
        status=activity.status,
        draw_at=activity.draw_at,
        participant_count=count,
        my_result=my_result,
        winners=winners,
        prizes=activity_prizes(db, activity.id),
    )
