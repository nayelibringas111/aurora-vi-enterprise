# Datos semilla

Los datos iniciales los carga la propia API al arrancar (`backend/app/seed.py`, controlado por `AUTO_SEED` y `SEED_DEMO_DATA`):

- **Siempre:** empresa, 5 roles con permisos y el/los usuario(s) de acceso.
- **Con `SEED_DEMO_DATA=true`:** 5 usuarios demo, 5 vendedores, 5 categorías, 24 productos, 48 clientes y ~12 meses de ventas
  con estacionalidad, tendencia, descuentos, anulaciones, pagos y movimientos de inventario (determinista, `seed=7`).
- La carga es **idempotente**: si ya existen productos no vuelve a insertar nada.

Para regenerar el esquema SQL: `python database/generate_sql.py`.
