import os
from pathlib import Path

TEST_DATABASE = Path(__file__).resolve().parents[1] / "data" / "pet_life_test.db"
TEST_DATABASE.parent.mkdir(parents=True, exist_ok=True)
TEST_DATABASE.unlink(missing_ok=True)

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATABASE.as_posix()}"
os.environ["APP_ENV"] = "development"
