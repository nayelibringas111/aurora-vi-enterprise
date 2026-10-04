"""Modelo de datos de Aurora VI Enterprise (Fase 04)."""
from datetime import datetime

from sqlalchemy import (
    JSON, Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, Text,
    UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def Money() -> Numeric:
    return Numeric(12, 2, asdecimal=False)


class Company(Base):
    __tablename__ = "companies"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    ruc: Mapped[str | None] = mapped_column(String(20))
    currency: Mapped[str] = mapped_column(String(3), default="PEN")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Role(Base):
    __tablename__ = "roles"
    name: Mapped[str] = mapped_column(String(30), primary_key=True)
    description: Mapped[str] = mapped_column(String(200), default="")
    permissions: Mapped[list] = mapped_column(JSON, default=list)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    password_hash: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(ForeignKey("roles.name"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Employee(Base):
    __tablename__ = "employees"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    full_name: Mapped[str] = mapped_column(String(160))
    position: Mapped[str] = mapped_column(String(80), default="Ejecutivo comercial")
    branch: Mapped[str] = mapped_column(String(80), default="Principal")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (UniqueConstraint("company_id", "doc_number", name="uq_customer_doc"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    doc_type: Mapped[str] = mapped_column(String(10), default="DNI")
    doc_number: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(160), index=True)
    email: Mapped[str | None] = mapped_column(String(160))
    phone: Mapped[str | None] = mapped_column(String(30))
    city: Mapped[str | None] = mapped_column(String(80))
    segment: Mapped[str] = mapped_column(String(30), default="Minorista")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("company_id", "name", name="uq_category_name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    name: Mapped[str] = mapped_column(String(80))


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("company_id", "sku", name="uq_product_sku"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), index=True)
    sku: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(160), index=True)
    price: Mapped[float] = mapped_column(Money())
    cost: Mapped[float] = mapped_column(Money(), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    category: Mapped["Category | None"] = relationship()
    inventory: Mapped["Inventory | None"] = relationship(back_populates="product", uselist=False)


class Inventory(Base):
    __tablename__ = "inventory"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), unique=True)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    min_stock: Mapped[int] = mapped_column(Integer, default=10)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    product: Mapped[Product] = relationship(back_populates="inventory")


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    type: Mapped[str] = mapped_column(String(12))  # entrada | salida | ajuste
    quantity: Mapped[int] = mapped_column(Integer)
    balance: Mapped[int] = mapped_column(Integer, default=0)
    reason: Mapped[str | None] = mapped_column(String(200))
    reference: Mapped[str | None] = mapped_column(String(40))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)

    product: Mapped[Product] = relationship()


class Sale(Base):
    __tablename__ = "sales"
    __table_args__ = (
        UniqueConstraint("company_id", "number", name="uq_sale_number"),
        Index("ix_sales_company_date", "company_id", "created_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    number: Mapped[str] = mapped_column(String(20))
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"), index=True)
    employee_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id"), index=True)
    branch: Mapped[str] = mapped_column(String(80), default="Principal")
    status: Mapped[str] = mapped_column(String(12), default="completada", index=True)  # pedido|completada|anulada
    subtotal: Mapped[float] = mapped_column(Money(), default=0)
    discount: Mapped[float] = mapped_column(Money(), default=0)
    tax: Mapped[float] = mapped_column(Money(), default=0)
    total: Mapped[float] = mapped_column(Money(), default=0)
    units: Mapped[int] = mapped_column(Integer, default=0)
    payment_method: Mapped[str | None] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(String(300))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    customer: Mapped["Customer | None"] = relationship()
    employee: Mapped["Employee | None"] = relationship()
    details: Mapped[list["SaleDetail"]] = relationship(back_populates="sale", cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship(back_populates="sale", cascade="all, delete-orphan")


class SaleDetail(Base):
    __tablename__ = "sale_details"
    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[float] = mapped_column(Money())
    discount: Mapped[float] = mapped_column(Money(), default=0)
    line_total: Mapped[float] = mapped_column(Money())

    sale: Mapped[Sale] = relationship(back_populates="details")
    product: Mapped[Product] = relationship()


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), index=True)
    method: Mapped[str] = mapped_column(String(20))
    amount: Mapped[float] = mapped_column(Money())
    reference: Mapped[str | None] = mapped_column(String(60))
    paid_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    sale: Mapped[Sale] = relationship(back_populates="payments")


# ---------------------------------------------------------------- Analytics
class Dataset(Base):
    __tablename__ = "datasets"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    source: Mapped[str] = mapped_column(String(40), default="ventas")
    description: Mapped[str | None] = mapped_column(String(300))
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    filters: Mapped[dict | None] = mapped_column(JSON)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    variables: Mapped[list["DatasetVariable"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")


class DatasetVariable(Base):
    __tablename__ = "dataset_variables"
    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    label: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(40))
    unit: Mapped[str | None] = mapped_column(String(20))

    dataset: Mapped[Dataset] = relationship(back_populates="variables")
    observations: Mapped[list["Observation"]] = relationship(cascade="all, delete-orphan")


class Observation(Base):
    __tablename__ = "observations"
    id: Mapped[int] = mapped_column(primary_key=True)
    variable_id: Mapped[int] = mapped_column(ForeignKey("dataset_variables.id"), index=True)
    row_index: Mapped[int] = mapped_column(Integer)
    value: Mapped[float] = mapped_column(Numeric(14, 4, asdecimal=False))
    label: Mapped[str | None] = mapped_column(String(80))


class StatisticalAnalysis(Base):
    __tablename__ = "statistical_analyses"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    dataset_id: Mapped[int | None] = mapped_column(ForeignKey("datasets.id"))
    kind: Mapped[str] = mapped_column(String(40), index=True)
    variable: Mapped[str | None] = mapped_column(String(60))
    params: Mapped[dict | None] = mapped_column(JSON)
    sample_size: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)

    results: Mapped[list["StatisticalResult"]] = relationship(cascade="all, delete-orphan")


class StatisticalResult(Base):
    __tablename__ = "statistical_results"
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("statistical_analyses.id"), index=True)
    metric: Mapped[str] = mapped_column(String(40))
    value: Mapped[float | None] = mapped_column(Numeric(18, 6, asdecimal=False))
    payload: Mapped[dict | None] = mapped_column(JSON)


class BayesAnalysis(Base):
    __tablename__ = "bayes_analyses"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    hypothesis: Mapped[str] = mapped_column(String(200))
    evidence: Mapped[str] = mapped_column(String(200))
    prior: Mapped[float] = mapped_column(Numeric(10, 8, asdecimal=False))
    likelihood: Mapped[float] = mapped_column(Numeric(10, 8, asdecimal=False))
    marginal: Mapped[float] = mapped_column(Numeric(10, 8, asdecimal=False))
    posterior: Mapped[float] = mapped_column(Numeric(10, 8, asdecimal=False))
    source: Mapped[str] = mapped_column(String(20), default="manual")
    detail: Mapped[dict | None] = mapped_column(JSON)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class RandomVariable(Base):
    __tablename__ = "random_variables"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    kind: Mapped[str] = mapped_column(String(12))  # discreta | continua
    definition: Mapped[dict | None] = mapped_column(JSON)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Insight(Base):
    __tablename__ = "insights"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    analysis_id: Mapped[int | None] = mapped_column(ForeignKey("statistical_analyses.id"))
    rule_code: Mapped[str] = mapped_column(String(40))
    severity: Mapped[str] = mapped_column(String(10), default="info")  # info|positivo|atencion|critico
    title: Mapped[str] = mapped_column(String(160))
    message: Mapped[str] = mapped_column(Text)
    evidence: Mapped[dict | None] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    kind: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(160))
    params: Mapped[dict | None] = mapped_column(JSON)
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int | None] = mapped_column(Integer, index=True)
    user_id: Mapped[int | None] = mapped_column(Integer)
    user_email: Mapped[str | None] = mapped_column(String(160))
    action: Mapped[str] = mapped_column(String(40), index=True)
    entity: Mapped[str | None] = mapped_column(String(40))
    entity_id: Mapped[str | None] = mapped_column(String(40))
    detail: Mapped[dict | None] = mapped_column(JSON)
    ip: Mapped[str | None] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
