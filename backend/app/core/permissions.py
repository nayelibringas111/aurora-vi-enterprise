"""Matriz de roles y permisos. Formato: <modulo>:<read|write>. '*' = todo."""

ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": ["*"],
    "gerente": [
        "dashboard:read", "customers:read", "products:read", "sales:read", "inventory:read",
        "analytics:read", "analytics:write", "probability:read", "probability:write",
        "insights:read", "insights:write", "reports:read", "reports:write", "audit:read",
    ],
    "vendedor": [
        "dashboard:read", "customers:read", "customers:write", "products:read",
        "sales:read", "sales:write", "inventory:read",
    ],
    "analista": [
        "dashboard:read", "customers:read", "products:read", "sales:read",
        "analytics:read", "analytics:write", "probability:read", "probability:write",
        "insights:read", "insights:write", "reports:read", "reports:write",
    ],
    "almacen": [
        "dashboard:read", "products:read", "products:write", "inventory:read",
        "inventory:write", "sales:read",
    ],
}

ROLE_DESCRIPTIONS = {
    "admin": "Configura el sistema, usuarios, roles y parámetros.",
    "gerente": "Consulta indicadores, Analytics, reportes y resultados comerciales.",
    "vendedor": "Registra clientes, pedidos y ventas autorizadas.",
    "analista": "Ejecuta análisis estadísticos y genera insights y reportes.",
    "almacen": "Gestiona stock y movimientos de inventario.",
}


def has_permission(role: str, perm: str) -> bool:
    perms = ROLE_PERMISSIONS.get(role, [])
    return "*" in perms or perm in perms
