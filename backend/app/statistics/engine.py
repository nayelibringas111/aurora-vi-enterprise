"""Motor estadístico (Semana 07): media, mediana, variables y variables aleatorias.

Funciones puras, sin dependencias de base de datos, para poder probarlas de forma aislada.
"""
from __future__ import annotations

import math
from collections import Counter
from typing import Iterable, Sequence

import numpy as np


class StatsError(ValueError):
    """Error de validación en cálculos estadísticos."""


def clean(values: Iterable) -> list[float]:
    out: list[float] = []
    for v in values:
        if v is None:
            continue
        try:
            f = float(v)
        except (TypeError, ValueError) as exc:
            raise StatsError(f"Valor no numérico: {v!r}") from exc
        if math.isnan(f) or math.isinf(f):
            continue
        out.append(f)
    if not out:
        raise StatsError("Se necesita al menos un valor numérico.")
    return out


def mean(values: Iterable) -> float:
    """media = (x1 + x2 + ... + xn) / n"""
    v = clean(values)
    return sum(v) / len(v)


def median(values: Iterable) -> float:
    """Valor central de los datos ordenados; promedio de los dos centrales si n es par."""
    v = sorted(clean(values))
    n = len(v)
    mid = n // 2
    return v[mid] if n % 2 else (v[mid - 1] + v[mid]) / 2


def mode(values: Iterable) -> list[float]:
    v = clean(values)
    counts = Counter(v)
    top = max(counts.values())
    if top == 1 and len(v) > 1:
        return []
    return sorted(k for k, c in counts.items() if c == top)


def variance(values: Iterable, sample: bool = True) -> float:
    v = clean(values)
    n = len(v)
    if sample and n < 2:
        return 0.0
    m = sum(v) / n
    return sum((x - m) ** 2 for x in v) / (n - 1 if sample else n)


def std(values: Iterable, sample: bool = True) -> float:
    return math.sqrt(variance(values, sample))


def quartiles(values: Iterable) -> tuple[float, float, float]:
    v = np.array(clean(values))
    q1, q2, q3 = np.percentile(v, [25, 50, 75])
    return float(q1), float(q2), float(q3)


def skewness(values: Iterable) -> float:
    v = np.array(clean(values))
    if len(v) < 3:
        return 0.0
    m = v.mean()
    m2 = ((v - m) ** 2).mean()
    if m2 == 0:
        return 0.0
    m3 = ((v - m) ** 3).mean()
    return float(m3 / m2 ** 1.5)


def histogram(values: Iterable, bins: int | None = None) -> list[dict]:
    v = np.array(clean(values))
    if bins is None:
        bins = max(5, min(20, int(math.ceil(math.log2(len(v)) + 1))))
    if v.min() == v.max():
        return [{"start": float(v.min()), "end": float(v.max()), "count": int(len(v)), "frequency": 1.0}]
    counts, edges = np.histogram(v, bins=bins)
    total = counts.sum()
    return [
        {
            "start": float(edges[i]),
            "end": float(edges[i + 1]),
            "count": int(counts[i]),
            "frequency": float(counts[i] / total),
        }
        for i in range(len(counts))
    ]


def describe(values: Iterable) -> dict:
    v = clean(values)
    q1, _, q3 = quartiles(v)
    return {
        "n": len(v),
        "sum": float(sum(v)),
        "mean": mean(v),
        "median": median(v),
        "mode": mode(v)[:3],
        "min": float(min(v)),
        "max": float(max(v)),
        "range": float(max(v) - min(v)),
        "q1": q1,
        "q3": q3,
        "iqr": q3 - q1,
        "variance": variance(v),
        "std": std(v),
        "cv": (std(v) / mean(v)) if mean(v) else None,
        "skewness": skewness(v),
    }


def compare_mean_median(values: Iterable) -> dict:
    """Compara media y mediana e interpreta la forma de la distribución."""
    v = clean(values)
    m, md = mean(v), median(v)
    diff = m - md
    rel = (diff / md * 100) if md else 0.0
    if abs(rel) < 5:
        shape, text = "simétrica", (
            "La media y la mediana son muy parecidas: los valores se reparten de forma "
            "equilibrada y la media representa bien al valor típico."
        )
    elif diff > 0:
        shape, text = "sesgo positivo", (
            "La media supera a la mediana: unos pocos valores altos elevan el promedio. "
            "El valor central describe mejor lo que ocurre en una operación típica."
        )
    else:
        shape, text = "sesgo negativo", (
            "La media es menor que la mediana: unos pocos valores bajos arrastran el promedio hacia abajo."
        )
    return {
        "mean": m,
        "median": md,
        "difference": diff,
        "relative_gap_pct": rel,
        "shape": shape,
        "interpretation": text,
        "n": len(v),
    }


def classify_variable(values: Sequence, name: str | None = None) -> dict:
    """Clasifica una variable estadística según la naturaleza de sus valores."""
    vals = [v for v in values if v is not None and v != ""]
    if not vals:
        raise StatsError("La variable no tiene datos.")
    numeric = True
    nums: list[float] = []
    for v in vals:
        if isinstance(v, bool):
            numeric = False
            break
        try:
            nums.append(float(v))
        except (TypeError, ValueError):
            numeric = False
            break
    if not numeric:
        freq = Counter(str(v) for v in vals)
        total = sum(freq.values())
        return {
            "name": name,
            "type": "cualitativa",
            "subtype": "nominal",
            "label": "Cualitativa nominal",
            "n": total,
            "distinct": len(freq),
            "frequencies": [
                {"value": k, "count": c, "frequency": c / total} for k, c in freq.most_common()
            ],
            "explanation": "Los valores son categorías sin orden natural; se resumen con frecuencias y moda.",
        }
    is_int = all(float(x).is_integer() for x in nums)
    distinct = len(set(nums))
    if is_int:
        subtype, label = "discreta", "Cuantitativa discreta"
        expl = "Toma valores enteros contables (conteos); admite tabla de frecuencias y función de probabilidad."
    else:
        subtype, label = "continua", "Cuantitativa continua"
        expl = "Puede tomar cualquier valor en un intervalo (montos, medidas); se resume con histogramas."
    return {
        "name": name,
        "type": "cuantitativa",
        "subtype": subtype,
        "label": label,
        "n": len(nums),
        "distinct": distinct,
        "explanation": expl,
    }


def empirical_probability(values: Iterable, op: str, threshold: float, upper: float | None = None) -> dict:
    v = clean(values)
    ops = {
        "gt": lambda x: x > threshold,
        "ge": lambda x: x >= threshold,
        "lt": lambda x: x < threshold,
        "le": lambda x: x <= threshold,
        "eq": lambda x: x == threshold,
    }
    if op == "between":
        if upper is None:
            raise StatsError("between requiere un límite superior.")
        fn = lambda x: threshold <= x <= upper  # noqa: E731
    elif op in ops:
        fn = ops[op]
    else:
        raise StatsError(f"Operador no soportado: {op}")
    hits = sum(1 for x in v if fn(x))
    return {"op": op, "threshold": threshold, "upper": upper, "favorable": hits, "total": len(v), "probability": hits / len(v)}


def analyze_random_variable(values: Iterable, kind: str | None = None) -> dict:
    """Analiza una variable aleatoria discreta (PMF, E[X], Var) o continua (histograma de densidad)."""
    v = clean(values)
    if kind is None:
        kind = "discreta" if all(x.is_integer() for x in v) and len(set(v)) <= 30 else "continua"
    n = len(v)
    out: dict = {"kind": kind, "n": n}
    if kind == "discreta":
        counts = Counter(v)
        xs = sorted(counts)
        pmf = [{"x": x, "p": counts[x] / n, "count": counts[x]} for x in xs]
        cum = 0.0
        for row in pmf:
            cum += row["p"]
            row["cdf"] = min(cum, 1.0)
        ex = sum(r["x"] * r["p"] for r in pmf)
        ex2 = sum((r["x"] ** 2) * r["p"] for r in pmf)
        var = ex2 - ex ** 2
        out.update(
            pmf=pmf,
            expected_value=ex,
            variance=var,
            std=math.sqrt(max(var, 0)),
            mode=[r["x"] for r in pmf if r["count"] == max(c["count"] for c in pmf)],
        )
    else:
        hist = histogram(v)
        for h in hist:
            width = (h["end"] - h["start"]) or 1.0
            h["density"] = h["frequency"] / width
        out.update(
            histogram=hist,
            expected_value=mean(v),
            variance=variance(v, sample=False),
            std=std(v, sample=False),
            median=median(v),
        )
    out["formula"] = (
        "E[X] = Σ x·P(x)    Var(X) = E[X²] − E[X]²" if kind == "discreta" else "E[X] ≈ x̄    Var(X) ≈ Σ(x − x̄)² / n"
    )
    return out
