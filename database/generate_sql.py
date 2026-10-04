"""Genera database/migrations/001_init.sql (DDL PostgreSQL) a partir de los modelos SQLAlchemy."""
import os, sys
from pathlib import Path
os.environ.setdefault("DATABASE_URL", "sqlite://")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from sqlalchemy.schema import CreateTable, CreateIndex
from sqlalchemy.dialects import postgresql
from app.core.database import Base
import app.models  # noqa

d = postgresql.dialect()
out = ["-- Aurora VI Enterprise · esquema inicial PostgreSQL (Supabase)", "-- Generado desde los modelos SQLAlchemy. Ejecutar una sola vez en el SQL Editor.", "begin;", ""]
for t in Base.metadata.sorted_tables:
    out.append(str(CreateTable(t).compile(dialect=d)).strip() + ";")
    for ix in sorted(t.indexes, key=lambda i: i.name):
        out.append(str(CreateIndex(ix).compile(dialect=d)).strip() + ";")
    out.append("")
out += ["-- Seguridad: la API accede con el rol postgres (omite RLS). Activar RLS sin políticas",
        "-- bloquea el acceso directo vía la API REST pública de Supabase (anon/authenticated).",]
for t in Base.metadata.sorted_tables:
    out.append(f"alter table public.{t.name} enable row level security;")
out += ["", "-- Índices adicionales para consultas analíticas",
        "create index if not exists ix_sale_details_sale_product on sale_details (sale_id, product_id);",
        "create index if not exists ix_audit_company_action on audit_logs (company_id, action);",
        "", "commit;", ""]
dest = Path(__file__).parent / "migrations" / "001_init.sql"
dest.write_text("\n".join(out), encoding="utf-8")
print("OK", dest, len(out), "líneas")
