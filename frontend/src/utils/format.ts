const nf = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const money = (v: number | null | undefined) => (v == null ? '—' : `S/ ${nf2.format(v)}`)
export const moneyCompact = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `S/ ${(v / 1_000_000).toFixed(2)} M`
  if (a >= 10_000) return `S/ ${(v / 1000).toFixed(1)} k`
  return `S/ ${nf.format(v)}`
}
export const int = (v: number | null | undefined) => (v == null ? '—' : nf.format(v))
export const dec = (v: number | null | undefined, d = 2) =>
  v == null ? '—' : new Intl.NumberFormat('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v)
export const pct = (v: number | null | undefined, d = 1) => (v == null ? '—' : `${dec(v, d)}%`)
export const prob = (v: number) => `${dec(v * 100, 2)}%`

export function dateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }).replace('.', '')
}
export const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }).replace('.', '')

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')

export const isoDate = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}
export const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDate(d) }

export const STATUS_LABEL: Record<string, string> = { pedido: 'Pedido', completada: 'Completada', anulada: 'Anulada' }
export const STATUS_TONE: Record<string, string> = { pedido: 'warn', completada: 'ok', anulada: 'bad' }
export const PAY_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', yape: 'Yape', plin: 'Plin', transferencia: 'Transferencia',
}
export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador', gerente: 'Gerente', vendedor: 'Vendedor', analista: 'Analista', almacen: 'Almacén',
}
