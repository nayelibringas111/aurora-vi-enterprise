export type Role = 'admin' | 'gerente' | 'vendedor' | 'analista' | 'almacen'

export interface User {
  id: number
  email: string
  full_name: string
  role: Role
  is_active: boolean
  permissions: string[]
  last_login: string | null
}

export interface Kpis {
  revenue: number
  transactions: number
  units: number
  avg_ticket: number
  median_ticket: number
  customers: number
  discounts: number
}

export interface Describe {
  n: number; sum: number; mean: number; median: number; mode: number[]; min: number; max: number; range: number
  q1: number; q3: number; iqr: number; variance: number; std: number; cv: number | null; skewness: number
}

export interface Compare {
  mean: number; median: number; difference: number; relative_gap_pct: number; shape: string; interpretation: string; n: number
}

export interface HistBin { start: number; end: number; count: number; frequency: number; density?: number }

export interface Overview {
  filters: Record<string, string | number | null>
  kpis: Kpis
  growth: Partial<Record<'revenue' | 'transactions' | 'avg_ticket' | 'median_ticket' | 'customers', number | null>>
  by_day: { date: string; count: number; revenue: number }[]
  by_month: { month: string; count: number; revenue: number; avg: number; median: number }[]
  by_weekday: { day: string; count: number; revenue: number }[]
  top_products: { product_id: number; name: string; sku: string; units: number; revenue: number; share: number }[]
  by_category: { name: string; revenue: number; share: number }[]
  by_seller: Group[]
  by_payment: Group[]
  by_branch: Group[]
  stats: Describe | null
  compare: Compare | null
  histogram: HistBin[]
}

export interface Group { name: string; count: number; revenue: number; units: number; avg: number; median: number }

export interface Insight {
  id: number; rule_code: string; severity: 'info' | 'positivo' | 'atencion' | 'critico'
  title: string; message: string; evidence: Record<string, unknown> | null; created_at: string | null
}

export interface Dashboard extends Pick<Overview, 'kpis' | 'growth' | 'by_day' | 'by_month' | 'top_products' | 'by_category' | 'by_seller' | 'by_payment' | 'compare'> {
  days: number
  low_stock: { id: number; name: string; sku: string; stock: number; min_stock: number }[]
  insights: Insight[]
}

export interface Customer {
  id: number; doc_type: string; doc_number: string; name: string; email: string | null; phone: string | null
  city: string | null; segment: string; is_active: boolean; purchases?: number; total_spent?: number
}

export interface Product {
  id: number; sku: string; name: string; category_id: number | null; category: string | null; price: number; cost: number
  margin_pct: number; stock: number; min_stock: number; is_active: boolean
}

export interface Sale {
  id: number; number: string; status: 'pedido' | 'completada' | 'anulada'; customer_id: number | null; customer: string
  employee_id: number | null; employee: string | null; branch: string; payment_method: string | null
  subtotal: number; discount: number; tax: number; total: number; units: number; notes: string | null; created_at: string
  items?: { product_id: number; sku: string; name: string; quantity: number; unit_price: number; discount: number; line_total: number }[]
}

export interface Paged<T> { total: number; items: T[] }
