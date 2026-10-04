from datetime import date, datetime, time

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import client_ip, require
from app.models import Employee, Sale, User
from app.schemas import SaleIn
from app.services import sales_service as svc

router = APIRouter(tags=["Ventas"])


def _scope(db: Session, user: User) -> int | None:
    """Un vendedor solo ve sus propias ventas."""
    if user.role == "vendedor":
        return db.scalar(select(Employee.id).where(Employee.user_id == user.id)) or -1
    return None


@router.get("/sales")
def list_sales(
    status: str | None = None, q: str | None = None, date_from: date | None = None, date_to: date | None = None,
    employee_id: int | None = None, limit: int = Query(100, le=500), offset: int = 0,
    user: User = Depends(require("sales:read")), db: Session = Depends(get_db),
):
    stmt = (
        select(Sale).where(Sale.company_id == user.company_id)
        .options(joinedload(Sale.customer), joinedload(Sale.employee))
    )
    scope = _scope(db, user)
    if scope is not None:
        stmt = stmt.where(Sale.employee_id == scope)
    elif employee_id:
        stmt = stmt.where(Sale.employee_id == employee_id)
    if status:
        stmt = stmt.where(Sale.status == status)
    if q:
        stmt = stmt.where(Sale.number.ilike(f"%{q}%"))
    if date_from:
        stmt = stmt.where(Sale.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(Sale.created_at <= datetime.combine(date_to, time.max))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    rows = db.scalars(stmt.order_by(Sale.created_at.desc(), Sale.id.desc()).limit(limit).offset(offset)).unique()
    return {"total": total, "items": [svc.serialize_sale(s) for s in rows]}


@router.get("/sales/{sale_id}")
def get_sale(sale_id: int, user: User = Depends(require("sales:read")), db: Session = Depends(get_db)):
    sale = svc.load_sale(db, sale_id, user.company_id)
    scope = _scope(db, user)
    if scope is not None and sale.employee_id != scope:
        from fastapi import HTTPException

        raise HTTPException(404, "Venta no encontrada")
    return svc.serialize_sale(sale, detail=True)


@router.post("/sales", status_code=201)
def create_sale(payload: SaleIn, request: Request, user: User = Depends(require("sales:write")), db: Session = Depends(get_db)):
    return svc.serialize_sale(svc.create_sale(db, payload, user, client_ip(request)), detail=True)


@router.post("/sales/{sale_id}/confirm")
def confirm_sale(sale_id: int, request: Request, user: User = Depends(require("sales:write")), db: Session = Depends(get_db)):
    return svc.serialize_sale(svc.confirm_sale(db, sale_id, user, client_ip(request)), detail=True)


@router.post("/sales/{sale_id}/cancel")
def cancel_sale(sale_id: int, request: Request, user: User = Depends(require("sales:write")), db: Session = Depends(get_db)):
    return svc.serialize_sale(svc.cancel_sale(db, sale_id, user, client_ip(request)), detail=True)
