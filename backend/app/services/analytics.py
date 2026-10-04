"""Capa analítica: convierte las ventas operativas en series, KPIs y datasets estadísticos."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Customer, Sale, SaleDetail
from app.statistics import engine as st

WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]


@dataclass
class Filters:
    date_from: date | None = None
    date_to: date | None = None
    employee_id: int | None = None
    category_id: int | None = None
    branch: str | None = None

    def as_dict(self) -> dict:
        return {
            "date_from": self.date_from.isoformat() if self.date_from else None,
            "date_to": self.date_to.isoformat() if self.date_to else None,
            "employee_id": self.employee_id,
            "category_id": self.category_id,
            "branch": self.branch,
        }


# Variables estadísticas disponibles, con su naturaleza (RF-14)
VARIABLES: dict[str, dict] = {
    "monto_venta": {"label": "Monto de venta", "unit": "S/", "kind": "cuantitativa continua", "extract": lambda s: s.total},
    "unidades_por_venta": {"label": "Unidades por venta", "unit": "und", "kind": "cuantitativa discreta", "extract": lambda s: s.units},
    "items_por_venta": {"label": "Productos distintos por venta", "unit": "líneas", "kind": "cuantitativa discreta", "extract": lambda s: len(s.details)},
    "descuento_venta": {"label": "Descuento aplicado", "unit": "S/", "kind": "cuantitativa continua", "extract": lambda s: s.discount},
    "metodo_pago": {"label": "Método de pago", "unit": None, "kind": "cualitativa nominal", "extract": lambda s: s.payment_method},
    "sucursal": {"label": "Sucursal", "unit": None, "kind": "cualitativa nominal", "extract": lambda s: s.branch},
}


def load_sales(db: Session, company_id: int, f: Filters, statuses: tuple[str, ...] = ("completada",), seller_scope: int | None = None) -> list[Sale]:
    stmt = (
        select(Sale)
        .where(Sale.company_id == company_id, Sale.status.in_(statuses))
        .options(
            selectinload(Sale.details).selectinload(SaleDetail.product),
            selectinload(Sale.customer),
            selectinload(Sale.employee),
        )
        .order_by(Sale.created_at)
    )
    if f.date_from:
        stmt = stmt.where(Sale.created_at >= datetime.combine(f.date_from, time.min))
    if f.date_to:
        stmt = stmt.where(Sale.created_at <= datetime.combine(f.date_to, time.max))
    emp = seller_scope or f.employee_id
    if emp:
        stmt = stmt.where(Sale.employee_id == emp)
    if f.branch:
        stmt = stmt.where(Sale.branch == f.branch)
    sales = list(db.scalars(stmt))
    if f.category_id:
        sales = [s for s in sales if any(d.product.category_id == f.category_id for d in s.details)]
    return sales


def series(sales: list[Sale], variable: str) -> list:
    if variable not in VARIABLES:
        raise st.StatsError(f"Variable desconocida: {variable}")
    ex = VARIABLES[variable]["extract"]
    return [ex(s) for s in sales if ex(s) is not None]


def _r(x: float, n: int = 2) -> float:
    return round(float(x), n)


def _group(sales: list[Sale], keyfn) -> dict:
    g: dict = defaultdict(lambda: {"count": 0, "revenue": 0.0, "units": 0, "totals": []})
    for s in sales:
        k = keyfn(s)
        row = g[k]
        row["count"] += 1
        row["revenue"] += s.total
        row["units"] += s.units
        row["totals"].append(s.total)
    return g


def _kpis(sales: list[Sale]) -> dict:
    totals = [s.total for s in sales]
    customers = {s.customer_id for s in sales if s.customer_id}
    return {
        "revenue": _r(sum(totals)),
        "transactions": len(sales),
        "units": sum(s.units for s in sales),
        "avg_ticket": _r(st.mean(totals)) if totals else 0.0,
        "median_ticket": _r(st.median(totals)) if totals else 0.0,
        "customers": len(customers),
        "discounts": _r(sum(s.discount for s in sales)),
    }


def previous_period(f: Filters) -> Filters | None:
    if not (f.date_from and f.date_to):
        return None
    days = (f.date_to - f.date_from).days + 1
    end = f.date_from - timedelta(days=1)
    return Filters(end - timedelta(days=days - 1), end, f.employee_id, f.category_id, f.branch)


def _delta(cur: float, prev: float) -> float | None:
    if not prev:
        return None
    return _r((cur - prev) / prev * 100, 1)


def overview(db: Session, company_id: int, f: Filters, seller_scope: int | None = None) -> dict:
    sales = load_sales(db, company_id, f, seller_scope=seller_scope)
    k = _kpis(sales)
    prev = previous_period(f)
    growth: dict = {}
    if prev:
        pk = _kpis(load_sales(db, company_id, prev, seller_scope=seller_scope))
        growth = {
            "revenue": _delta(k["revenue"], pk["revenue"]),
            "transactions": _delta(k["transactions"], pk["transactions"]),
            "avg_ticket": _delta(k["avg_ticket"], pk["avg_ticket"]),
            "median_ticket": _delta(k["median_ticket"], pk["median_ticket"]),
            "customers": _delta(k["customers"], pk["customers"]),
        }

    by_day = _group(sales, lambda s: s.created_at.date().isoformat())
    by_month = _group(sales, lambda s: s.created_at.strftime("%Y-%m"))
    by_weekday = _group(sales, lambda s: s.created_at.weekday())

    prod: dict = defaultdict(lambda: {"units": 0, "revenue": 0.0, "sales": 0})
    cat: dict = defaultdict(float)
    for s in sales:
        for d in s.details:
            p = prod[(d.product_id, d.product.name, d.product.sku)]
            p["units"] += d.quantity
            p["revenue"] += d.line_total
            p["sales"] += 1
            cat[d.product.category.name if d.product.category else "Sin categoría"] += d.line_total
    total_rev = sum(v["revenue"] for v in prod.values()) or 1
    top_products = sorted(
        (
            {"product_id": k[0], "name": k[1], "sku": k[2], "units": v["units"], "revenue": _r(v["revenue"]),
             "share": _r(v["revenue"] / total_rev * 100, 1)}
            for k, v in prod.items()
        ),
        key=lambda r: -r["revenue"],
    )
    sellers = _group(sales, lambda s: s.employee.full_name if s.employee else "Sin asignar")
    payments = _group(sales, lambda s: s.payment_method or "—")
    branches = _group(sales, lambda s: s.branch)

    def fmt(g: dict, label: str = "name") -> list[dict]:
        return sorted(
            (
                {label: key, "count": v["count"], "revenue": _r(v["revenue"]), "units": v["units"],
                 "avg": _r(st.mean(v["totals"])), "median": _r(st.median(v["totals"]))}
                for key, v in g.items()
            ),
            key=lambda r: -r["revenue"],
        )

    totals = [s.total for s in sales]
    stats = st.describe(totals) if totals else None
    compare = st.compare_mean_median(totals) if totals else None
    hist = st.histogram(totals) if len(totals) >= 2 else []

    return {
        "filters": f.as_dict(),
        "kpis": k,
        "growth": growth,
        "by_day": [{"date": d, "count": v["count"], "revenue": _r(v["revenue"])} for d, v in sorted(by_day.items())],
        "by_month": [
            {"month": m, "count": v["count"], "revenue": _r(v["revenue"]), "avg": _r(st.mean(v["totals"])),
             "median": _r(st.median(v["totals"]))}
            for m, v in sorted(by_month.items())
        ],
        "by_weekday": [
            {"day": WEEKDAYS[i], "count": by_weekday[i]["count"] if i in by_weekday else 0,
             "revenue": _r(by_weekday[i]["revenue"]) if i in by_weekday else 0.0}
            for i in range(7)
        ],
        "top_products": top_products[:10],
        "all_products": top_products,
        "by_category": sorted(
            ({"name": n, "revenue": _r(v), "share": _r(v / total_rev * 100, 1)} for n, v in cat.items()),
            key=lambda r: -r["revenue"],
        ),
        "by_seller": fmt(sellers),
        "by_payment": fmt(payments),
        "by_branch": fmt(branches),
        "stats": stats,
        "compare": compare,
        "histogram": hist,
    }


def customers_analysis(db: Session, company_id: int, f: Filters, seller_scope: int | None = None) -> dict:
    sales = load_sales(db, company_id, f, seller_scope=seller_scope)
    g: dict = defaultdict(lambda: {"count": 0, "revenue": 0.0, "last": None, "totals": [], "segment": None})
    for s in sales:
        if not s.customer_id:
            continue
        row = g[(s.customer_id, s.customer.name)]
        row["count"] += 1
        row["revenue"] += s.total
        row["totals"].append(s.total)
        row["segment"] = s.customer.segment
        row["last"] = max(row["last"], s.created_at) if row["last"] else s.created_at
    rows = sorted(
        (
            {"customer_id": k[0], "name": k[1], "segment": v["segment"], "purchases": v["count"],
             "revenue": _r(v["revenue"]), "avg_ticket": _r(st.mean(v["totals"])),
             "last_purchase": v["last"].date().isoformat()}
            for k, v in g.items()
        ),
        key=lambda r: -r["revenue"],
    )
    freq = [r["purchases"] for r in rows]
    dist = []
    if freq:
        from collections import Counter

        c = Counter(freq)
        dist = [{"purchases": k, "customers": v} for k, v in sorted(c.items())]
    seg: dict = defaultdict(lambda: {"revenue": 0.0, "customers": set()})
    for s in sales:
        if s.customer_id:
            seg[s.customer.segment]["revenue"] += s.total
            seg[s.customer.segment]["customers"].add(s.customer_id)
    return {
        "top_customers": rows[:15],
        "frequency_distribution": dist,
        "frequency_stats": st.describe(freq) if freq else None,
        "recurrent_share": _r(sum(1 for x in freq if x > 1) / len(freq) * 100, 1) if freq else 0.0,
        "by_segment": [
            {"segment": k, "revenue": _r(v["revenue"]), "customers": len(v["customers"])} for k, v in seg.items()
        ],
    }


def variable_catalog() -> list[dict]:
    return [{"name": k, "label": v["label"], "unit": v["unit"], "kind": v["kind"]} for k, v in VARIABLES.items()]


def build_variable_analysis(db: Session, company_id: int, variable: str, f: Filters) -> dict:
    sales = load_sales(db, company_id, f)
    vals = series(sales, variable)
    if not vals:
        raise st.StatsError("No hay ventas en el periodo seleccionado.")
    meta = VARIABLES[variable]
    cls = st.classify_variable(vals, variable)
    out = {"variable": variable, "label": meta["label"], "unit": meta["unit"], "classification": cls, "n": len(vals)}
    if cls["type"] == "cuantitativa":
        out["stats"] = st.describe(vals)
        out["compare"] = st.compare_mean_median(vals)
        out["histogram"] = st.histogram(vals)
        if cls["subtype"] == "discreta":
            out["pmf"] = st.analyze_random_variable(vals, "discreta")["pmf"]
    return out


def customer_names(db: Session, company_id: int) -> dict[int, str]:
    return {c.id: c.name for c in db.scalars(select(Customer).where(Customer.company_id == company_id))}
