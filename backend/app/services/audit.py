from sqlalchemy.orm import Session

from app.models import AuditLog, User


def log(
    db: Session,
    user: User | None,
    action: str,
    entity: str | None = None,
    entity_id: int | str | None = None,
    detail: dict | None = None,
    ip: str | None = None,
    email: str | None = None,
) -> None:
    db.add(
        AuditLog(
            company_id=user.company_id if user else None,
            user_id=user.id if user else None,
            user_email=user.email if user else email,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            detail=detail,
            ip=ip,
        )
    )
