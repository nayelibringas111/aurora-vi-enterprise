# Manual de usuario

## Acceso y roles

Ingrese con su correo y contraseña. El menú muestra solo los módulos permitidos para su rol.

| Rol | Puede |
|---|---|
| Administrador | Todo, incluida la administración de usuarios y la auditoría |
| Gerente | Consultar panel, ventas, Analytics, probabilidad, insights, reportes y auditoría |
| Analista | Consultar datos y **ejecutar** análisis estadísticos, insights y reportes |
| Vendedor | Registrar clientes y ventas; ve únicamente sus propias ventas |
| Almacén | Gestionar productos e inventario; consultar ventas |

Atajos: **Ctrl/⌘ + K** abre el buscador de páginas y acciones; el icono de luna/sol cambia el tema.

## Registrar una venta

1. *Ventas → Nueva venta*.
2. Busque productos y haga clic para agregarlos; ajuste cantidad y descuento (%).
3. Elija cliente (o «Cliente general») y método de pago. Los totales (subtotal, IGV 18 %, total) se calculan al instante.
4. **Cobrar y registrar venta** descuenta el stock y registra el pago; **Guardar como pedido** reserva el registro sin mover stock
   (puede confirmarse después desde el detalle de la venta).
5. Una venta puede **anularse** desde su detalle: el stock regresa al inventario y la acción queda auditada.

## Inventario

*Existencias* muestra cobertura y alertas (stock bajo/agotado). *Registrar movimiento* permite entradas, salidas y ajustes
(el ajuste fija el nuevo stock). *Movimientos* conserva el historial con saldo.

## Analytics

Filtre por periodo, vendedor, categoría y sucursal. Pestañas:

- **Resumen / Ventas:** KPIs, evolución, histograma con **media y mediana** marcadas, brecha porcentual e interpretación
  (si la media supera a la mediana, pocas ventas grandes elevan el promedio).
- **Productos, Clientes, Vendedores:** rankings, participación, frecuencia de compra y recurrencia.
- **Variables:** clasifica cada variable (cuantitativa discreta/continua, cualitativa nominal) y muestra su distribución.
- **Laboratorio:** calcule media, mediana o la comparación sobre una variable de ventas o sobre valores que usted escriba.
  Cada cálculo se guarda en el historial.

## Probabilidad

- **Bayes (manual):** ingrese P(A), P(B|A) y P(B|¬A) (o P(B)); el sistema muestra el desarrollo paso a paso.
- **Bayes con mis ventas:** estima las probabilidades desde sus ventas (p. ej. «dado que pagó con tarjeta, ¿qué tan probable es
  una venta alta?»).
- **Variable aleatoria:** esperanza, varianza, distribución de probabilidad y acumulada.
- **Eventos:** probabilidad de un evento como P(monto ≥ 100) por frecuencia relativa.

## Insights

*Generar análisis* evalúa reglas sobre el periodo elegido. Cada hallazgo indica su gravedad, la regla aplicada y la
**evidencia numérica** que lo respalda.

## Reportes

Elija tipo y periodo → *Generar*. Puede **exportar CSV** (abre en Excel con tildes) o **imprimir** la vista. El historial
registra cada generación.

## Administración (solo administrador)

Cree y edite usuarios (rol, estado, contraseña) y consulte la bitácora de auditoría con filtros por tipo de acción.
