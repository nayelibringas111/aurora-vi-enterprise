import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { Badge, Card, Confirm, Drawer, Empty, ErrorBox, Kpi, PageHead, Skeleton } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useDebounced, useGet } from '@/hooks/useData'
import { useToast } from '@/hooks/useToast'
import { api } from '@/services/api'
import type { Paged, Sale } from '@/types'
import { dateTime, int, money, PAY_LABEL, STATUS_LABEL, STATUS_TONE } from '@/utils/format'

function SaleDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const { can } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useGet<Sale>(`/sales/${id}`)
  const [confirm, setConfirm] = useState<'cancel' | 'confirm' | null>(null)
  const [busy, setBusy] = useState(false)

  const act = async (kind: 'cancel' | 'confirm') => {
    setBusy(true)
    try {
      await api.post(`/sales/${id}/${kind}`)
      toast.ok(kind === 'cancel' ? 'Venta anulada y stock restituido' : 'Pedido confirmado')
      setConfirm(null); reload(); onChanged()
    } catch (e) { toast.err((e as Error).message); setConfirm(null) } finally { setBusy(false) }
  }

  return (
    <Drawer title={data ? `Venta ${data.number}` : 'Venta'} onClose={onClose} footer={
      data && can('sales:write') && data.status !== 'anulada' ? (
        <>
          {data.status === 'pedido' && <button className="btn primary" onClick={() => setConfirm('confirm')}><Icon name="check" size={16} /> Confirmar y cobrar</button>}
          <button className="btn danger" onClick={() => setConfirm('cancel')}>Anular</button>
        </>
      ) : undefined
    }>
      {loading && <Skeleton h={240} />}
      {error && <ErrorBox message={error} />}
      {data && (
        <div className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Badge tone={STATUS_TONE[data.status]}>{STATUS_LABEL[data.status]}</Badge>
            <span className="muted small">{dateTime(data.created_at)}</span>
          </div>
          <div className="stat-grid">
            <div className="stat"><span>Cliente</span><b style={{ fontSize: 14 }}>{data.customer}</b></div>
            <div className="stat"><span>Vendedor</span><b style={{ fontSize: 14 }}>{data.employee ?? '—'}</b></div>
            <div className="stat"><span>Pago</span><b style={{ fontSize: 14 }}>{PAY_LABEL[data.payment_method ?? ''] ?? '—'}</b></div>
            <div className="stat"><span>Sucursal</span><b style={{ fontSize: 14 }}>{data.branch}</b></div>
          </div>
          <div className="table-wrap card">
            <table className="t">
              <thead><tr><th>Producto</th><th className="r">Cant.</th><th className="r">P. unit.</th><th className="r">Importe</th></tr></thead>
              <tbody>
                {data.items?.map((i) => (
                  <tr key={i.product_id}>
                    <td><div className="cell-main">{i.name}</div><div className="cell-sub mono">{i.sku}{i.discount > 0 && ` · desc. ${money(i.discount)}`}</div></td>
                    <td className="r">{i.quantity}</td><td className="r">{money(i.unit_price)}</td><td className="r">{money(i.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="totals">
            <div><span className="muted">Subtotal</span><span className="num">{money(data.subtotal)}</span></div>
            {data.discount > 0 && <div><span className="muted">Descuentos aplicados</span><span className="num">− {money(data.discount)}</span></div>}
            <div><span className="muted">IGV (18%)</span><span className="num">{money(data.tax)}</span></div>
            <div className="grand"><span>Total</span><span className="num">{money(data.total)}</span></div>
          </div>
          {data.notes && <p className="small muted">Notas: {data.notes}</p>}
        </div>
      )}
      {confirm === 'cancel' && <Confirm danger title="Anular venta" text="Se anulará la venta y las unidades regresarán al inventario. Esta acción queda registrada en auditoría." confirmLabel="Anular venta" busy={busy} onConfirm={() => act('cancel')} onClose={() => setConfirm(null)} />}
      {confirm === 'confirm' && <Confirm title="Confirmar pedido" text="Se registrará el pago y se descontará el stock de los productos." confirmLabel="Confirmar" busy={busy} onConfirm={() => act('confirm')} onClose={() => setConfirm(null)} />}
    </Drawer>
  )
}

export default function SalesPage() {
  const { can } = useAuth()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const { data, loading, error, reload } = useGet<Paged<Sale>>('/sales', { status, q: dq, limit: 100 })
  const [open, setOpen] = useState<number | null>(null)
  const items = data?.items ?? []
  const done = items.filter((s) => s.status === 'completada')

  return (
    <div className="page">
      <PageHead title="Ventas" subtitle="Pedidos, ventas y pagos registrados.">
        {can('sales:write') && <Link to="/ventas/nueva" className="btn primary"><Icon name="plus" size={16} /> Nueva venta</Link>}
      </PageHead>
      <div className="grid g-kpi" style={{ marginBottom: 16 }}>
        <Kpi label="Registros" icon="cart" value={int(data?.total ?? 0)} foot="según filtros" color="var(--c1)" />
        <Kpi label="Ingresos listados" icon="tag" value={money(done.reduce((s, x) => s + x.total, 0))} foot="solo completadas" color="var(--c2)" />
        <Kpi label="Pedidos pendientes" icon="clock" value={int(items.filter((s) => s.status === 'pedido').length)} color="var(--c3)" />
      </div>
      <div className="filters">
        <div className="input-icon" style={{ flex: '1 1 240px', maxWidth: 320 }}>
          <Icon name="search" size={16} />
          <input className="input" placeholder="Buscar por número (V-0001…)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ventas" />
        </div>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          <option value="completada">Completadas</option><option value="pedido">Pedidos</option><option value="anulada">Anuladas</option>
        </select>
      </div>
      {error && <ErrorBox message={error} retry={reload} />}
      <Card pad={false}>
        {loading && !data ? <div style={{ padding: 18 }}><Skeleton h={300} /></div> : items.length === 0 ? (
          <Empty icon="cart" title="Sin ventas" text="No hay registros con esos filtros." action={can('sales:write') ? <Link className="btn primary" to="/ventas/nueva">Registrar venta</Link> : undefined} />
        ) : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Número</th><th>Fecha</th><th>Cliente</th><th>Vendedor</th><th>Pago</th><th>Estado</th><th className="r">Total</th></tr></thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="click" onClick={() => setOpen(s.id)}>
                    <td className="mono cell-main">{s.number}</td>
                    <td className="small">{dateTime(s.created_at)}</td>
                    <td>{s.customer}</td>
                    <td>{s.employee ?? '—'}</td>
                    <td>{PAY_LABEL[s.payment_method ?? ''] ?? '—'}</td>
                    <td><Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge></td>
                    <td className="r cell-main">{money(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {open && <SaleDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  )
}
