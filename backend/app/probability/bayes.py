"""Teorema de Bayes: P(A|B) = P(B|A) · P(A) / P(B)."""
from __future__ import annotations

from app.statistics.engine import StatsError


def _check(name: str, value: float) -> float:
    if value is None or not (0.0 <= value <= 1.0):
        raise StatsError(f"{name} debe estar entre 0 y 1.")
    return float(value)


def bayes(prior: float, likelihood: float, false_positive: float | None = None, marginal: float | None = None) -> dict:
    """Calcula la probabilidad posterior y devuelve el desarrollo paso a paso.

    prior          = P(A)       probabilidad a priori de la hipótesis
    likelihood     = P(B|A)     probabilidad de la evidencia si la hipótesis es cierta
    false_positive = P(B|¬A)    probabilidad de la evidencia si la hipótesis es falsa
    marginal       = P(B)       alternativa a false_positive si ya se conoce P(B)
    """
    prior = _check("P(A)", prior)
    likelihood = _check("P(B|A)", likelihood)
    steps: list[str] = []
    if marginal is None:
        if false_positive is None:
            raise StatsError("Indique P(B|¬A) o P(B).")
        fp = _check("P(B|¬A)", false_positive)
        marginal = likelihood * prior + fp * (1 - prior)
        steps.append(
            f"P(B) = P(B|A)·P(A) + P(B|¬A)·P(¬A) = {likelihood:.4f}·{prior:.4f} + {fp:.4f}·{1 - prior:.4f} = {marginal:.6f}"
        )
    else:
        marginal = _check("P(B)", marginal)
        fp = None
        steps.append(f"P(B) = {marginal:.6f} (dato ingresado)")
    if marginal == 0:
        raise StatsError("P(B) = 0: la evidencia es imposible, el posterior no está definido.")
    posterior = likelihood * prior / marginal
    if posterior > 1 + 1e-9:
        raise StatsError("Los valores ingresados son inconsistentes (el posterior supera 1).")
    posterior = min(posterior, 1.0)
    steps.append(
        f"P(A|B) = P(B|A)·P(A) / P(B) = {likelihood:.4f}·{prior:.4f} / {marginal:.6f} = {posterior:.6f}"
    )
    lift = posterior / prior if prior else None
    return {
        "prior": prior,
        "likelihood": likelihood,
        "false_positive": fp,
        "marginal": marginal,
        "posterior": posterior,
        "lift": lift,
        "steps": steps,
        "formula": "P(A|B) = P(B|A) · P(A) / P(B)",
    }


def bayes_from_counts(total: int, a_count: int, b_count: int, ab_count: int) -> dict:
    """Bayes empírico a partir de frecuencias observadas."""
    if total <= 0:
        raise StatsError("No hay observaciones para calcular.")
    if a_count < 0 or b_count < 0 or ab_count < 0 or ab_count > min(a_count, b_count):
        raise StatsError("Conteos inconsistentes.")
    if a_count > total or b_count > total:
        raise StatsError("Conteos inconsistentes.")
    if a_count == 0 or b_count == 0:
        raise StatsError("El evento A o la evidencia B nunca ocurren en los datos; no hay base para Bayes.")
    prior = a_count / total
    likelihood = ab_count / a_count
    marginal = b_count / total
    result = bayes(prior, likelihood, marginal=marginal)
    result["counts"] = {"total": total, "A": a_count, "B": b_count, "A_y_B": ab_count}
    return result
