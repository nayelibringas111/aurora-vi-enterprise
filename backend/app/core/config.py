"""Configuración centralizada por variables de entorno (RNF-10)."""
import os
from functools import lru_cache

_DEV_SECRET = "dev-secret-change-me-please-use-32-chars-minimum"


def _normalize_db_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    def __init__(self) -> None:
        self.environment = os.getenv("ENVIRONMENT", "development")
        self.database_url = _normalize_db_url(os.getenv("DATABASE_URL", "sqlite:///./aurora.db"))
        self.secret_key = os.getenv("SECRET_KEY", _DEV_SECRET)
        self.access_token_minutes = int(os.getenv("ACCESS_TOKEN_MINUTES", "480"))
        self.cors_origins = [
            o.strip().rstrip("/")
            for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
            if o.strip()
        ]
        # Permite previews de Vercel: ^https://aurora-vi-.*\.vercel\.app$
        self.cors_origin_regex = os.getenv("CORS_ORIGIN_REGEX", "") or None
        self.auto_seed = _bool("AUTO_SEED", True)
        self.seed_demo_data = _bool("SEED_DEMO_DATA", True)
        self.tax_rate = float(os.getenv("TAX_RATE", "0.18"))
        self.currency = os.getenv("CURRENCY", "PEN")
        self.company_name = os.getenv("COMPANY_NAME", "Distribuidora Andina S.A.C.")
        self.admin_email = os.getenv("ADMIN_EMAIL", "admin@auroravi.com")
        self.admin_password = os.getenv("ADMIN_PASSWORD", "Admin123!")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    def validate(self) -> None:
        if self.is_production and self.secret_key == _DEV_SECRET:
            raise RuntimeError("SECRET_KEY debe definirse en producción.")
        if len(self.secret_key) < 32:
            raise RuntimeError("SECRET_KEY debe tener al menos 32 caracteres.")


@lru_cache
def get_settings() -> Settings:
    return Settings()
