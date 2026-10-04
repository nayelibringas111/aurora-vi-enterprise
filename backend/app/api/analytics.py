"""Dashboard, motor estadístico, probabilidad, insights, reportes y auditoría."""
from collections import Counter
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import client_ip, require
from app.models import (
    AuditLog, BayesAnalysis, Dataset, DatasetVariable, Employee, Inventory, Insight, Observation,
    Product, RandomVariable, Report, Sale, StatisticalAnalysis, StatisticalResult, User,
)
from app.probability import bayes as by
from app.reports import builder
from app.schemas import BayesEmpiricalIn, BayesIn, ProbabilityIn, RandomVarIn, ValuesIn
from app.services import analytics as an
from app.services import audit, insights as ins
from app.statistics import engine as st

router = APIRouter(tags=["Analytics"])


def _filters(date_from, date_to, employee_id=None, category_id=None, branch=None) -> an.Filters:
    return an.Filters(date_from, date_to, employee_id, category_id, branch)


def _scope(db: Session, user: User) -> int | None:
    if user.role == "vendedor":
        return db.scalar(select(Employee.id).where(Employee.user_id == user.id)) or -1
    return None


def _stats_error(e: Exception) -> HTTPException:
    return HTTPException(422, str(e))


def _resolve_values(db: Session, user: User, values, variable, date_from, date_to) -> tuple[list, str | None]:
    if values:
        return values, variable
    if not variable:
        raise HTTPException(422, "Indique 'values' o 'variable'.")
    if variable not in an.VARIABLES:
        raise HTTPException(422, "Variable desconocida.")
    sales = an.load_sales(db, user.company_id, an.Filters(date_from, date_to))
    return an.series(sales, variable), variable


def _save_analysis(db: Session, user: User, kind: str, variable, params: dict, n: int, results: dict[str, float | None | dict]) -> int:
    a = StatisticalAnalysis(company_id=user.company_id, kind=kind, variable=variable, params=params, sample_size=n, created_by=user.id)
    db.add(a)
    db.flush()
    for metric, val in results.items():
        if isinstance(val, dict) or isinstance(val, list):
            db.add(StatisticalResult(analysis_id=a.id, metric=metric, value=None, payload={"data": val}))
        else:
            db.add(StatisticalResult(analysis_id=a.id, metric=metric, value=val))
    return a.id


# ---------------------------------------------------------------- Dashboard
@router.get("/dashboard/summary")
def dashboard_summary(
    days: int = Query(30, ge=1, le=730),
    user: User = Depends(require("dashboard:read")), db: Session = Depends(get_db),
):
    today = date.today()
    f = an.Filters(today - timedelta(days=days - 1), today)
    ov = an.overview(db, user.company_id, f, seller_scope=_scope(db, user))
    low = db.execute(
        select(Product.id, Product.name, Product.sku, Inventory.stock, Inventory.min_stock)
        .join(Inventory, Inventory.product_id == Product.id)
        .where(Product.company_id == user.company_id, Product.is_active.is_(True), Inventory.stock <= Inventory.min_stock)
        .order_by(Inventory.stock).limit(8)
    ).all()
    recent_insights = db.scalars(
        select(Insight).where(Insight.company_id == user.company_id).order_by(Insight.created_at.desc()).limit(4)
    )
    return {
        "days": days,
        "kpis": ov["kpis"], "growth": ov["growth"], "by_day": ov["by_day"], "by_month": ov["by_month"],
        "top_products": ov["top_products"][:6], "by_category": ov["by_category"], "by_seller": ov["by_seller"][:6],
        "by_payment": ov["by_payment"], "compare": ov["compare"],
        "low_stock": [{"id": r.id, "name": r.name, "sku": r.sku, "stock": r.stock, "min_stock": r.min_stock} for r in low],
        "insights": [ins.serialize(i) for i in recent_insights],
    }


@router.get("/analytics/overview")
def analytics_overview(
    date_from: date | None = None, date_to: date | None = None, employee_id: int | None = None,
    category_id: int | None = None, branch: str | None = None,
    user: User = Depends(require("analytics:read")), db: Session = Depends(get_db),
):
    return an.overview(db, user.company_id, _filters(date_from, date_to, employee_id, category_id, branch))


@router.get("/analytics/customers")
def analytics_customers(
    date_from: date | None = None, date_to: date | None = None,
    user: User = Depends(require("analytics:read")), db: Session = Depends(get_db),
):
    return an.customers_analysis(db, user.company_id, _filters(date_from, date_to))


@router.get("/analytics/variables")
def analytics_variables(user: User = Depends(require("analytics:read"))):
    return an.variable_catalog()


@router.get("/analytics/variables/{variable}")
def analytics_variable(
    variable: str, date_from: date | None = None, date_to: date | None = None,
    user: User = Depends(require("analytics:read")), db: Session = Depends(get_db),
):
    if variable not in an.VARIABLES:
        raise HTTPException(404, "Variable no encontrada")
    try:
        return an.build_variable_analysis(db, user.company_id, variable, _filters(date_from, date_to))
    except st.StatsError as e:
        raise _stats_error(e)


# ---------------------------------------------------------------- Motor estadístico (RF-11..15)
@router.post("/statistics/mean")
def stats_mean(p: ValuesIn, request: Request, user: User = Depends(require("analytics:write")), db: Session = Depends(get_db)):
    try:
        vals, var = _resolve_values(db, user, p.values, p.variable, p.date_from, p.date_to)
        m = st.mean(vals)
    except st.StatsError as e:
        raise _stats_error(e)
    aid = None
    if p.save:
        aid = _save_analysis(db, user, "media", var, {"manual": bool(p.values)}, len(vals), {"media": m})
        audit.log(db, user, "analysis.mean", "analysis", aid, {"variable": var}, client_ip(request))
        db.commit()
    return {"mean": m, "n": len(vals), "formula": "media = (x₁ + x₂ + … + xₙ) / n", "sum": sum(vals), "analysis_id": aid}


@router.post("/statistics/median")
def stats_median(p: ValuesIn, request: Request, user: User = Depends(require("analytics:write")), db: Session = Depends(get_db)):
    try:
        vals, var = _resolve_values(db, user, p.values, p.variable, p.date_from, p.date_to)
        md = st.median(vals)
    except st.StatsError as e:
        raise _stats_error(e)
    ordered = sorted(float(v) for v in vals)
    n = len(ordered)
    aid = None
    if p.save:
        aid = _save_analysis(db, user, "mediana", var, {"manual": bool(p.values)}, n, {"mediana": md})
        audit.log(db, user, "analysis.median", "analysis", aid, {"variable": var}, client_ip(request))
        db.commit()
    return {
        "median": md, "n": n, "analysis_id": aid,
        "method": "Se ordenan los datos y se toma el valor central" + (
            "; con n par se promedian los dos centrales." if n % 2 == 0 else "."),
        "central_values": ordered[n // 2 - 1: n // 2 + 1] if n % 2 == 0 else [ordered[n // 2]],
    }


@router.post("/statistics/compare")
def stats_compare(p: ValuesIn, request: Request, user: User = Depends(require("analytics:write")), db: Session = Depends(get_db)):
    try:
        vals, var = _resolve_values(db, user, p.values, p.variable, p.date_from, p.date_to)
        cmp_ = st.compare_mean_median(vals)
        desc = st.describe(vals)
        hist = st.histogram(vals) if len(vals) > 1 else []
        cls = st.classify_variable(vals, var)
    except st.StatsError as e:
        raise _stats_error(e)
    aid = None
    if p.save:
        aid = _save_analysis(db, user, "comparacion", var, {"manual": bool(p.values)}, len(vals),
                             {"media": cmp_["mean"], "mediana": cmp_["median"], "brecha_pct": cmp_["relative_gap_pct"],
                              "forma": {"shape": cmp_["shape"]}})
        audit.log(db, user, "analysis.compare", "analysis", aid, {"variable": var}, client_ip(request))
        db.commit()
    return {**cmp_, "describe": desc, "histogram": hist, "classification": cls, "analysis_id": aid}


@router.post("/random-variables/analyze")
def analyze_random(p: RandomVarIn, request: Request, user: User = Depends(require("probability:write")), db: Session = Depends(get_db)):
    try:
        vals, var = _resolve_values(db, user, p.values, p.variable, p.date_from, p.date_to)
        res = st.analyze_random_variable(vals, p.kind)
    except st.StatsError as e:
        raise _stats_error(e)
    aid = None
    if p.save:
        name = an.VARIABLES[var]["label"] if var in an.VARIABLES else "Variable manual"
        db.add(RandomVariable(company_id=user.company_id, name=name, kind=res["kind"],
                              definition={"variable": var, "n": res["n"]}, created_by=user.id))
        aid = _save_analysis(db, user, "variable_aleatoria", var, {"kind": res["kind"]}, res["n"],
                             {"esperanza": res["expected_value"], "varianza": res["variance"]})
        audit.log(db, user, "analysis.random_variable", "analysis", aid, {"variable": var}, client_ip(request))
        db.commit()
    return {**res, "analysis_id": aid}


@router.post("/probability/event")
def probability_event(p: ProbabilityIn, user: User = Depends(require("probability:read")), db: Session = Depends(get_db)):
    try:
        vals, _ = _resolve_values(db, user, p.values, p.variable, p.date_from, p.date_to)
        return st.empirical_probability(vals, p.op, p.threshold, p.upper)
    except st.StatsError as e:
        raise _stats_error(e)


@router.post("/probability/bayes")
def probability_bayes(p: BayesIn, request: Request, user: User = Depends(require("probability:write")), db: Session = Depends(get_db)):
    try:
        res = by.bayes(p.prior, p.likelihood, p.false_positive, p.marginal)
    except st.StatsError as e:
        raise _stats_error(e)
    if p.save:
        db.add(BayesAnalysis(company_id=user.company_id, hypothesis=p.hypothesis, evidence=p.evidence, prior=res["prior"],
                             likelihood=res["likelihood"], marginal=res["marginal"], posterior=res["posterior"],
                             source="manual", detail={"steps": res["steps"]}, created_by=user.id))
        audit.log(db, user, "analysis.bayes", "bayes", None, {"posterior": res["posterior"]}, client_ip(request))
        db.commit()
    return res


@router.post("/probability/bayes/empirical")
def bayes_empirical(p: BayesEmpiricalIn, request: Request, user: User = Depends(require("probability:write")), db: Session = Depends(get_db)):
    """A = «la venta es alta (≥ umbral)»; B = «se pagó con el método indicado»."""
    sales = an.load_sales(db, user.company_id, an.Filters(p.date_from, p.date_to))
    if p.segment:
        sales = [s for s in sales if s.customer and s.customer.segment == p.segment]
    total = len(sales)
    a = sum(1 for s in sales if s.total >= p.threshold)
    b = sum(1 for s in sales if s.payment_method == p.payment_method)
    ab = sum(1 for s in sales if s.total >= p.threshold and s.payment_method == p.payment_method)
    try:
        res = by.bayes_from_counts(total, a, b, ab)
    except st.StatsError as e:
        raise _stats_error(e)
    hyp = f"Venta alta (≥ S/ {p.threshold:,.0f})"
    ev = f"Pago con {p.payment_method}"
    res.update(hypothesis=hyp, evidence=ev)
    if p.save:
        db.add(BayesAnalysis(company_id=user.company_id, hypothesis=hyp, evidence=ev, prior=res["prior"],
                             likelihood=res["likelihood"], marginal=res["marginal"], posterior=res["posterior"],
                             source="ventas", detail={"counts": res["counts"], "steps": res["steps"]}, created_by=user.id))
        audit.log(db, user, "analysis.bayes_empirical", "bayes", None, {"posterior": res["posterior"]}, client_ip(request))
        db.commit()
    return res


@router.get("/statistics/history")
def analysis_history(limit: int = Query(30, le=200), user: User = Depends(require("analytics:read")), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(StatisticalAnalysis).where(StatisticalAnalysis.company_id == user.company_id)
        .order_by(StatisticalAnalysis.created_at.desc(), StatisticalAnalysis.id.desc()).limit(limit)
    )
    out = []
    for a in rows:
        out.append({
            "id": a.id, "kind": a.kind, "variable": a.variable, "n": a.sample_size,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "results": {r.metric: (r.value if r.value is not None else r.payload) for r in a.results},
        })
    bayes_rows = db.scalars(
        select(BayesAnalysis).where(BayesAnalysis.company_id == user.company_id).order_by(BayesAnalysis.created_at.desc()).limit(limit)
    )
    return {
        "analyses": out,
        "bayes": [
            {"id": b.id, "hypothesis": b.hypothesis, "evidence": b.evidence, "prior": b.prior, "likelihood": b.likelihood,
             "marginal": b.marginal, "posterior": b.posterior, "source": b.source,
             "created_at": b.created_at.isoformat() if b.created_at else None}
            for b in bayes_rows
        ],
    }


@router.post("/datasets/snapshot", status_code=201)
def dataset_snapshot(
    request: Request, date_from: date | None = None, date_to: date | None = None, name: str | None = None,
    user: User = Depends(require("analytics:write")), db: Session = Depends(get_db),
):
    """Congela las ventas del periodo como un dataset analítico (datasets/variables/observaciones)."""
    sales = an.load_sales(db, user.company_id, an.Filters(date_from, date_to))
    if not sales:
        raise HTTPException(422, "No hay ventas en el periodo.")
    ds = Dataset(company_id=user.company_id, name=name or f"Ventas {date.today().isoformat()}", source="ventas",
                 row_count=len(sales), filters={"date_from": str(date_from), "date_to": str(date_to)}, created_by=user.id)
    db.add(ds)
    db.flush()
    for key, meta in an.VARIABLES.items():
        if not meta["kind"].startswith("cuantitativa"):
            continue
        var = DatasetVariable(dataset_id=ds.id, name=key, label=meta["label"], kind=meta["kind"], unit=meta["unit"])
        db.add(var)
        db.flush()
        db.add_all(
            Observation(variable_id=var.id, row_index=i, value=float(meta["extract"](s)), label=s.number)
            for i, s in enumerate(sales)
        )
    audit.log(db, user, "dataset.snapshot", "dataset", ds.id, {"rows": len(sales)}, client_ip(request))
    db.commit()
    return {"id": ds.id, "name": ds.name, "rows": ds.row_count}


@router.get("/datasets")
def list_datasets(user: User = Depends(require("analytics:read")), db: Session = Depends(get_db)):
    rows = db.scalars(select(Dataset).where(Dataset.company_id == user.company_id).order_by(Dataset.created_at.desc()))
    return [
        {"id": d.id, "name": d.name, "rows": d.row_count, "source": d.source,
         "created_at": d.created_at.isoformat() if d.created_at else None,
         "variables": [{"name": v.name, "label": v.label, "kind": v.kind} for v in d.variables]}
        for d in rows
    ]


# ---------------------------------------------------------------- Insights
@router.get("/insights")
def list_insights(user: User = Depends(require("insights:read")), db: Session = Depends(get_db)):
    rows = db.scalars(select(Insight).where(Insight.company_id == user.company_id, Insight.is_active.is_(True)).order_by(Insight.id))
    items = [ins.serialize(i) for i in rows]
    order = {"critico": 0, "atencion": 1, "positivo": 2, "info": 3}
    items.sort(key=lambda i: order.get(i["severity"], 9))
    return items


@router.post("/insights/generate")
def generate_insights(
    request: Request, days: int = Query(90, ge=7, le=730),
    user: User = Depends(require("insights:write")), db: Session = Depends(get_db),
):
    rows = ins.regenerate(db, user, days)
    audit.log(db, user, "insights.generate", "insight", None, {"count": len(rows), "days": days}, client_ip(request))
    db.commit()
    return [ins.serialize(r) for r in rows]


# ---------------------------------------------------------------- Reportes
@router.get("/reports/kinds")
def report_kinds(user: User = Depends(require("reports:read"))):
    return [{"kind": k, "title": v} for k, v in builder.KINDS.items()]


@router.get("/reports/history")
def report_history(user: User = Depends(require("reports:read")), db: Session = Depends(get_db)):
    rows = db.scalars(select(Report).where(Report.company_id == user.company_id).order_by(Report.created_at.desc()).limit(30))
    return [
        {"id": r.id, "kind": r.kind, "title": r.title, "rows": r.row_count, "params": r.params,
         "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in rows
    ]


@router.get("/reports")
def generate_report(
    request: Request, kind: str = "ventas", date_from: date | None = None, date_to: date | None = None,
    format: str = Query("json", pattern="^(json|csv)$"),
    user: User = Depends(require("reports:read")), db: Session = Depends(get_db),
):
    try:
        rep = builder.build(db, user.company_id, kind, an.Filters(date_from, date_to))
    except st.StatsError as e:
        raise _stats_error(e)
    db.add(Report(company_id=user.company_id, kind=kind, title=rep["title"], params=rep["filters"],
                  row_count=len(rep["rows"]), created_by=user.id))
    audit.log(db, user, "report.generate", "report", None, {"kind": kind, "format": format}, client_ip(request))
    db.commit()
    if format == "csv":
        return Response(
            builder.to_csv(rep), media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="aurora-vi-{kind}-{date.today().isoformat()}.csv"'},
        )
    return rep


# ---------------------------------------------------------------- Auditoría
@router.get("/audit")
def audit_logs(
    action: str | None = None, limit: int = Query(100, le=500),
    user: User = Depends(require("audit:read")), db: Session = Depends(get_db),
):
    stmt = select(AuditLog).where((AuditLog.company_id == user.company_id) | (AuditLog.company_id.is_(None)))
    if action:
        stmt = stmt.where(AuditLog.action.like(f"{action}%"))
    rows = db.scalars(stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(limit))
    return [
        {"id": a.id, "user": a.user_email, "action": a.action, "entity": a.entity, "entity_id": a.entity_id,
         "detail": a.detail, "ip": a.ip, "created_at": a.created_at.isoformat() if a.created_at else None}
        for a in rows
    ]
