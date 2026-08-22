from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy.orm import Session

from .config import BASE_DIR, settings
from .models import NotificationOutbox


class LocalStorageService:
    def __init__(self) -> None:
        configured = Path(settings.local_upload_dir)
        self.root = configured if configured.is_absolute() else BASE_DIR / configured
        self.root.mkdir(parents=True, exist_ok=True)

    async def save(self, file: UploadFile, folder: str = "common") -> dict:
        suffix = Path(file.filename or "upload.bin").suffix.lower()
        relative = Path(folder) / f"{uuid4().hex}{suffix}"
        target = self.root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        content = await file.read()
        target.write_bytes(content)
        return {"fileKey": relative.as_posix(), "url": f"/uploads/{relative.as_posix()}", "size": len(content)}


class DatabaseOutboxService:
    def send(self, db: Session, event_type: str, recipient: str, payload: dict) -> None:
        db.add(NotificationOutbox(event_type=event_type, recipient=recipient, payload=payload))


storage_service = LocalStorageService()
notification_service = DatabaseOutboxService()
