# Diccionario de datos

Generado desde los modelos SQLAlchemy (`backend/app/models/models.py`).

## audit_logs
_Auditoría de acciones_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| company_id | INTEGER | sí | índice |
| user_id | INTEGER | sí |  |
| user_email | VARCHAR(160) | sí |  |
| action | VARCHAR(40) | no | índice |
| entity | VARCHAR(40) | sí |  |
| entity_id | VARCHAR(40) | sí |  |
| detail | JSON | sí |  |
| ip | VARCHAR(45) | sí |  |
| created_at | DATETIME | no | índice |

## bayes_analyses
_Resultados de Bayes_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| company_id | INTEGER | no | FK → companies.id, índice |
| hypothesis | VARCHAR(200) | no |  |
| evidence | VARCHAR(200) | no |  |
| prior | NUMERIC(10, 8) | no |  |
| likelihood | NUMERIC(10, 8) | no |  |
| marginal | NUMERIC(10, 8) | no |  |
| posterior | NUMERIC(10, 8) | no |  |
| source | VARCHAR(20) | no |  |
| detail | JSON | sí |  |
| created_by | INTEGER | sí | FK → users.id |
| created_at | DATETIME | no |  |

## categories
_Categorías_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| company_id | INTEGER | no | FK → companies.id |
| name | VARCHAR(80) | no |  |

Único compuesto: (company_id, name)

## companies
_Empresa propietaria de los datos_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| name | VARCHAR(160) | no |  |
| ruc | VARCHAR(20) | sí |  |
| currency | VARCHAR(3) | no |  |
| created_at | DATETIME | no |  |

## customers
_Clientes_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| company_id | INTEGER | no | FK → companies.id, índice |
| doc_type | VARCHAR(10) | no |  |
| doc_number | VARCHAR(20) | no |  |
| name | VARCHAR(160) | no | índice |
| email | VARCHAR(160) | sí |  |
| phone | VARCHAR(30) | sí |  |
| city | VARCHAR(80) | sí |  |
| segment | VARCHAR(30) | no |  |
| is_active | BOOLEAN | no |  |
| created_at | DATETIME | no |  |

Único compuesto: (company_id, doc_number)

## dataset_variables
_Variables estadísticas del dataset_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| dataset_id | INTEGER | no | FK → datasets.id, índice |
| name | VARCHAR(60) | no |  |
| label | VARCHAR(120) | no |  |
| kind | VARCHAR(40) | no |  |
| unit | VARCHAR(20) | sí |  |

## datasets
_Conjuntos de datos para análisis_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| company_id | INTEGER | no | FK → companies.id, índice |
| name | VARCHAR(160) | no |  |
| source | VARCHAR(40) | no |  |
| description | VARCHAR(300) | sí |  |
| row_count | INTEGER | no |  |
| filters | JSON | sí |  |
| created_by | INTEGER | sí | FK → users.id |
| created_at | DATETIME | no |  |

## employees
_Personal / vendedores_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| company_id | INTEGER | no | FK → companies.id |
| user_id | INTEGER | sí | FK → users.id |
| full_name | VARCHAR(160) | no |  |
| position | VARCHAR(80) | no |  |
| branch | VARCHAR(80) | no |  |
| is_active | BOOLEAN | no |  |

## insights
_Conclusiones generadas por reglas_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| company_id | INTEGER | no | FK → companies.id, índice |
| analysis_id | INTEGER | sí | FK → statistical_analyses.id |
| rule_code | VARCHAR(40) | no |  |
| severity | VARCHAR(10) | no |  |
| title | VARCHAR(160) | no |  |
| message | TEXT | no |  |
| evidence | JSON | sí |  |
| is_active | BOOLEAN | no |  |
| created_at | DATETIME | no | índice |

## inventory
_Existencias por producto_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| product_id | INTEGER | no | FK → products.id, único |
| stock | INTEGER | no |  |
| min_stock | INTEGER | no |  |
| updated_at | DATETIME | no |  |

## inventory_movements
_Entradas, salidas y ajustes_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| product_id | INTEGER | no | FK → products.id, índice |
| type | VARCHAR(12) | no |  |
| quantity | INTEGER | no |  |
| balance | INTEGER | no |  |
| reason | VARCHAR(200) | sí |  |
| reference | VARCHAR(40) | sí |  |
| user_id | INTEGER | sí | FK → users.id |
| created_at | DATETIME | no | índice |

## observations
_Observaciones numéricas analizadas_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| variable_id | INTEGER | no | FK → dataset_variables.id, índice |
| row_index | INTEGER | no |  |
| value | NUMERIC(14, 4) | no |  |
| label | VARCHAR(80) | sí |  |

## payments
_Pagos_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| sale_id | INTEGER | no | FK → sales.id, índice |
| method | VARCHAR(20) | no |  |
| amount | NUMERIC(12, 2) | no |  |
| reference | VARCHAR(60) | sí |  |
| paid_at | DATETIME | no |  |

## products
_Productos_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| company_id | INTEGER | no | FK → companies.id, índice |
| category_id | INTEGER | sí | FK → categories.id, índice |
| sku | VARCHAR(40) | no |  |
| name | VARCHAR(160) | no | índice |
| price | NUMERIC(12, 2) | no |  |
| cost | NUMERIC(12, 2) | no |  |
| is_active | BOOLEAN | no |  |
| created_at | DATETIME | no |  |

Único compuesto: (company_id, sku)

## random_variables
_Variables aleatorias analizadas_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| company_id | INTEGER | no | FK → companies.id, índice |
| name | VARCHAR(80) | no |  |
| kind | VARCHAR(12) | no |  |
| definition | JSON | sí |  |
| created_by | INTEGER | sí | FK → users.id |
| created_at | DATETIME | no |  |

## reports
_Reportes generados_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| company_id | INTEGER | no | FK → companies.id, índice |
| kind | VARCHAR(30) | no |  |
| title | VARCHAR(160) | no |  |
| params | JSON | sí |  |
| row_count | INTEGER | no |  |
| created_by | INTEGER | sí | FK → users.id |
| created_at | DATETIME | no |  |

## roles
_Roles y permisos_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| name | VARCHAR(30) | no | PK |
| description | VARCHAR(200) | no |  |
| permissions | JSON | no |  |

## sale_details
_Detalle de productos vendidos_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| sale_id | INTEGER | no | FK → sales.id, índice |
| product_id | INTEGER | no | FK → products.id, índice |
| quantity | INTEGER | no |  |
| unit_price | NUMERIC(12, 2) | no |  |
| discount | NUMERIC(12, 2) | no |  |
| line_total | NUMERIC(12, 2) | no |  |

## sales
_Cabecera de venta/pedido_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| company_id | INTEGER | no | FK → companies.id |
| number | VARCHAR(20) | no |  |
| customer_id | INTEGER | sí | FK → customers.id, índice |
| employee_id | INTEGER | sí | FK → employees.id, índice |
| branch | VARCHAR(80) | no |  |
| status | VARCHAR(12) | no | índice |
| subtotal | NUMERIC(12, 2) | no |  |
| discount | NUMERIC(12, 2) | no |  |
| tax | NUMERIC(12, 2) | no |  |
| total | NUMERIC(12, 2) | no |  |
| units | INTEGER | no |  |
| payment_method | VARCHAR(20) | sí |  |
| notes | VARCHAR(300) | sí |  |
| created_by | INTEGER | sí | FK → users.id |
| created_at | DATETIME | no |  |

Único compuesto: (company_id, number)

## statistical_analyses
_Historial de análisis_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| company_id | INTEGER | no | FK → companies.id, índice |
| dataset_id | INTEGER | sí | FK → datasets.id |
| kind | VARCHAR(40) | no | índice |
| variable | VARCHAR(60) | sí |  |
| params | JSON | sí |  |
| sample_size | INTEGER | no |  |
| created_by | INTEGER | sí | FK → users.id |
| created_at | DATETIME | no | índice |

## statistical_results
_Resultados calculados_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| analysis_id | INTEGER | no | FK → statistical_analyses.id, índice |
| metric | VARCHAR(40) | no |  |
| value | NUMERIC(18, 6) | sí |  |
| payload | JSON | sí |  |

## users
_Usuarios del sistema_

| Columna | Tipo | Nulo | Clave / restricción |
|---|---|---|---|
| id | INTEGER | no | PK |
| company_id | INTEGER | no | FK → companies.id |
| email | VARCHAR(160) | no | único, índice |
| full_name | VARCHAR(160) | no |  |
| password_hash | VARCHAR(100) | no |  |
| role | VARCHAR(30) | no | FK → roles.name |
| is_active | BOOLEAN | no |  |
| last_login | DATETIME | sí |  |
| created_at | DATETIME | no |  |
