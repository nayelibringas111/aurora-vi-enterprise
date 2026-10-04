import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text

from app.api import analytics, auth, masters, sales
from app.core.config import get_settings
from app.core.database import Base, SessionLocal, engine
from app.models import Company

log = logging.getLogger("aurora")
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.validate()
    Base.metadata.create_all(bind=engine)
    if settings.auto_seed:
        from app import seed

        with SessionLocal() as db:
            if db.scalar(select(Company.id).limit(1)) is None or settings.seed_demo_data:
                seed.run(db)
    yield


app = FastAPI(
    title="Aurora VI Enterprise API",
    version="1.0.0",
    description="Gestión de ventas con módulo de Analytics estadístico (media, mediana, variables, probabilidad y Bayes).",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "no-referrer")
    if settings.is_production:
        resp.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return resp


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    errors = [
        {"field": ".".join(str(p) for p in e["loc"] if p not in ("body", "query")), "message": e["msg"]}
        for e in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": "Datos inválidos", "errors": errors})


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.exception("Error no controlado", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})


@app.get("/health", tags=["Sistema"])
def health():
    with engine.connect() as conn:
        conn.execute(text("select 1"))
    return {"status": "ok", "environment": settings.environment}


for r in (auth.router, masters.router, sales.router, analytics.router):
    app.include_router(r, prefix="/api")
