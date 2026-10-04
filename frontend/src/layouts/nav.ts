import type { IconName } from '@/components/Icon'

export interface NavItem { to: string; label: string; icon: IconName; perm: string; keywords?: string }
export interface NavGroup { title: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    title: 'Operación',
    items: [
      { to: '/', label: 'Panel', icon: 'dashboard', perm: 'dashboard:read', keywords: 'inicio resumen kpi' },
      { to: '/ventas', label: 'Ventas', icon: 'cart', perm: 'sales:read', keywords: 'pedidos pagos' },
      { to: '/clientes', label: 'Clientes', icon: 'users', perm: 'customers:read' },
      { to: '/productos', label: 'Productos', icon: 'box', perm: 'products:read', keywords: 'catálogo categorías' },
      { to: '/inventario', label: 'Inventario', icon: 'warehouse', perm: 'inventory:read', keywords: 'stock movimientos' },
    ],
  },
  {
    title: 'Inteligencia',
    items: [
      { to: '/analytics', label: 'Analytics', icon: 'chart', perm: 'analytics:read', keywords: 'media mediana estadística variables' },
      { to: '/probabilidad', label: 'Probabilidad', icon: 'dice', perm: 'probability:read', keywords: 'bayes variables aleatorias' },
      { to: '/insights', label: 'Insights', icon: 'bulb', perm: 'insights:read', keywords: 'hallazgos reglas' },
      { to: '/reportes', label: 'Reportes', icon: 'file', perm: 'reports:read', keywords: 'exportar csv imprimir' },
    ],
  },
  {
    title: 'Sistema',
    items: [{ to: '/admin', label: 'Administración', icon: 'shield', perm: 'users:read', keywords: 'usuarios auditoría' }],
  },
]
