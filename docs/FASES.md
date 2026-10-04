# Estado de las 16 fases

| Fase | Entregable del plan | Dónde está | Estado |
|---|---|---|---|
| 01 Análisis y levantamiento | Requisitos, alcance, roles, casos de uso | `README.md`, `docs/MANUAL_USUARIO.md`, matriz de roles en `backend/app/core/permissions.py` | Hecho |
| 02 Arquitectura técnica | Arquitectura, módulos, contratos API | `docs/ARQUITECTURA.md`, `/docs` (OpenAPI) | Hecho |
| 03 UX/UI empresarial | Sistema visual, navegación, estados | `frontend/src/styles/global.css`, `components/`, `layouts/` | Hecho |
| 04 PostgreSQL | Modelo, restricciones, índices, migraciones, seed | `backend/app/models/models.py`, `database/migrations/001_init.sql`, `backend/app/seed.py` | Hecho |
| 05 Backend/API | FastAPI documentada con servicios y validaciones | `backend/app/` | Hecho |
| 06 Frontend React | Rutas, layouts, formularios, tablas, consumo API | `frontend/src/` | Hecho |
| 07 Clientes y productos | CRUD, historial, búsqueda y filtros | `modules/customers`, `modules/products` | Hecho |
| 08 Ventas, pedidos e inventario | Flujo completo, pagos, stock, trazabilidad | `services/sales_service.py`, `modules/sales`, `modules/inventory` | Hecho |
| 09 Motor estadístico (Sem. 07) | Variables, media, mediana, aleatorias, probabilidad, Bayes | `backend/app/statistics/engine.py`, `probability/bayes.py` | Hecho |
| 10 Dashboard Analytics | KPIs, gráficos, filtros, evolución | `modules/dashboard`, `modules/analytics` | Hecho |
| 11 Insights | Reglas, evidencia, historial | `services/insights.py`, `modules/insights` | Hecho |
| 12 Reportes | 6 reportes, CSV, impresión, historial | `reports/builder.py`, `modules/reports` | Hecho |
| 13 Seguridad y auditoría | Roles, permisos, auditoría, sesiones | `core/`, `services/audit.py`, `modules/admin` | Hecho |
| 14 Pruebas y calidad | Unitarias, API, integración, UI | `backend/tests` (26), `frontend/src/test` (16) | Hecho |
| 15 Despliegue | Configuración Vercel/Render/Supabase | `render.yaml`, `frontend/vercel.json`, `docs/DESPLIEGUE.md` | Hecho (ver nota) |
| 16 Cierre y documentación | Manuales, diccionario, API | `docs/` | Hecho |

**Nota fase 15:** la configuración está lista, pero el despliegue real requiere sus cuentas de Supabase, Render y Vercel.
El esquema PostgreSQL se genera desde los modelos y el backend se probó con SQLite; la primera ejecución contra Supabase
conviene verificarla con `/health` y un login.

## Criterios de aceptación del plan

| Criterio | Verificación |
|---|---|
| Acceso solo a sus módulos | `test_role_permissions`, pruebas de roles del frontend |
| Venta con detalle que actualiza inventario | `test_sale_updates_inventory_and_audit` |
| Datos de ventas consultables desde Analytics | `test_dashboard_and_analytics` |
| Media y mediana correctas | `tests/test_statistics.py` |
| Identificación de variables estadísticas | `test_classify_variable`, `/analytics/variables` |
| Variables aleatorias | `test_random_variable_discrete`, `/random-variables/analyze` |
| Bayes reproducible | `test_bayes_reproducible_and_validated`, `test_bayes_from_counts` |
| Resultados en gráficos y KPIs | Panel y Analytics |
| Insights con su evidencia | `test_insights_and_reports` |
| Análisis almacenados y consultables | `/statistics/history`, pestaña Historial |
| Operaciones críticas auditadas | `/audit`, `test_sale_updates_inventory_and_audit` |

## Evolución hacia la Semana 08

La arquitectura admite añadir varianza/desviación como métricas de riesgo (ya calculadas en `describe`), pruebas de
hipótesis y p-valor, y esperanza matemática sobre ventas sin cambiar el modelo de datos (nuevos `kind` en
`statistical_analyses`).
