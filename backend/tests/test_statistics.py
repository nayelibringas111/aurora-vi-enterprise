import math

import pytest

from app.probability.bayes import bayes, bayes_from_counts
from app.statistics import engine as st


def test_mean_basic():
    assert st.mean([2, 4, 6]) == 4
    assert st.mean([10]) == 10


def test_median_odd_even():
    assert st.median([7, 1, 3]) == 3
    assert st.median([4, 1, 3, 2]) == 2.5


def test_empty_and_invalid():
    with pytest.raises(st.StatsError):
        st.mean([])
    with pytest.raises(st.StatsError):
        st.median([None, float("nan")])
    with pytest.raises(st.StatsError):
        st.mean(["abc"])


def test_mode_and_variance():
    assert st.mode([1, 2, 2, 3]) == [2.0]
    assert st.mode([1, 2, 3]) == []
    assert math.isclose(st.variance([2, 4, 4, 4, 5, 5, 7, 9], sample=False), 4.0)
    assert math.isclose(st.std([2, 4, 4, 4, 5, 5, 7, 9], sample=False), 2.0)


def test_compare_detects_positive_skew():
    r = st.compare_mean_median([10, 11, 12, 12, 13, 500])
    assert r["shape"] == "sesgo positivo"
    assert r["mean"] > r["median"]


def test_compare_symmetric():
    assert st.compare_mean_median([1, 2, 3, 4, 5])["shape"] == "simétrica"


def test_classify_variable():
    assert st.classify_variable([1, 2, 3, 3])["label"] == "Cuantitativa discreta"
    assert st.classify_variable([1.5, 2.25])["label"] == "Cuantitativa continua"
    c = st.classify_variable(["efectivo", "tarjeta", "efectivo"])
    assert c["label"] == "Cualitativa nominal" and c["frequencies"][0]["value"] == "efectivo"


def test_random_variable_discrete():
    r = st.analyze_random_variable([1, 1, 2, 3], "discreta")
    assert math.isclose(r["expected_value"], 1.75)
    assert math.isclose(sum(row["p"] for row in r["pmf"]), 1.0)
    assert r["pmf"][-1]["cdf"] == pytest.approx(1.0)


def test_empirical_probability():
    r = st.empirical_probability([1, 2, 3, 4], "ge", 3)
    assert r["probability"] == 0.5
    assert st.empirical_probability([1, 2, 3, 4], "between", 2, 3)["favorable"] == 2


def test_bayes_classic_case():
    # P(A)=1%, sensibilidad 99%, falso positivo 5% -> posterior ≈ 16.67%
    r = bayes(0.01, 0.99, false_positive=0.05)
    assert r["posterior"] == pytest.approx(0.1667, abs=1e-3)
    assert r["marginal"] == pytest.approx(0.0594, abs=1e-4)
    assert len(r["steps"]) == 2


def test_bayes_reproducible_and_validated():
    assert bayes(0.3, 0.8, marginal=0.5)["posterior"] == bayes(0.3, 0.8, marginal=0.5)["posterior"]
    with pytest.raises(st.StatsError):
        bayes(1.2, 0.5, false_positive=0.1)
    with pytest.raises(st.StatsError):
        bayes(0.3, 0.8)
    with pytest.raises(st.StatsError):
        bayes(0.0, 0.0, false_positive=0.0)
    with pytest.raises(st.StatsError):  # inconsistente: posterior > 1
        bayes(0.5, 0.9, marginal=0.1)


def test_bayes_from_counts():
    r = bayes_from_counts(total=100, a_count=20, b_count=40, ab_count=16)
    assert r["prior"] == 0.2
    assert r["posterior"] == pytest.approx(0.4)
    with pytest.raises(st.StatsError):
        bayes_from_counts(100, 0, 10, 0)
