import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { Card, ErrorBox, Field, PageHead } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useDebounced, useGet } from '@/hooks/useData'
import { useToast } from '@/hooks/useToast'
import { api } from '@/services/api'
import type { Customer, Paged, Product } from '@/types'
import { money, PAY_LABEL } from '@/utils/format'

interface Line { product_id: number; quantity: number; discount_pct: number }
const TAX = 0.18

export default function NewSalePage() {
  const nav = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 200)
  const products = useGet<Paged<Product>>('/products', { q: dq, active: true, limit: 60 })
  const all = useGet<Paged<Product>>('/products', { active: true, limit: 1000 })
  const customers = useGet<Paged<Customer>>('/customers', { limit: 500 })
  const employees = useGet<{ id: number; full_name: string; branch: string }[]>('/employees')
  const [lines, setLines] = useState<Line[]>([])
  const [customerId, setCustomerId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [payment, setPayment] = useState('efectivo')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const byId = useMemo(() => new Map((all.data?.items ?? []).map((p) => [p.id, p])), [all.data])

  const add = (p: Product) => {
    if (p.stock <= 0) { toast.err(`«${p.name}» no tiene stock`); return }
    setLines((ls) => {
      const ex = ls.find((l) => l.product_id === p.id)
      if (ex) return ls.map((l) => (l.product_id === p.id ? { ...l, quantity: Math.min(l.quantity + 1, p.stock) } : l))
      return [...ls, { product_id: p.id, quantity: 1, discount_pct: 0 }]
    })
  }
  const patch = (id: number, d: Partial<Line>) => setLines((ls) => ls.map((l) => (l.product_id === id ? { ...l, ...d } : l)))

  const totals = useMemo(() => {
    let gross = 0, disc = 0, units = 0
    lines.forEach((l) => {
      const p = byId.get(l.product_id)
      if (!p) return
      const g = p.price * l.quantity
      gross += g; disc += g * (l.discount_pct / 100); units += l.quantity
    })
    const subtotal = gross - disc
    return { gross, disc, subtotal, tax: subtotal * TAX, total: subtotal * (1 + TAX), units }
  }, [lines, byId])

  const submit = async (confirm: boolean) => {
    setFormError(null)
    if (!lines.length) { setFormError('Agregue al menos un producto.'); return }
    for (const l of lines) {
      const p = byId.get(l.product_id)
      if (p && confirm && l.quantity > p.stock) { setFormError(`Stock insuficiente para «${p.name}» (disponible: ${p.stock}).`); return }
    }
    setBusy(true)
    try {
      const sale = await api.post('/sales', {
        customer_id: customerId ? Number(customerId) : null,
        employee_id: employeeId ? Number(employeeId) : null,
        payment_method: payment, confirm, notes: notes || null, items: lines,
      })
      toast.ok(`${confirm ? 'Venta' : 'Pedido'} ${sale.number} registrado`)
      nav('/ventas')
    } catch (e) { setFormError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="page">
      <PageHead title="Nueva venta" subtitle="Cliente → pedido → venta → pago → inventario.">
        <Link to="/ventas" className="btn">Cancelar</Link>
      </PageHead>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr)', alignItems: 'start' }}>
        <Card title="Catálogo" sub="Toque un producto para agregarlo">
          <div className="input-icon" style={{ marginBottom: 12 }}>
            <Icon name="search" size={16} />
            <input className="input" placeholder="Buscar producto o SKU" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Buscar producto" />
          </div>
          <div style={{ display: 'grid', gap: 6, maxHeight: 540, overflowY: 'auto' }}>
            {(products.data?.items ?? []).map((p) => (
              <button key={p.id} type="button" onClick={() => add(p)} disabled={p.stock <= 0}
                style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, textAlign: 'left', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 9, background: 'var(--surface)', cursor: p.stock <= 0 ? 'not-allowed' : 'pointer', opacity: p.stock <= 0 ? 0.5 : 1 }}>
                <span><span className="cell-main">{p.name}</span><br /><span className="cell-sub"><span className="mono">{p.sku}</span> · {p.category ?? 'Sin categoría'} · stock {p.stock}</span></span>
                <b className="num">{money(p.price)}</b>
              </button>
            ))}
            {products.data && products.data.items.length === 0 && <p className="muted" style={{ padding: 16 }}>Sin resultados.</p>}
          </div>
        </Card>

        <div className="stack">
          <Card title="Datos de la venta">
            <div className="form-grid">
              <Field label="Cliente" full>
                <select className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Cliente general</option>
                  {(customers.data?.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.doc_number}</option>)}
                </select>
              </Field>
              {user?.role !== 'vendedor' && (
                <Field label="Vendedor">
                  <select className="select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                    <option value="">Sin asignar</option>
                    {(employees.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Método de pago">
                <select className="select" value={payment} onChange={(e) => setPayment(e.target.value)}>
                  {Object.entries(PAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
          </Card>

          <Card title={`Detalle (${lines.length})`}>
            {lines.length === 0 ? <p className="muted small">Aún no hay productos en la venta.</p> : (
              <div className="sale-lines">
                {lines.map((l) => {
                  const p = byId.get(l.product_id)
                  if (!p) return null
                  const lt = p.price * l.quantity * (1 - l.discount_pct / 100)
                  return (
                    <div className="sale-line" key={l.product_id}>
                      <div style={{ minWidth: 0 }}><div className="cell-main" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div><div className="cell-sub">{money(p.price)} · stock {p.stock}</div></div>
                      <input className="input" type="number" min={1} max={p.stock} value={l.quantity} aria-label={`Cantidad de ${p.name}`}
                        onChange={(e) => patch(l.product_id, { quantity: Math.max(1, Math.min(Number(e.target.value) || 1, 10000)) })} />
                      <div className="hide-sm"><input className="input" type="number" min={0} max={100} value={l.discount_pct} aria-label="Descuento %" title="Descuento %"
                        onChange={(e) => patch(l.product_id, { discount_pct: Math.max(0, Math.min(Number(e.target.value) || 0, 100)) })} /></div>
                      <div className="num hide-sm" style={{ textAlign: 'right', fontWeight: 600 }}>{money(lt)}</div>
                      <button className="icon-btn" onClick={() => setLines((ls) => ls.filter((x) => x.product_id !== l.product_id))} aria-label="Quitar"><Icon name="x" size={16} /></button>
                    </div>
                  )
                })}
                <div className="small muted hide-sm">Columnas: cantidad · descuento % · importe</div>
              </div>
            )}
          </Card>

          <div className="totals">
            <div><span className="muted">Unidades</span><span className="num">{totals.units}</span></div>
            <div><span className="muted">Valor bruto</span><span className="num">{money(totals.gross)}</span></div>
            {totals.disc > 0 && <div><span className="muted">Descuentos</span><span className="num">− {money(totals.disc)}</span></div>}
            <div><span className="muted">Subtotal</span><span className="num">{money(totals.subtotal)}</span></div>
            <div><span className="muted">IGV (18%)</span><span className="num">{money(totals.tax)}</span></div>
            <div className="grand"><span>Total</span><span className="num">{money(totals.total)}</span></div>
          </div>
          <Field label="Notas"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Opcional" /></Field>
          {formError && <ErrorBox message={formError} />}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" disabled={busy || !lines.length} onClick={() => submit(false)}>Guardar como pedido</button>
            <button className="btn primary" disabled={busy || !lines.length} onClick={() => submit(true)}>{busy && <span className="spinner" />} Cobrar y registrar venta</button>
          </div>
        </div>
      </div>
    </div>
  )
}
