"""Motor de insights basado en reglas determinísticas (Fase 11).

Cada insight conserva la evidencia numérica que lo originó, de modo que sea explicable.
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Inventory, Insight, Product, StatisticalAnalysis, StatisticalResult, User
from app.services import analytics as an
from app.statistics import engine as st


def _money(x: float) -> str:
    return f"S/ {x:,.2f}"


def evaluate(db: Session, company_id: int, days: int = 90) -> list[dict]:
    today = date.today()
    f = an.Filters(today - timedelta(days=days - 1), today)
    ov = an.overview(db, company_id, f)
    out: list[dict] = []
    k = ov["kpis"]
    if k["transactions"] < 5:
        return [
            {
                "rule_code": "datos_insuficientes", "severity": "info",
                "title": "Datos insuficientes para el análisis",
                "message": "Se necesitan al menos 5 ventas completadas en el periodo para generar conclusiones fiables.",
                "evidence": {"transacciones": k["transactions"], "dias": days},
            }
        ]

    cmp_ = ov["compare"]
    if cmp_ and abs(cmp_["relative_gap_pct"]) >= 10:
        higher = cmp_["difference"] > 0
        out.append({
            "rule_code": "media_vs_mediana",
            "severity": "atencion" if higher else "info",
            "title": "El ticket promedio no representa la venta típica" if higher else "Las ventas pequeñas arrastran el promedio",
            "message": (
                f"La media ({_money(cmp_['mean'])}) difiere {abs(cmp_['relative_gap_pct']):.1f}% de la mediana "
                f"({_money(cmp_['median'])}). " + cmp_["interpretation"]
            ),
            "evidence": {"media": round(cmp_["mean"], 2), "mediana": round(cmp_["median"], 2),
                         "brecha_pct": round(cmp_["relative_gap_pct"], 1), "n": cmp_["n"]},
        })

    g = ov["growth"].get("revenue")
    if g is not None:
        if g <= -10:
            out.append({
                "rule_code": "ingresos_caida", "severity": "critico" if g <= -25 else "atencion",
                "title": f"Los ingresos cayeron {abs(g):.1f}% frente al periodo anterior",
                "message": f"Los ingresos del periodo suman {_money(k['revenue'])}. Revise productos y vendedores con menor actividad.",
                "evidence": {"ingresos": k["revenue"], "variacion_pct": g},
            })
        elif g >= 10:
            out.append({
                "rule_code": "ingresos_alza", "severity": "positivo",
                "title": f"Los ingresos crecieron {g:.1f}% frente al periodo anterior",
                "message": f"Los ingresos del periodo suman {_money(k['revenue'])}. Conviene asegurar stock en los productos líderes.",
                "evidence": {"ingresos": k["revenue"], "variacion_pct": g},
            })

    tp = ov["top_products"]
    if tp:
        top3 = sum(p["share"] for p in tp[:3])
        if top3 >= 50:
            out.append({
                "rule_code": "concentracion_productos", "severity": "atencion",
                "title": "Alta concentración de ingresos en pocos productos",
                "message": f"Tres productos concentran {top3:.1f}% de los ingresos. Un quiebre de stock en ellos afectaría directamente la facturación.",
                "evidence": {"top3_pct": round(top3, 1), "productos": [p["name"] for p in tp[:3]]},
            })

    sellers = [s for s in ov["by_seller"] if s["name"] != "Sin asignar"]
    if len(sellers) >= 3:
        revs = [s["revenue"] for s in sellers]
        cv = st.std(revs) / st.mean(revs) if st.mean(revs) else 0
        if cv >= 0.35:
            best, worst = sellers[0], sellers[-1]
            out.append({
                "rule_code": "dispersion_vendedores", "severity": "info",
                "title": "Rendimiento desigual entre vendedores",
                "message": (f"{best['name']} lidera con {_money(best['revenue'])}, mientras {worst['name']} registra "
                            f"{_money(worst['revenue'])}. El coeficiente de variación es {cv * 100:.0f}%."),
                "evidence": {"cv_pct": round(cv * 100, 1), "mejor": best["name"], "menor": worst["name"]},
            })

    if k["revenue"]:
        disc_pct = k["discounts"] / (k["revenue"] + k["discounts"]) * 100
        if disc_pct >= 8:
            out.append({
                "rule_code": "descuentos_altos", "severity": "atencion",
                "title": "Nivel de descuentos elevado",
                "message": f"Los descuentos representan {disc_pct:.1f}% del valor bruto vendido ({_money(k['discounts'])}).",
                "evidence": {"descuentos": k["discounts"], "pct_bruto": round(disc_pct, 1)},
            })

    low = db.execute(
        select(Product.name, Inventory.stock, Inventory.min_stock)
        .join(Inventory, Inventory.product_id == Product.id)
        .where(Product.company_id == company_id, Product.is_active.is_(True), Inventory.stock <= Inventory.min_stock)
        .order_by(Inventory.stock)
    ).all()
    if low:
        out.append({
            "rule_code": "stock_bajo", "severity": "critico" if any(r.stock == 0 for r in low) else "atencion",
            "title": f"{len(low)} producto(s) con stock en o bajo el mínimo",
            "message": "Reponer: " + ", ".join(f"{r.name} ({r.stock})" for r in low[:5]) + ("…" if len(low) > 5 else "."),
            "evidence": {"productos": [{"nombre": r.name, "stock": r.stock, "minimo": r.min_stock} for r in low[:10]]},
        })

    cust = an.customers_analysis(db, company_id, f)
    if cust["frequency_stats"]:
        rec = cust["recurrent_share"]
        if rec < 30:
            out.append({
                "rule_code": "baja_recurrencia", "severity": "atencion",
                "title": "Baja recurrencia de clientes",
                "message": f"Solo {rec:.1f}% de los clientes compró más de una vez en el periodo. Un programa de fidelización podría elevar la frecuencia.",
                "evidence": {"recurrentes_pct": rec},
            })
        elif rec >= 60:
            out.append({
                "rule_code": "alta_recurrencia", "severity": "positivo",
                "title": "Base de clientes fiel",
                "message": f"{rec:.1f}% de los clientes compró más de una vez en el periodo.",
                "evidence": {"recurrentes_pct": rec},
            })

    wd = max(ov["by_weekday"], key=lambda r: r["revenue"])
    if wd["revenue"] > 0:
        out.append({
            "rule_code": "dia_pico", "severity": "info",
            "title": f"El día de mayor venta es {wd['day']}",
            "message": f"Concentra {_money(wd['revenue'])} en el periodo. Refuerce personal y stock para ese día.",
            "evidence": {"dia": wd["day"], "ingresos": wd["revenue"]},
        })
    return out


def regenerate(db: Session, user: User, days: int = 90) -> list[Insight]:
    items = evaluate(db, user.company_id, days)
    analysis = StatisticalAnalysis(
        company_id=user.company_id, kind="insights", variable="monto_venta",
        params={"dias": days}, sample_size=len(items), created_by=user.id,
    )
    db.add(analysis)
    db.flush()
    db.add(StatisticalResult(analysis_id=analysis.id, metric="insights_generados", value=len(items)))
    db.execute(delete(Insight).where(Insight.company_id == user.company_id))
    rows = [
        Insight(company_id=user.company_id, analysis_id=analysis.id, **i)
        for i in items
    ]
    db.add_all(rows)
    db.commit()
    return rows


def serialize(i: Insight) -> dict:
    return {
        "id": i.id, "rule_code": i.rule_code, "severity": i.severity, "title": i.title,
        "message": i.message, "evidence": i.evidence, "analysis_id": i.analysis_id,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }
