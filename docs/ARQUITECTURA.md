# Arquitectura técnica

```
Usuario → React + TypeScript (Vercel)
            │  HTTPS / REST (JWT Bearer)
            ▼
          FastAPI (Render)
            ├── api/        auth · masters · sales · analytics
            ├── services/   ventas transaccionales · analítica · insights · auditoría
            ├── statistics/ motor estadístico (funciones puras)
            ├── probability/ Bayes
            └── reports/    generación de reportes + CSV
            ▼
          PostgreSQL (Supabase)
```

## Decisiones

- **Separación en capas (RNF-08):** rutas delgadas → servicios con reglas de negocio → modelos. El motor estadístico
  y Bayes no dependen de la base de datos, por lo que se prueban de forma aislada.
- **Ventas transaccionales:** crear/confirmar/anular una venta ocurre en una sola transacción (cabecera, detalle, pago,
  inventario, movimientos y auditoría). El stock se bloquea con `SELECT … FOR UPDATE` y falla con `409` si no alcanza.
- **Analytics sobre datos operativos:** las series estadísticas se derivan de `sales`/`sale_details`. `datasets` permite
  congelar un periodo (instantánea) como `datasets → dataset_variables → observations` para análisis reproducibles.
- **Reproducibilidad:** cada análisis se guarda (`statistical_analyses` + `statistical_results`; Bayes en `bayes_analyses`).
- **Insights explicables:** reglas determinísticas en `services/insights.py`; el JSON `evidence` conserva los números que
  originan cada conclusión.
- **Seguridad:** JWT HS256; permisos `<módulo>:<read|write>` en `core/permissions.py`; vendedor limitado a sus ventas;
  contraseñas con bcrypt; validación con Pydantic; CORS por lista blanca; RLS activado en Supabase.
- **Compatibilidad:** SQLite para desarrollo y pruebas, PostgreSQL en producción (mismo código SQLAlchemy).

## Rendimiento

Las agregaciones se calculan en Python sobre las ventas del periodo (decenas de miles de filas sin problema). Para
volúmenes mayores conviene mover los `GROUP BY` a SQL y/o materializar vistas; los índices
`(company_id, created_at)` ya están definidos.

## Estructura de la API (prefijo `/api`)

`/auth/login` · `/auth/me` · `/users` · `/customers` · `/categories` · `/products` · `/inventory/movements` ·
`/employees` · `/sales` (+ `/confirm`, `/cancel`) · `/dashboard/summary` · `/analytics/{overview,customers,variables}` ·
`/statistics/{mean,median,compare,history}` · `/random-variables/analyze` · `/probability/{event,bayes,bayes/empirical}` ·
`/datasets` · `/insights` (+ `/generate`) · `/reports` · `/audit`. Documentación interactiva en `/docs`.
