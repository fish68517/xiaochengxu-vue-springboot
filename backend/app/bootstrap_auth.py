import argparse

from sqlalchemy import select

from .database import SessionLocal
from .models import User
from .security import hash_password


def main() -> None:
    parser = argparse.ArgumentParser(description="Set a database-backed application login password")
    parser.add_argument("username")
    parser.add_argument("password")
    args = parser.parse_args()

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == args.username))
        if not user:
            raise SystemExit(f"User not found: {args.username}")
        user.password_hash = hash_password(args.password)
        user.enabled = True
        db.commit()
        print(f"Password initialized for {user.username} ({user.role})")


if __name__ == "__main__":
    main()
