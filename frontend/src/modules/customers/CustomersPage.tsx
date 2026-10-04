import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { Badge, Card, Drawer, Empty, ErrorBox, Field, Kpi, Modal, PageHead, Skeleton } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useDebounced, useGet } from '@/hooks/useData'
import { useToast } from '@/hooks/useToast'
import { api, ApiError } from '@/services/api'
import type { Customer, Paged, Sale } from '@/types'
import { dateTime, int, money, STATUS_LABEL, STATUS_TONE } from '@/utils/format'

const EMPTY = { doc_type: 'DNI', doc_number: '', name: '', email: '', phone: '', city: '', segment: 'Minorista', is_active: true }

function CustomerForm({ initial, onClose, onSaved }: { initial?: Customer; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState<any>(initial ? { ...EMPTY, ...initial, email: initial.email ?? '', phone: initial.phone ?? '', city: initial.city ?? '' } : EMPTY)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: unknown) => setF((p: any) => ({ ...p, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const local: Record<string, string> = {}
    if (f.name.trim().length < 2) local.name = 'Ingrese el nombre o razón social'
    if (!/^[0-9A-Za-z-]{6,20}$/.test(f.doc_number)) local.doc_number = 'Documento de 6 a 20 caracteres'
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) local.email = 'Correo inválido'
    setErrs(local)
    if (Object.keys(local).length) return
    setBusy(true)
    try {
      const body = { ...f, email: f.email || null, phone: f.phone || null, city: f.city || null }
      if (initial) await api.put(`/customers/${initial.id}`, body)
      else await api.post('/customers', body)
      toast.ok(initial ? 'Cliente actualizado' : 'Cliente creado')
      onSaved()
    } catch (err) {
      const ae = err as ApiError
      setErrs(ae.fields ?? {})
      toast.err(ae.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title={initial ? 'Editar cliente' : 'Nuevo cliente'} onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose} type="button">Cancelar</button>
        <button className="btn primary" form="cust-form" disabled={busy}>{busy && <span className="spinner" />} Guardar</button>
      </>
    }>
      <form id="cust-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Tipo de documento"><select className="select" value={f.doc_type} onChange={(e) => set('doc_type', e.target.value)}>{['DNI', 'RUC', 'CE', 'PAS'].map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Número" error={errs.doc_number}><input className={`input ${errs.doc_number ? 'invalid' : ''}`} value={f.doc_number} onChange={(e) => set('doc_number', e.target.value)} /></Field>
        <Field label="Nombre / razón social" error={errs.name} full><input className={`input ${errs.name ? 'invalid' : ''}`} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Correo" error={errs.email}><input className={`input ${errs.email ? 'invalid' : ''}`} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Teléfono"><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Ciudad"><input className="input" value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
        <Field label="Segmento"><select className="select" value={f.segment} onChange={(e) => set('segment', e.target.value)}>{['Minorista', 'Mayorista', 'Corporativo'].map((t) => <option key={t}>{t}</option>)}</select></Field>
      </form>
    </Modal>
  )
}

function CustomerDrawer({ id, onClose, onEdit, canEdit }: { id: number; onClose: () => void; onEdit: (c: Customer) => void; canEdit: boolean }) {
  const { data, loading, error } = useGet<Customer & { history: Sale[]; summary: { purchases: number; total: number; avg_ticket: number } }>(`/customers/${id}`)
  return (
    <Drawer title="Ficha del cliente" onClose={onClose} footer={data && canEdit ? <button className="btn" onClick={() => onEdit(data)}><Icon name="edit" size={15} /> Editar</button> : undefined}>
      {loading && <Skeleton h={200} />}
      {error && <ErrorBox message={error} />}
      {data && (
        <div className="stack">
          <div>
            <h2 style={{ fontSize: 19 }}>{data.name}</h2>
            <div className="muted small">{data.doc_type} {data.doc_number} · {data.city ?? 'Sin ciudad'} · <Badge tone="info" plain>{data.segment}</Badge></div>
            <div className="small" style={{ marginTop: 6 }}>{data.email ?? '—'} · {data.phone ?? '—'}</div>
          </div>
          <div className="stat-grid">
            <div className="stat"><span>Compras</span><b>{int(data.summary.purchases)}</b></div>
            <div className="stat"><span>Total</span><b>{money(data.summary.total)}</b></div>
            <div className="stat"><span>Ticket prom.</span><b>{money(data.summary.avg_ticket)}</b></div>
          </div>
          <div>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Historial de compras</h3>
            {data.history.length === 0 ? <Empty icon="cart" title="Sin compras registradas" /> : (
              <div className="timeline">
                {data.history.map((s) => (
                  <div className="ev" key={s.id}>
                    <span />
                    <div><div className="cell-main mono">{s.number}</div><div className="cell-sub">{dateTime(s.created_at)} · <Badge tone={STATUS_TONE[s.status]} plain>{STATUS_LABEL[s.status]}</Badge></div></div>
                    <b className="num">{money(s.total)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}

export default function CustomersPage() {
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [segment, setSegment] = useState('')
  const dq = useDebounced(q)
  const { data, loading, error, reload } = useGet<Paged<Customer>>('/customers', { q: dq, segment })
  const [editing, setEditing] = useState<Customer | 'new' | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)

  useEffect(() => {
    if (params.get('nuevo') && can('customers:write')) {
      setEditing('new')
      setParams({}, { replace: true })
    }
  }, [params, can, setParams])

  const items = data?.items ?? []
  const totalSpent = items.reduce((s, c) => s + (c.total_spent ?? 0), 0)

  return (
    <div className="page">
      <PageHead title="Clientes" subtitle="Ficha, historial y comportamiento comercial.">
        {can('customers:write') && <button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Nuevo cliente</button>}
      </PageHead>
      <div className="grid g-kpi" style={{ marginBottom: 16 }}>
        <Kpi label="Clientes" icon="users" value={int(data?.total ?? 0)} color="var(--c1)" />
        <Kpi label="Facturación acumulada" icon="tag" value={money(totalSpent)} foot="de los clientes listados" color="var(--c2)" />
        <Kpi label="Con compras" icon="cart" value={int(items.filter((c) => (c.purchases ?? 0) > 0).length)} color="var(--c4)" />
      </div>
      <div className="filters">
        <div className="input-icon" style={{ flex: '1 1 260px', maxWidth: 360 }}>
          <Icon name="search" size={16} />
          <input className="input" placeholder="Buscar por nombre, documento o correo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar clientes" />
        </div>
        <select className="select" value={segment} onChange={(e) => setSegment(e.target.value)} aria-label="Segmento">
          <option value="">Todos los segmentos</option>
          {['Minorista', 'Mayorista', 'Corporativo'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {error && <ErrorBox message={error} retry={reload} />}
      <Card pad={false}>
        {loading && !data ? <div style={{ padding: 18 }}><Skeleton h={260} /></div> : items.length === 0 ? (
          <Empty icon="users" title="No se encontraron clientes" text="Pruebe con otro criterio de búsqueda o registre un nuevo cliente." />
        ) : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Cliente</th><th>Documento</th><th>Ciudad</th><th>Segmento</th><th className="r">Compras</th><th className="r">Total</th></tr></thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="click" onClick={() => setViewing(c.id)}>
                    <td><div className="cell-main">{c.name}</div><div className="cell-sub">{c.email ?? 'Sin correo'}</div></td>
                    <td className="mono small">{c.doc_type} {c.doc_number}</td>
                    <td>{c.city ?? '—'}</td>
                    <td><Badge tone={c.segment === 'Minorista' ? '' : 'info'} plain>{c.segment}</Badge></td>
                    <td className="r">{int(c.purchases)}</td>
                    <td className="r">{money(c.total_spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editing && <CustomerForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
      {viewing && <CustomerDrawer id={viewing} canEdit={can('customers:write')} onClose={() => setViewing(null)} onEdit={(c) => { setViewing(null); setEditing(c) }} />}
    </div>
  )
}
