"""Datos semilla: empresa, roles, usuarios y (opcionalmente) un año de operación comercial realista."""
from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.permissions import ROLE_DESCRIPTIONS, ROLE_PERMISSIONS
from app.core.security import hash_password
from app.models import (
    Category, Company, Customer, Employee, Inventory, InventoryMovement, Payment, Product, Role, Sale,
    SaleDetail, User,
)

DEMO_USERS = [
    ("admin@auroravi.com", "Admin123!", "Administrador General", "admin"),
    ("gerente@auroravi.com", "Gerente123!", "Rosa Villanueva Paredes", "gerente"),
    ("analista@auroravi.com", "Analista123!", "Diego Quispe Alarcón", "analista"),
    ("vendedor@auroravi.com", "Vendedor123!", "Carlos Mendoza Rojas", "vendedor"),
    ("almacen@auroravi.com", "Almacen123!", "Lucía Fernández Soto", "almacen"),
]

CATALOG = {
    "Abarrotes": [("Arroz extra 5 kg", 21.5, 16.8), ("Aceite vegetal 1 L", 9.9, 7.4), ("Azúcar rubia 1 kg", 4.8, 3.6),
                  ("Fideos spaghetti 500 g", 3.9, 2.7), ("Atún en aceite 170 g", 6.5, 4.6), ("Lentejas 500 g", 5.2, 3.8)],
    "Bebidas": [("Gaseosa 3 L", 12.5, 8.9), ("Agua mineral 625 ml", 2.5, 1.4), ("Jugo de naranja 1 L", 7.9, 5.3),
                ("Cerveza lager 6 pack", 29.9, 21.0), ("Café molido 250 g", 15.9, 10.8)],
    "Limpieza": [("Detergente 2 kg", 24.9, 17.2), ("Lejía 1 L", 4.5, 2.9), ("Lavavajillas 750 ml", 8.9, 5.8),
                 ("Papel higiénico x12", 18.9, 12.7), ("Desinfectante 900 ml", 9.5, 6.1)],
    "Cuidado personal": [("Shampoo 400 ml", 16.9, 10.9), ("Jabón de tocador x3", 7.8, 4.9), ("Pasta dental 100 ml", 6.9, 4.2),
                         ("Desodorante roll-on", 11.9, 7.4)],
    "Electro y hogar": [("Licuadora 1.5 L", 129.0, 92.0), ("Plancha a vapor", 99.0, 68.0), ("Hervidor eléctrico 1.7 L", 89.0, 61.0),
                        ("Ventilador de mesa", 119.0, 83.0)],
}

FIRST = ["Ana", "Luis", "María", "José", "Carmen", "Jorge", "Rosa", "Miguel", "Elena", "Pedro", "Sofía", "Raúl", "Patricia",
         "Víctor", "Gabriela", "Andrés", "Milagros", "Fernando", "Daniela", "Renzo"]
LAST = ["Quispe", "Huamán", "Flores", "Rojas", "Mamani", "Torres", "Díaz", "Vargas", "Castillo", "Ramos", "Chávez", "Salazar",
        "Paredes", "Gutiérrez", "Rivera", "Cárdenas", "Córdova", "Medina", "Soto", "Aguilar"]
BUSINESS = ["Bodega", "Minimarket", "Comercial", "Distribuidora", "Inversiones", "Corporación", "Importadora"]
CITIES = ["Lima", "Callao", "Arequipa", "Trujillo", "Cusco", "Piura", "Huancayo", "Chiclayo"]
SELLERS = [("Carlos Mendoza Rojas", "Principal"), ("Valeria Ortega Luna", "Principal"), ("Jhon Pacheco Ríos", "Norte"),
           ("Karen Sánchez Vela", "Sur"), ("Mateo Delgado Cruz", "Norte")]


def seed_base(db: Session) -> Company:
    s = get_settings()
    company = db.scalar(select(Company))
    if company:
        return company
    company = Company(name=s.company_name, ruc="20512345678", currency=s.currency)
    db.add(company)
    db.flush()
    for name, perms in ROLE_PERMISSIONS.items():
        db.merge(Role(name=name, description=ROLE_DESCRIPTIONS[name], permissions=perms))
    db.flush()
    if s.seed_demo_data:
        for email, pwd, name, role in DEMO_USERS:
            db.add(User(company_id=company.id, email=email, full_name=name, password_hash=hash_password(pwd), role=role))
    else:
        db.add(User(company_id=company.id, email=s.admin_email, full_name="Administrador",
                    password_hash=hash_password(s.admin_password), role="admin"))
    db.commit()
    return company


def seed_demo(db: Session, company: Company, seed: int = 7) -> None:
    if db.scalar(select(Product.id).limit(1)):
        return
    rnd = random.Random(seed)
    cid = company.id

    users = {u.role: u for u in db.scalars(select(User))}
    employees: list[Employee] = []
    for i, (name, branch) in enumerate(SELLERS):
        e = Employee(company_id=cid, full_name=name, branch=branch, user_id=users["vendedor"].id if i == 0 else None)
        db.add(e)
        employees.append(e)

    cats: dict[str, Category] = {}
    products: list[Product] = []
    n = 0
    for cname, items in CATALOG.items():
        cat = Category(company_id=cid, name=cname)
        db.add(cat)
        db.flush()
        cats[cname] = cat
        for pname, price, cost in items:
            n += 1
            p = Product(company_id=cid, category_id=cat.id, sku=f"SKU-{n:04d}", name=pname, price=price, cost=cost)
            p.inventory = Inventory(stock=0, min_stock=rnd.choice([15, 20, 25, 30]) if price < 50 else rnd.choice([4, 5, 6]))
            db.add(p)
            products.append(p)
    db.flush()

    customers: list[Customer] = []
    for i in range(48):
        corp = rnd.random() < 0.3
        if corp:
            name = f"{rnd.choice(BUSINESS)} {rnd.choice(LAST)} {rnd.choice(['S.A.C.', 'E.I.R.L.', 'S.R.L.'])}"
            doc_type, doc = "RUC", f"20{rnd.randint(10000000, 99999999)}"
            segment = rnd.choice(["Mayorista", "Corporativo"])
        else:
            name = f"{rnd.choice(FIRST)} {rnd.choice(LAST)} {rnd.choice(LAST)}"
            doc_type, doc = "DNI", f"{rnd.randint(10000000, 79999999)}"
            segment = "Minorista"
        c = Customer(
            company_id=cid, doc_type=doc_type, doc_number=doc, name=name, segment=segment, city=rnd.choice(CITIES),
            email=f"contacto{i + 1}@ejemplo.pe", phone=f"9{rnd.randint(10000000, 99999999)}",
        )
        db.add(c)
        customers.append(c)
    db.flush()

    # Cada cliente tiene una "afinidad" de compra distinta -> recurrencia heterogénea.
    weights = [rnd.paretovariate(1.6) for _ in customers]
    pweights = [rnd.paretovariate(1.2) / (1 + p.price / 60) for p in products]

    now = datetime.now().replace(minute=0, second=0, microsecond=0)
    start = now - timedelta(days=364)
    stock = {p.id: 400 if p.price < 50 else 60 for p in products}
    for p in products:
        db.add(InventoryMovement(product_id=p.id, type="entrada", quantity=stock[p.id], balance=stock[p.id],
                                 reason="Stock inicial", created_at=start - timedelta(days=1)))

    tax_rate = get_settings().tax_rate
    counter = 0
    day = start
    while day <= now:
        seasonal = 1 + 0.25 * math.sin((day.timetuple().tm_yday / 365) * 2 * math.pi - 1.2)
        trend = 0.75 + 0.5 * ((day - start).days / 364)
        weekday = [0.9, 0.95, 1.0, 1.0, 1.25, 1.45, 0.7][day.weekday()]
        lam = 2.1 * seasonal * trend * weekday
        count = max(0, int(rnd.gauss(lam, lam ** 0.5)))
        for _ in range(count):
            counter += 1
            cust = rnd.choices(customers, weights)[0] if rnd.random() < 0.88 else None
            emp = rnd.choice(employees)
            lines = rnd.choices([1, 2, 3, 4, 5, 6], [30, 28, 20, 12, 7, 3])[0]
            chosen = list({rnd.choices(products, pweights)[0].id: None for _ in range(lines)})
            by_id = {p.id: p for p in products}
            when = day.replace(hour=rnd.randint(8, 20), minute=rnd.randint(0, 59))
            details, subtotal, disc_total, units = [], 0.0, 0.0, 0
            for pid in chosen:
                p = by_id[pid]
                big = cust is not None and cust.segment != "Minorista"
                qty = max(1, int(rnd.lognormvariate(1.1 if big else 0.6, 0.6)))
                qty = min(qty, 40 if p.price < 50 else 6)
                if stock[pid] < qty:
                    restock = 400 if p.price < 50 else 60
                    stock[pid] += restock
                    db.add(InventoryMovement(product_id=pid, type="entrada", quantity=restock, balance=stock[pid],
                                             reason="Reposición", created_at=when - timedelta(hours=1)))
                stock[pid] -= qty
                gross = round(p.price * qty, 2)
                pct = rnd.choice([0, 0, 0, 0, 5, 10]) if big else rnd.choice([0, 0, 0, 0, 0, 0, 5])
                disc = round(gross * pct / 100, 2)
                line = round(gross - disc, 2)
                subtotal += line
                disc_total += disc
                units += qty
                details.append(SaleDetail(product_id=pid, quantity=qty, unit_price=p.price, discount=disc, line_total=line))
            subtotal = round(subtotal, 2)
            tax = round(subtotal * tax_rate, 2)
            total = round(subtotal + tax, 2)
            method = rnd.choices(["efectivo", "tarjeta", "yape", "plin", "transferencia"], [30, 27, 20, 8, 15])[0]
            status = "anulada" if rnd.random() < 0.015 else "completada"
            sale = Sale(
                company_id=cid, number=f"V-{counter:06d}", customer_id=cust.id if cust else None, employee_id=emp.id,
                branch=emp.branch, status=status, subtotal=subtotal, discount=round(disc_total, 2), tax=tax, total=total,
                units=units, payment_method=method, created_by=users["vendedor"].id, created_at=when,
            )
            sale.details = details
            if status == "completada":
                sale.payments = [Payment(method=method, amount=total, paid_at=when)]
            db.add(sale)
            if status == "completada":
                for d in details:
                    db.add(InventoryMovement(product_id=d.product_id, type="salida", quantity=d.quantity,
                                             balance=stock[d.product_id], reason="Venta", reference=sale.number, created_at=when))
            else:  # la venta anulada devuelve el stock
                for d in details:
                    stock[d.product_id] += d.quantity
        day += timedelta(days=1)
        if counter % 200 == 0:
            db.flush()

    # Dejar algunos productos cerca de/bajo el mínimo para activar alertas
    for p in rnd.sample(products, 4):
        stock[p.id] = rnd.randint(0, max(1, (p.inventory.min_stock)))
    for p in products:
        p.inventory.stock = stock[p.id]
    db.commit()


def run(db: Session) -> None:
    company = seed_base(db)
    if get_settings().seed_demo_data:
        seed_demo(db, company)
