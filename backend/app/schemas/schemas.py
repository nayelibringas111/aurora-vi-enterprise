"""Contratos de entrada de la API (validación en backend, RNF-02)."""
import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _email(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    v = v.strip().lower()
    if not _EMAIL.match(v):
        raise ValueError("Correo electrónico inválido")
    return v


class LoginIn(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _e(cls, v: str) -> str:
        r = _email(v)
        if not r:
            raise ValueError("Correo requerido")
        return r


class UserIn(BaseModel):
    email: str
    full_name: str = Field(min_length=2, max_length=160)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: Literal["admin", "gerente", "vendedor", "analista", "almacen"]
    is_active: bool = True

    @field_validator("email")
    @classmethod
    def _e(cls, v: str) -> str:
        r = _email(v)
        if not r:
            raise ValueError("Correo requerido")
        return r


class CustomerIn(BaseModel):
    doc_type: Literal["DNI", "RUC", "CE", "PAS"] = "DNI"
    doc_number: str = Field(min_length=6, max_length=20, pattern=r"^[0-9A-Za-z-]+$")
    name: str = Field(min_length=2, max_length=160)
    email: str | None = None
    phone: str | None = Field(default=None, max_length=30)
    city: str | None = Field(default=None, max_length=80)
    segment: Literal["Minorista", "Mayorista", "Corporativo"] = "Minorista"
    is_active: bool = True

    @field_validator("email")
    @classmethod
    def _e(cls, v: str | None) -> str | None:
        return _email(v)


class ProductIn(BaseModel):
    sku: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=160)
    category_id: int | None = None
    price: float = Field(gt=0, le=10_000_000)
    cost: float = Field(default=0, ge=0, le=10_000_000)
    min_stock: int = Field(default=10, ge=0)
    initial_stock: int = Field(default=0, ge=0)
    is_active: bool = True


class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)


class MovementIn(BaseModel):
    product_id: int
    type: Literal["entrada", "salida", "ajuste"]
    quantity: int = Field(gt=0, le=1_000_000)
    reason: str | None = Field(default=None, max_length=200)


class SaleItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=10_000)
    discount_pct: float = Field(default=0, ge=0, le=100)


class SaleIn(BaseModel):
    customer_id: int | None = None
    employee_id: int | None = None
    branch: str = Field(default="Principal", max_length=80)
    payment_method: Literal["efectivo", "tarjeta", "yape", "plin", "transferencia"] = "efectivo"
    items: list[SaleItemIn] = Field(min_length=1, max_length=100)
    confirm: bool = True
    notes: str | None = Field(default=None, max_length=300)


class ValuesIn(BaseModel):
    values: list[float] | None = Field(default=None, max_length=100_000)
    variable: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    save: bool = True


class ProbabilityIn(BaseModel):
    variable: str | None = None
    values: list[float] | None = Field(default=None, max_length=100_000)
    op: Literal["gt", "ge", "lt", "le", "eq", "between"] = "ge"
    threshold: float = 0
    upper: float | None = None
    date_from: date | None = None
    date_to: date | None = None


class BayesIn(BaseModel):
    hypothesis: str = Field(default="A", max_length=200)
    evidence: str = Field(default="B", max_length=200)
    prior: float = Field(ge=0, le=1)
    likelihood: float = Field(ge=0, le=1)
    false_positive: float | None = Field(default=None, ge=0, le=1)
    marginal: float | None = Field(default=None, ge=0, le=1)
    save: bool = True


class BayesEmpiricalIn(BaseModel):
    threshold: float = Field(ge=0, description="Monto mínimo para considerar una venta alta (evento A)")
    payment_method: Literal["efectivo", "tarjeta", "yape", "plin", "transferencia"] = "tarjeta"
    segment: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    save: bool = True


class RandomVarIn(BaseModel):
    variable: str | None = None
    values: list[float] | None = Field(default=None, max_length=100_000)
    kind: Literal["discreta", "continua"] | None = None
    date_from: date | None = None
    date_to: date | None = None
    save: bool = True
