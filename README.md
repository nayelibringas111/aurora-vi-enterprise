# Aurora VI Enterprise

Sistema web empresarial de gestión de ventas con un módulo de **Analytics estadístico**: las ventas generan los datos
y el motor los convierte en media, mediana, variables estadísticas, probabilidad, Bayes, gráficos e insights explicables.

**Stack:** React + TypeScript (Vite) · FastAPI (Python) · PostgreSQL (Supabase) · Despliegue en Vercel + Render.

## Qué incluye

| Área | Funcionalidad |
|---|---|
| Operación | Clientes, productos y categorías, inventario con movimientos, flujo **pedido → venta → pago → stock**, anulaciones que restituyen stock, IGV configurable |
| Analytics | KPIs con variación vs. periodo previo, filtros (periodo, vendedor, categoría, sucursal), media vs. mediana con interpretación, histogramas, estadísticos, análisis de clientes, laboratorio de cálculo, datasets congelados |
| Probabilidad | Bayes manual y **Bayes con sus propias ventas** (paso a paso), variables aleatorias discretas/continuas (esperanza, varianza, PMF), probabilidad de eventos |
| Insights | Reglas determinísticas; cada hallazgo muestra su **evidencia numérica** |
| Reportes | 6 reportes, vista previa, exportación CSV (compatible con Excel) y vista imprimible; historial |
| Seguridad | JWT, 5 roles con permisos por módulo, vendedores ven solo sus ventas, auditoría de acciones críticas, RLS en Supabase, cabeceras de seguridad |
| Experiencia | Paleta de comandos (`Ctrl K`), modo claro/oscuro, estados de carga/vacío/error, diseño responsive, tablas y formularios con validación |

## Estructura

```
backend/     FastAPI: api/ core/ models/ schemas/ services/ statistics/ probability/ reports/ + tests/
frontend/    React: modules/ components/ layouts/ hooks/ services/ styles/
database/    migrations/001_init.sql (generado) + generate_sql.py
docs/        DESPLIEGUE.md, ARQUITECTURA.md, MANUAL_USUARIO.md, DICCIONARIO_DATOS.md, FASES.md
render.yaml  Blueprint del backend
```

## Inicio rápido

```bash
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt && uvicorn app.main:app --reload
# en otra terminal
cd frontend && npm install && npm run dev
```

Abra <http://localhost:5173>. Usuarios demo (solo con `SEED_DEMO_DATA=true`):

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@auroravi.com | Admin123! |
| Gerente | gerente@auroravi.com | Gerente123! |
| Analista | analista@auroravi.com | Analista123! |
| Vendedor | vendedor@auroravi.com | Vendedor123! |
| Almacén | almacen@auroravi.com | Almacen123! |

> Cambie o desactive estas cuentas antes de usar datos reales (ver `docs/DESPLIEGUE.md`).

Despliegue completo en **Supabase + Render + Vercel**: `docs/DESPLIEGUE.md`.
