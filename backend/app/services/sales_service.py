"""Servicios transaccionales de ventas (Fase 08): pedido → venta → pago → inventario."""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models import (
    Customer, Employee, Inventory, InventoryMovement, Payment, Product, Sale, SaleDetail, User,
)
from app.schemas import SaleIn
from app.services import audit


def next_number(db: Session, company_id: int) -> str:
    last = db.scalar(select(func.max(Sale.id)).where(Sale.company_id == company_id)) or 0
    return f"V-{last + 1:06d}"


def serialize_sale(s: Sale, detail: bool = False) -> dict:
    out = {
        "id": s.id,
        "number": s.number,
        "status": s.status,
        "customer_id": s.customer_id,
        "customer": s.customer.name if s.customer else "Cliente general",
        "employee_id": s.employee_id,
        "employee": s.employee.full_name if s.employee else None,
        "branch": s.branch,
        "payment_method": s.payment_method,
        "subtotal": s.subtotal,
        "discount": s.discount,
        "tax": s.tax,
        "total": s.total,
        "units": s.units,
        "notes": s.notes,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }
    if detail:
        out["items"] = [
            {
                "product_id": d.product_id,
                "sku": d.product.sku,
                "name": d.product.name,
                "quantity": d.quantity,
                "unit_price": d.unit_price,
                "discount": d.discount,
                "line_total": d.line_total,
            }
            for d in s.details
        ]
        out["payments"] = [
            {"method": p.method, "amount": p.amount, "paid_at": p.paid_at.isoformat() if p.paid_at else None}
            for p in s.payments
        ]
    return out


def _apply_stock(db: Session, sale: Sale, user: User) -> None:
    """Descuenta stock bloqueando filas; falla si alguna línea no tiene existencias."""
    for d in sale.details:
        stmt = select(Inventory).where(Inventory.product_id == d.product_id).with_for_update()
        inv = db.scalar(stmt)
        if inv is None or inv.stock < d.quantity:
            available = inv.stock if inv else 0
            raise HTTPException(409, f"Stock insuficiente para «{d.product.name}» (disponible: {available}).")
        inv.stock -= d.quantity
        db.add(
            InventoryMovement(
                product_id=d.product_id, type="salida", quantity=d.quantity, balance=inv.stock,
                reason="Venta", reference=sale.number, user_id=user.id,
            )
        )


def create_sale(db: Session, payload: SaleIn, user: User, ip: str | None = None) -> Sale:
    settings = get_settings()
    cid = user.company_id

    if payload.customer_id is not None:
        cust = db.get(Customer, payload.customer_id)
        if not cust or cust.company_id != cid:
            raise HTTPException(404, "Cliente no encontrado")
    employee_id = payload.employee_id
    if employee_id is None and user.role == "vendedor":
        employee_id = db.scalar(select(Employee.id).where(Employee.user_id == user.id))
    if employee_id is not None:
        emp = db.get(Employee, employee_id)
        if not emp or emp.company_id != cid:
            raise HTTPException(404, "Vendedor no encontrado")

    merged: dict[int, tuple[int, float]] = {}
    for it in payload.items:
        q, disc = merged.get(it.product_id, (0, it.discount_pct))
        merged[it.product_id] = (q + it.quantity, max(disc, it.discount_pct))

    products = {
        p.id: p
        for p in db.scalars(select(Product).where(Product.id.in_(merged.keys()), Product.company_id == cid))
    }
    if len(products) != len(merged):
        raise HTTPException(404, "Alguno de los productos no existe")

    subtotal = discount_total = 0.0
    units = 0
    details: list[SaleDetail] = []
    for pid, (qty, disc_pct) in merged.items():
        p = products[pid]
        if not p.is_active:
            raise HTTPException(409, f"El producto «{p.name}» está inactivo")
        gross = round(p.price * qty, 2)
        disc = round(gross * disc_pct / 100, 2)
        line = round(gross - disc, 2)
        subtotal += line
        discount_total += disc
        units += qty
        details.append(SaleDetail(product_id=pid, quantity=qty, unit_price=p.price, discount=disc, line_total=line))

    subtotal = round(subtotal, 2)
    tax = round(subtotal * settings.tax_rate, 2)
    total = round(subtotal + tax, 2)

    sale = Sale(
        company_id=cid, number=next_number(db, cid), customer_id=payload.customer_id,
        employee_id=employee_id, branch=payload.branch, status="pedido",
        subtotal=subtotal, discount=round(discount_total, 2), tax=tax, total=total, units=units,
        payment_method=payload.payment_method, notes=payload.notes, created_by=user.id,
    )
    sale.details = details
    db.add(sale)
    db.flush()
    for d in details:
        d.product = products[d.product_id]

    if payload.confirm:
        _confirm(db, sale, user)
    audit.log(db, user, "sale.create", "sale", sale.id, {"number": sale.number, "total": total, "status": sale.status}, ip)
    db.commit()
    return load_sale(db, sale.id)


def _confirm(db: Session, sale: Sale, user: User) -> None:
    _apply_stock(db, sale, user)
    sale.status = "completada"
    db.add(Payment(sale_id=sale.id, method=sale.payment_method or "efectivo", amount=sale.total))


def confirm_sale(db: Session, sale_id: int, user: User, ip: str | None = None) -> Sale:
    sale = load_sale(db, sale_id, user.company_id)
    if sale.status != "pedido":
        raise HTTPException(409, "Solo un pedido pendiente puede confirmarse")
    _confirm(db, sale, user)
    audit.log(db, user, "sale.confirm", "sale", sale.id, {"number": sale.number}, ip)
    db.commit()
    return load_sale(db, sale_id)


def cancel_sale(db: Session, sale_id: int, user: User, ip: str | None = None) -> Sale:
    sale = load_sale(db, sale_id, user.company_id)
    if sale.status == "anulada":
        raise HTTPException(409, "La venta ya está anulada")
    if sale.status == "completada":
        for d in sale.details:
            inv = db.scalar(select(Inventory).where(Inventory.product_id == d.product_id).with_for_update())
            if inv:
                inv.stock += d.quantity
                db.add(
                    InventoryMovement(
                        product_id=d.product_id, type="entrada", quantity=d.quantity, balance=inv.stock,
                        reason="Anulación de venta", reference=sale.number, user_id=user.id,
                    )
                )
    sale.status = "anulada"
    audit.log(db, user, "sale.cancel", "sale", sale.id, {"number": sale.number}, ip)
    db.commit()
    return load_sale(db, sale_id)


def load_sale(db: Session, sale_id: int, company_id: int | None = None) -> Sale:
    stmt = (
        select(Sale)
        .where(Sale.id == sale_id)
        .options(
            selectinload(Sale.details).selectinload(SaleDetail.product),
            selectinload(Sale.payments),
            selectinload(Sale.customer),
            selectinload(Sale.employee),
        )
    )
    sale = db.scalar(stmt)
    if not sale or (company_id is not None and sale.company_id != company_id):
        raise HTTPException(404, "Venta no encontrada")
    return sale
