"""Clientes, productos, categorías, inventario y vendedores."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import client_ip, require
from app.models import (
    Category, Customer, Employee, Inventory, InventoryMovement, Product, Sale, User,
)
from app.schemas import CategoryIn, CustomerIn, MovementIn, ProductIn
from app.services import audit
from app.services.sales_service import serialize_sale

router = APIRouter(tags=["Maestros"])


def _cust(c: Customer) -> dict:
    return {
        "id": c.id, "doc_type": c.doc_type, "doc_number": c.doc_number, "name": c.name, "email": c.email,
        "phone": c.phone, "city": c.city, "segment": c.segment, "is_active": c.is_active,
    }


# ---------------------------------------------------------------- Clientes
@router.get("/customers")
def list_customers(
    q: str | None = None, segment: str | None = None, limit: int = Query(200, le=500), offset: int = 0,
    user: User = Depends(require("customers:read")), db: Session = Depends(get_db),
):
    stmt = select(Customer).where(Customer.company_id == user.company_id)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Customer.name).like(like), Customer.doc_number.like(f"%{q}%"), func.lower(Customer.email).like(like)))
    if segment:
        stmt = stmt.where(Customer.segment == segment)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Customer.name).limit(limit).offset(offset))
    stats = {
        r[0]: (r[1], r[2] or 0)
        for r in db.execute(
            select(Sale.customer_id, func.count(Sale.id), func.sum(Sale.total))
            .where(Sale.company_id == user.company_id, Sale.status == "completada", Sale.customer_id.is_not(None))
            .group_by(Sale.customer_id)
        )
    }
    items = []
    for c in rows:
        n, total_spent = stats.get(c.id, (0, 0))
        items.append({**_cust(c), "purchases": n, "total_spent": round(total_spent, 2)})
    return {"total": total, "items": items}


@router.get("/customers/{cid}")
def get_customer(cid: int, user: User = Depends(require("customers:read")), db: Session = Depends(get_db)):
    c = db.get(Customer, cid)
    if not c or c.company_id != user.company_id:
        raise HTTPException(404, "Cliente no encontrado")
    sales = db.scalars(
        select(Sale).where(Sale.customer_id == cid).options(joinedload(Sale.customer), joinedload(Sale.employee))
        .order_by(Sale.created_at.desc()).limit(50)
    ).unique()
    history = [serialize_sale(s) for s in sales]
    done = [s for s in history if s["status"] == "completada"]
    return {
        **_cust(c),
        "history": history,
        "summary": {"purchases": len(done), "total": round(sum(s["total"] for s in done), 2),
                    "avg_ticket": round(sum(s["total"] for s in done) / len(done), 2) if done else 0},
    }


@router.post("/customers", status_code=201)
def create_customer(payload: CustomerIn, request: Request, user: User = Depends(require("customers:write")), db: Session = Depends(get_db)):
    c = Customer(company_id=user.company_id, **payload.model_dump())
    db.add(c)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe un cliente con ese documento")
    audit.log(db, user, "customer.create", "customer", c.id, {"name": c.name}, client_ip(request))
    db.commit()
    return _cust(c)


@router.put("/customers/{cid}")
def update_customer(cid: int, payload: CustomerIn, request: Request, user: User = Depends(require("customers:write")), db: Session = Depends(get_db)):
    c = db.get(Customer, cid)
    if not c or c.company_id != user.company_id:
        raise HTTPException(404, "Cliente no encontrado")
    for k, v in payload.model_dump().items():
        setattr(c, k, v)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe un cliente con ese documento")
    audit.log(db, user, "customer.update", "customer", c.id, {"name": c.name}, client_ip(request))
    db.commit()
    return _cust(c)


# ---------------------------------------------------------------- Categorías y productos
@router.get("/categories")
def list_categories(user: User = Depends(require("products:read")), db: Session = Depends(get_db)):
    rows = db.scalars(select(Category).where(Category.company_id == user.company_id).order_by(Category.name))
    return [{"id": c.id, "name": c.name} for c in rows]


@router.post("/categories", status_code=201)
def create_category(payload: CategoryIn, user: User = Depends(require("products:write")), db: Session = Depends(get_db)):
    c = Category(company_id=user.company_id, name=payload.name.strip())
    db.add(c)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "La categoría ya existe")
    return {"id": c.id, "name": c.name}


def _prod(p: Product) -> dict:
    inv = p.inventory
    return {
        "id": p.id, "sku": p.sku, "name": p.name, "category_id": p.category_id,
        "category": p.category.name if p.category else None, "price": p.price, "cost": p.cost,
        "margin_pct": round((p.price - p.cost) / p.price * 100, 1) if p.price else 0,
        "stock": inv.stock if inv else 0, "min_stock": inv.min_stock if inv else 0, "is_active": p.is_active,
    }


@router.get("/products")
def list_products(
    q: str | None = None, category_id: int | None = None, active: bool | None = None,
    low_stock: bool = False, limit: int = Query(300, le=1000),
    user: User = Depends(require("products:read")), db: Session = Depends(get_db),
):
    stmt = (
        select(Product).where(Product.company_id == user.company_id)
        .options(joinedload(Product.category), joinedload(Product.inventory))
    )
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Product.name).like(like), func.lower(Product.sku).like(like)))
    if category_id:
        stmt = stmt.where(Product.category_id == category_id)
    if active is not None:
        stmt = stmt.where(Product.is_active.is_(active))
    items = [_prod(p) for p in db.scalars(stmt.order_by(Product.name).limit(limit)).unique()]
    if low_stock:
        items = [i for i in items if i["stock"] <= i["min_stock"]]
    return {"total": len(items), "items": items}


@router.post("/products", status_code=201)
def create_product(payload: ProductIn, request: Request, user: User = Depends(require("products:write")), db: Session = Depends(get_db)):
    data = payload.model_dump(exclude={"min_stock", "initial_stock"})
    if data["category_id"]:
        cat = db.get(Category, data["category_id"])
        if not cat or cat.company_id != user.company_id:
            raise HTTPException(404, "Categoría no encontrada")
    p = Product(company_id=user.company_id, **data)
    p.inventory = Inventory(stock=payload.initial_stock, min_stock=payload.min_stock)
    db.add(p)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe un producto con ese SKU")
    if payload.initial_stock:
        db.add(InventoryMovement(product_id=p.id, type="entrada", quantity=payload.initial_stock,
                                 balance=payload.initial_stock, reason="Stock inicial", user_id=user.id))
    audit.log(db, user, "product.create", "product", p.id, {"sku": p.sku}, client_ip(request))
    db.commit()
    db.refresh(p)
    return _prod(p)


@router.put("/products/{pid}")
def update_product(pid: int, payload: ProductIn, request: Request, user: User = Depends(require("products:write")), db: Session = Depends(get_db)):
    p = db.get(Product, pid)
    if not p or p.company_id != user.company_id:
        raise HTTPException(404, "Producto no encontrado")
    for k, v in payload.model_dump(exclude={"min_stock", "initial_stock"}).items():
        setattr(p, k, v)
    if p.inventory:
        p.inventory.min_stock = payload.min_stock
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ya existe un producto con ese SKU")
    audit.log(db, user, "product.update", "product", p.id, {"sku": p.sku}, client_ip(request))
    db.commit()
    db.refresh(p)
    return _prod(p)


# ---------------------------------------------------------------- Inventario
@router.get("/inventory/movements")
def list_movements(
    product_id: int | None = None, limit: int = Query(100, le=500),
    user: User = Depends(require("inventory:read")), db: Session = Depends(get_db),
):
    stmt = (
        select(InventoryMovement).join(Product).where(Product.company_id == user.company_id)
        .options(joinedload(InventoryMovement.product))
    )
    if product_id:
        stmt = stmt.where(InventoryMovement.product_id == product_id)
    rows = db.scalars(stmt.order_by(InventoryMovement.created_at.desc(), InventoryMovement.id.desc()).limit(limit)).unique()
    return [
        {"id": m.id, "product_id": m.product_id, "product": m.product.name, "sku": m.product.sku, "type": m.type,
         "quantity": m.quantity, "balance": m.balance, "reason": m.reason, "reference": m.reference,
         "created_at": m.created_at.isoformat() if m.created_at else None}
        for m in rows
    ]


@router.post("/inventory/movements", status_code=201)
def create_movement(payload: MovementIn, request: Request, user: User = Depends(require("inventory:write")), db: Session = Depends(get_db)):
    p = db.get(Product, payload.product_id)
    if not p or p.company_id != user.company_id:
        raise HTTPException(404, "Producto no encontrado")
    inv = db.scalar(select(Inventory).where(Inventory.product_id == p.id).with_for_update())
    if inv is None:
        inv = Inventory(product_id=p.id, stock=0, min_stock=10)
        db.add(inv)
    if payload.type == "entrada":
        inv.stock += payload.quantity
    elif payload.type == "salida":
        if inv.stock < payload.quantity:
            raise HTTPException(409, f"Stock insuficiente (disponible: {inv.stock})")
        inv.stock -= payload.quantity
    else:  # ajuste: la cantidad es el nuevo stock
        inv.stock = payload.quantity
    mv = InventoryMovement(product_id=p.id, type=payload.type, quantity=payload.quantity, balance=inv.stock,
                           reason=payload.reason, user_id=user.id)
    db.add(mv)
    audit.log(db, user, "inventory.move", "product", p.id, {"type": payload.type, "qty": payload.quantity}, client_ip(request))
    db.commit()
    return {"product_id": p.id, "stock": inv.stock}


# ---------------------------------------------------------------- Vendedores
@router.get("/employees")
def list_employees(user: User = Depends(require("sales:read")), db: Session = Depends(get_db)):
    rows = db.scalars(select(Employee).where(Employee.company_id == user.company_id, Employee.is_active.is_(True)).order_by(Employee.full_name))
    return [{"id": e.id, "full_name": e.full_name, "position": e.position, "branch": e.branch} for e in rows]
