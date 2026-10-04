import { useState, type FormEvent } from 'react'
import { Icon } from '@/components/Icon'
import { Badge, Card, Empty, ErrorBox, Field, Kpi, Modal, PageHead, Skeleton, Tabs } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useGet } from '@/hooks/useData'
import { useToast } from '@/hooks/useToast'
import { api } from '@/services/api'
import type { Paged, Product } from '@/types'
import { dateTime, int, money } from '@/utils/format'
import { stockLabel, stockTone } from '../products/ProductsPage'

interface Movement { id: number; product: string; sku: string; type: string; quantity: number; balance: number; reason: string | null; reference: string | null; created_at: string }
const TYPE_TONE: Record<string, string> = { entrada: 'ok', salida: 'warn', ajuste: 'info' }

function MovementModal({ products, preset, onClose, onSaved }: { products: Product[]; preset?: Product; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [pid, setPid] = useState(preset ? String(preset.id) : '')
  const [type, setType] = useState('entrada')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const sel = products.find((p) => String(p.id) === pid)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!pid || !(Number(qty) > 0)) { toast.err('Seleccione un producto e ingrese una cantidad válida'); return }
    setBusy(true)
    try {
      await api.post('/inventory/movements', { product_id: Number(pid), type, quantity: Number(qty), reason: reason || null })
      toast.ok('Movimiento registrado'); onSaved()
    } catch (err) { toast.err((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal title="Registrar movimiento" onClose={onClose} footer={
      <>
        <button className="btn" type="button" onClick={onClose}>Cancelar</button>
        <button className="btn primary" form="mv-form" disabled={busy}>{busy && <span className="spinner" />} Registrar</button>
      </>
    }>
      <form id="mv-form" className="form-grid" onSubmit={submit}>
        <Field label="Producto" full>
          <select className="select" value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">Seleccione…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} · stock {p.stock}</option>)}
          </select>
        </Field>
        <Field label="Tipo">
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="entrada">Entrada (suma al stock)</option>
            <option value="salida">Salida (resta del stock)</option>
            <option value="ajuste">Ajuste (fija el stock)</option>
          </select>
        </Field>
        <Field label={type === 'ajuste' ? 'Nuevo stock' : 'Cantidad'} hint={sel ? `Stock actual: ${sel.stock}` : undefined}>
          <input className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Motivo" full><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Compra a proveedor, merma, conteo físico" /></Field>
      </form>
    </Modal>
  )
}

export default function InventoryPage() {
  const { can } = useAuth()
  const [tab, setTab] = useState<'stock' | 'mov'>('stock')
  const prods = useGet<Paged<Product>>('/products', { active: true })
  const mov = useGet<Movement[]>(tab === 'mov' ? '/inventory/movements' : null, { limit: 150 })
  const [modal, setModal] = useState<{ preset?: Product } | null>(null)
  const items = [...(prods.data?.items ?? [])].sort((a, b) => a.stock / Math.max(a.min_stock, 1) - b.stock / Math.max(b.min_stock, 1))
  const low = items.filter((p) => p.stock <= p.min_stock)
  const value = items.reduce((s, p) => s + p.stock * p.cost, 0)

  return (
    <div className="page">
      <PageHead title="Inventario" subtitle="Existencias y trazabilidad de movimientos.">
        {can('inventory:write') && <button className="btn primary" onClick={() => setModal({})}><Icon name="plus" size={16} /> Registrar movimiento</button>}
      </PageHead>
      <div className="grid g-kpi" style={{ marginBottom: 16 }}>
        <Kpi label="Unidades en stock" icon="warehouse" value={int(items.reduce((s, p) => s + p.stock, 0))} color="var(--c1)" />
        <Kpi label="Valor de inventario" icon="tag" value={money(value)} foot="a precio de costo" color="var(--c2)" />
        <Kpi label="Bajo mínimo" icon="alert" value={int(low.length)} foot={`${int(items.filter((p) => p.stock === 0).length)} agotados`} color="var(--c3)" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'stock', label: 'Existencias' }, { id: 'mov', label: 'Movimientos' }]} />
      {prods.error && <ErrorBox message={prods.error} retry={prods.reload} />}
      {tab === 'stock' && (
        <Card pad={false}>
          {prods.loading && !prods.data ? <div style={{ padding: 18 }}><Skeleton h={260} /></div> : (
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>Producto</th><th className="r">Stock</th><th className="r">Mínimo</th><th style={{ width: 200 }}>Cobertura</th><th>Estado</th>{can('inventory:write') && <th />}</tr></thead>
                <tbody>
                  {items.map((p) => {
                    const ratio = Math.min(p.stock / Math.max(p.min_stock * 3, 1), 1)
                    return (
                      <tr key={p.id}>
                        <td><div className="cell-main">{p.name}</div><div className="cell-sub mono">{p.sku}</div></td>
                        <td className="r">{int(p.stock)}</td>
                        <td className="r muted">{int(p.min_stock)}</td>
                        <td><div className="bar-row" style={{ gridTemplateColumns: '1fr', padding: 0 }}><div className="track"><div className="fill" style={{ width: `${ratio * 100}%`, background: p.stock === 0 ? 'var(--neg)' : p.stock <= p.min_stock ? 'var(--c3)' : 'var(--c4)' }} /></div></div></td>
                        <td><Badge tone={stockTone(p)}>{stockLabel(p)}</Badge></td>
                        {can('inventory:write') && <td className="r"><button className="btn sm" onClick={() => setModal({ preset: p })}>Mover</button></td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {tab === 'mov' && (
        <Card pad={false}>
          {mov.loading && !mov.data ? <div style={{ padding: 18 }}><Skeleton h={260} /></div> : mov.error ? <div style={{ padding: 18 }}><ErrorBox message={mov.error} retry={mov.reload} /></div> : (mov.data ?? []).length === 0 ? <Empty title="Sin movimientos" /> : (
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th className="r">Cantidad</th><th className="r">Saldo</th><th>Motivo / referencia</th></tr></thead>
                <tbody>
                  {(mov.data ?? []).map((m) => (
                    <tr key={m.id}>
                      <td className="small">{dateTime(m.created_at)}</td>
                      <td><div className="cell-main">{m.product}</div><div className="cell-sub mono">{m.sku}</div></td>
                      <td><Badge tone={TYPE_TONE[m.type]}>{m.type}</Badge></td>
                      <td className="r">{m.type === 'salida' ? '−' : m.type === 'entrada' ? '+' : ''}{int(m.quantity)}</td>
                      <td className="r">{int(m.balance)}</td>
                      <td className="small">{m.reason ?? '—'}{m.reference && <span className="mono muted"> · {m.reference}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {modal && <MovementModal products={prods.data?.items ?? []} preset={modal.preset} onClose={() => setModal(null)} onSaved={() => { setModal(null); prods.reload(); mov.reload() }} />}
    </div>
  )
}
