"""Generación de reportes tabulares (Fase 12). Cada reporte devuelve columnas, filas y resumen."""
from __future__ import annotations

import csv
import io
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Customer, Inventory, Product
from app.services import analytics as an
from app.statistics import engine as st

KINDS = {
    "ventas": "Reporte de ventas",
    "estadistico": "Reporte estadístico",
    "productos": "Reporte de productos",
    "clientes": "Reporte de clientes",
    "vendedores": "Reporte de vendedores",
    "inventario": "Reporte de inventario",
}


def build(db: Session, company_id: int, kind: str, f: an.Filters) -> dict:
    if kind not in KINDS:
        raise st.StatsError("Tipo de reporte no soportado.")
    title = KINDS[kind]
    if kind == "ventas":
        sales = an.load_sales(db, company_id, f, statuses=("completada", "pedido", "anulada"))
        cols = ["Número", "Fecha", "Cliente", "Vendedor", "Sucursal", "Pago", "Estado", "Unidades", "Subtotal", "IGV", "Total"]
        rows = [
            [s.number, s.created_at.strftime("%Y-%m-%d %H:%M"), s.customer.name if s.customer else "Cliente general",
             s.employee.full_name if s.employee else "", s.branch, s.payment_method or "", s.status, s.units,
             s.subtotal, s.tax, s.total]
            for s in sales
        ]
        done = [s.total for s in sales if s.status == "completada"]
        summary = {"Ventas completadas": len(done), "Ingresos": round(sum(done), 2),
                   "Ticket promedio": round(st.mean(done), 2) if done else 0}
    elif kind == "estadistico":
        sales = an.load_sales(db, company_id, f)
        cols = ["Variable", "n", "Media", "Mediana", "Moda", "Mín", "Máx", "Desv. est.", "CV %", "Asimetría", "Forma"]
        rows = []
        for key in ("monto_venta", "unidades_por_venta", "items_por_venta", "descuento_venta"):
            vals = an.series(sales, key)
            if not vals:
                continue
            d, c = st.describe(vals), st.compare_mean_median(vals)
            rows.append([an.VARIABLES[key]["label"], d["n"], round(d["mean"], 2), round(d["median"], 2),
                         ", ".join(str(round(m, 2)) for m in d["mode"]) or "—", d["min"], d["max"],
                         round(d["std"], 2), round((d["cv"] or 0) * 100, 1), round(d["skewness"], 2), c["shape"]])
        summary = {"Ventas analizadas": len(sales)}
    elif kind == "productos":
        ov = an.overview(db, company_id, f)
        cols = ["SKU", "Producto", "Unidades", "Ingresos", "Participación %"]
        rows = [[p["sku"], p["name"], p["units"], p["revenue"], p["share"]] for p in ov["all_products"]]
        summary = {"Productos vendidos": len(rows), "Ingresos": ov["kpis"]["revenue"]}
    elif kind == "clientes":
        ca = an.customers_analysis(db, company_id, f)
        cols = ["Cliente", "Segmento", "Compras", "Ingresos", "Ticket promedio", "Última compra"]
        rows = [[c["name"], c["segment"], c["purchases"], c["revenue"], c["avg_ticket"], c["last_purchase"]]
                for c in ca["top_customers"]]
        summary = {"Clientes recurrentes %": ca["recurrent_share"]}
    elif kind == "vendedores":
        ov = an.overview(db, company_id, f)
        cols = ["Vendedor", "Ventas", "Ingresos", "Unidades", "Ticket promedio", "Mediana"]
        rows = [[s["name"], s["count"], s["revenue"], s["units"], s["avg"], s["median"]] for s in ov["by_seller"]]
        summary = {"Ingresos totales": ov["kpis"]["revenue"]}
    else:  # inventario
        data = db.execute(
            select(Product.sku, Product.name, Inventory.stock, Inventory.min_stock, Product.price, Product.cost)
            .join(Inventory, Inventory.product_id == Product.id)
            .where(Product.company_id == company_id).order_by(Product.name)
        ).all()
        cols = ["SKU", "Producto", "Stock", "Mínimo", "Precio", "Costo", "Valor en stock", "Estado"]
        rows = [[r.sku, r.name, r.stock, r.min_stock, r.price, r.cost, round(r.stock * r.cost, 2),
                 "Agotado" if r.stock == 0 else "Bajo" if r.stock <= r.min_stock else "Normal"] for r in data]
        summary = {"Valor del inventario": round(sum(r[6] for r in rows), 2)}
    return {
        "kind": kind, "title": title, "generated_at": date.today().isoformat(),
        "filters": f.as_dict(), "columns": cols, "rows": rows, "summary": summary,
    }


def to_csv(report: dict) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([report["title"], report["generated_at"]])
    w.writerow(report["columns"])
    w.writerows(report["rows"])
    return "﻿" + buf.getvalue()  # BOM para que Excel respete tildes
