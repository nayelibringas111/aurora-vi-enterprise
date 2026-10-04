# Guía de despliegue · Supabase + Render + Vercel

Orden recomendado: **1) Supabase → 2) Render → 3) Vercel → 4) enlazar CORS**.

## 1. Supabase (PostgreSQL)

1. Cree un proyecto en <https://supabase.com> y guarde la contraseña de la base de datos.
2. **Opción A (recomendada):** no haga nada más; el backend crea las tablas al arrancar (`create_all`) y carga los datos semilla.
   **Opción B:** abra *SQL Editor* y ejecute `database/migrations/001_init.sql` (crea las 22 tablas, índices y activa RLS).
3. Copie la cadena de conexión: *Connect → Session pooler* (puerto **5432**, funciona con IPv4 y es la correcta para Render):

   ```
   postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
   ```
   El backend acepta `postgresql://` y `postgres://` y los convierte a `postgresql+psycopg2://`.
   Si la contraseña tiene caracteres especiales (`@`, `/`, `#`), codifíquelos (`@` → `%40`).

> **Seguridad:** las tablas tienen RLS activado y sin políticas, de modo que la API REST pública de Supabase
> (`anon`/`authenticated`) no puede leerlas. Solo el backend accede, con el usuario `postgres`.

## 2. Render (backend FastAPI)

**Con Blueprint:** suba el repositorio a GitHub → *New → Blueprint* → seleccione el repo (usa `render.yaml`).
**Manual:** *New → Web Service*

| Campo | Valor |
|---|---|
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'` |
| Health Check Path | `/health` |

Variables de entorno:

| Variable | Valor |
|---|---|
| `ENVIRONMENT` | `production` |
| `SECRET_KEY` | cadena aleatoria ≥ 32 caracteres (`python -c "import secrets;print(secrets.token_urlsafe(48))"`) |
| `DATABASE_URL` | cadena de Supabase del paso 1 |
| `CORS_ORIGINS` | `https://su-app.vercel.app` (varios, separados por coma) |
| `CORS_ORIGIN_REGEX` | `^https://aurora-vi-[a-z0-9-]+\.vercel\.app$` (opcional, para previews) |
| `AUTO_SEED` | `true` |
| `SEED_DEMO_DATA` | `true` para demo; `false` en producción real |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | solo se usan cuando `SEED_DEMO_DATA=false` |

Compruebe `https://su-api.onrender.com/health` → `{"status":"ok"}` y la documentación en `/docs`.

> El plan gratuito de Render duerme tras 15 min sin tráfico; la primera petición puede tardar ~50 s.
> El frontend ya lo contempla (aviso en el login y *warm-up* al abrir la app).

## 3. Vercel (frontend React)

1. *Add New → Project* → importe el repositorio.
2. **Root Directory:** `frontend` · Framework: *Vite* (se detecta; `vercel.json` ya define build y *rewrites* SPA).
3. Variables de entorno:

   | Variable | Valor |
   |---|---|
   | `VITE_API_BASE_URL` | `https://su-api.onrender.com` (sin `/` final) |
   | `VITE_SHOW_DEMO` | `true` en demo, `false` en producción real |
4. *Deploy*.

## 4. Enlazar

Copie la URL final de Vercel en `CORS_ORIGINS` de Render y reinicie el servicio. Pruebe el login.

## Checklist de producción

- [ ] `SECRET_KEY` único y secreto (el backend se niega a arrancar en producción con la clave de desarrollo).
- [ ] `SEED_DEMO_DATA=false` y contraseña de administrador propia (o cambie las contraseñas demo desde *Administración*).
- [ ] `VITE_SHOW_DEMO=false`.
- [ ] `CORS_ORIGINS` limitado al dominio real.
- [ ] Copias de seguridad habilitadas en Supabase.
- [ ] Revisar la bitácora en *Administración → Auditoría*.

## Ejecución local

```bash
# Backend (SQLite por defecto, sin instalar PostgreSQL)
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload            # http://localhost:8000/docs
pytest                                    # 26 pruebas

# Frontend
cd frontend && npm install && npm run dev  # http://localhost:5173 (proxy /api → :8000)
npm test                                   # humo contra la API en ejecución
```
