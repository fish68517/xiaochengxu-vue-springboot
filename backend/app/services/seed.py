import json
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import LotteryActivity, Product, User

PRODUCTS = [
    dict(
        name="巴西龟（幼龟）",
        category="爬宠",
        subtitle="活泼好养 · 新手推荐",
        price=Decimal("39"),
        original_price=Decimal("49"),
        sales=523,
        stock=86,
        image_key="turtle",
        badge="热卖",
        tags="活泼好养,新手优选,健康保证",
        species="巴西龟（Trachemys scripta）",
        age="幼龟（3-6个月）",
        health="健康活泼",
        size="3-5cm",
        gender="随机发货",
        care_advice="水深2-3cm / 水温24-28℃ / 晒龟粮+虾干，每2-3天换水一次",
    ),
    dict(
        name="草龟（幼龟）",
        category="爬宠",
        subtitle="耐养皮实 · 健康活泼",
        price=Decimal("59"),
        original_price=Decimal("69"),
        sales=8432,
        stock=52,
        image_key="turtle-dark",
        badge="人气",
        tags="耐养皮实,健康活泼",
        species="中华草龟",
        age="幼龟（4-8个月）",
        health="健康活泼",
        size="4-6cm",
        gender="随机发货",
        care_advice="浅水饲养并设置晒台，保持水质清洁",
    ),
    dict(
        name="荷兰垂耳兔",
        category="爬宠",
        subtitle="温顺亲人 · 疫苗已打",
        price=Decimal("199"),
        original_price=Decimal("239"),
        sales=4567,
        stock=18,
        image_key="rabbit",
        badge="新品",
        tags="温顺亲人,疫苗已打",
        species="荷兰垂耳兔",
        age="幼年（2-3个月）",
        health="疫苗已完成",
        size="小型",
        gender="可选",
        care_advice="每日提供干草和清洁饮水，保持笼舍干燥",
    ),
    dict(
        name="侏儒兔",
        category="爬宠",
        subtitle="迷你可爱 · 容易饲养",
        price=Decimal("169"),
        original_price=Decimal("199"),
        sales=7120,
        stock=23,
        image_key="rabbit-brown",
        badge="热卖",
        tags="迷你可爱,容易饲养",
        species="侏儒兔",
        age="幼年（2-3个月）",
        health="健康活泼",
        size="迷你型",
        gender="可选",
        care_advice="避免高温，定时喂食提摩西草",
    ),
    dict(
        name="乌龟粮 250g",
        category="用品",
        subtitle="营养均衡 · 助消化",
        price=Decimal("19.90"),
        original_price=Decimal("29.90"),
        sales=26000,
        stock=320,
        image_key="food",
        badge="热卖",
        tags="营养均衡,助消化",
        species=None,
        age=None,
        health=None,
        size="250g",
        gender=None,
        care_advice="密封存放，每日按体重适量投喂",
    ),
    dict(
        name="龟缸套装（中号）",
        category="套餐",
        subtitle="造景美观 · 全套齐全",
        price=Decimal("129"),
        original_price=Decimal("159"),
        sales=2863,
        stock=45,
        image_key="tank",
        badge="新品",
        tags="造景美观,全套齐全",
        species=None,
        age=None,
        health=None,
        size="中号",
        gender=None,
        care_advice="包含过滤、晒台、加热灯与基础造景",
    ),
]


def seed_database(db: Session) -> None:
    if db.scalar(select(User.id).limit(1)) is None:
        db.add(User(id=1, nickname="萌宠小主人", level=6, points=1260, coupons=3, favorites=8))

    if db.scalar(select(Product.id).limit(1)) is None:
        db.add_all([Product(**item) for item in PRODUCTS])

    if db.scalar(select(LotteryActivity.id).limit(1)) is None:
        now = datetime.now()
        prizes = [
            {"level": "一等奖", "name": "萌宠用品礼包", "quantity": 5, "icon": "gift"},
            {"level": "二等奖", "name": "乌龟专区优惠券", "quantity": 10, "icon": "coupon"},
            {"level": "三等奖", "name": "兔兔专区优惠券", "quantity": 20, "icon": "coupon"},
            {"level": "参与奖", "name": "萌宠积分 10 分", "quantity": 100, "icon": "points"},
        ]
        rules = [
            "管理员发布活动通知和奖品信息",
            "用户在报名时间内免费报名参加",
            "到达开奖时间后由服务端自动开奖",
            "公布脱敏中奖名单，中奖用户联系管理员领奖",
        ]
        db.add(
            LotteryActivity(
                id=1,
                title="春日萌宠抽奖季",
                subtitle="活动通知已发布，快来报名参加",
                registration_start_at=now - timedelta(days=2),
                registration_end_at=now + timedelta(days=4),
                draw_at=now + timedelta(days=5, hours=2),
                status="REGISTERING",
                participant_count=1286,
                prizes_json=json.dumps(prizes, ensure_ascii=False),
                rules_json=json.dumps(rules, ensure_ascii=False),
                winners_json="[]",
            )
        )
        winners = [
            {"nickname": "萌宠用户-小林", "level": "一等奖", "prize": "萌宠用品礼包"},
            {"nickname": "萌宠用户-Coco", "level": "二等奖", "prize": "乌龟专区优惠券"},
            {"nickname": "萌宠用户-阿白", "level": "二等奖", "prize": "乌龟专区优惠券"},
            {"nickname": "萌宠用户-糖糖", "level": "三等奖", "prize": "兔兔专区优惠券"},
            {"nickname": "萌宠用户-小熊", "level": "三等奖", "prize": "兔兔专区优惠券"},
            {"nickname": "萌宠用户-阳光", "level": "参与奖", "prize": "萌宠积分 10 分"},
        ]
        db.add(
            LotteryActivity(
                id=2,
                title="暖冬萌宠幸运季",
                subtitle="本期活动已圆满开奖",
                registration_start_at=now - timedelta(days=12),
                registration_end_at=now - timedelta(days=6),
                draw_at=now - timedelta(days=5),
                status="DRAWN",
                participant_count=1268,
                prizes_json=json.dumps(prizes, ensure_ascii=False),
                rules_json=json.dumps(rules, ensure_ascii=False),
                winners_json=json.dumps(winners, ensure_ascii=False),
            )
        )
    db.commit()
