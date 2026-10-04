from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings

_settings = get_settings()

_kwargs: dict = {"pool_pre_ping": True}
if _settings.is_sqlite:
    _kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Compatible con el pooler de Supabase (pgbouncer) y con el plan gratuito de Render.
    _kwargs.update(pool_size=5, max_overflow=5, pool_recycle=1800)

engine = create_engine(_settings.database_url, **_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
