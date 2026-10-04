import { useState, type FormEvent } from 'react'
import { Icon } from '@/components/Icon'
import { Badge, Card, Empty, ErrorBox, Field, Kpi, Modal, PageHead, Skeleton } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useDebounced, useGet } from '@/hooks/useData'
import { useToast } from '@/hooks/useToast'
import { api, ApiError } from '@/services/api'
import type { Paged, Product } from '@/types'
import { dec, int, money } from '@/utils/format'

interface Cat { id: number; name: string }

export function stockTone(p: Pick<Product, 'stock' | 'min_stock'>) {
  return p.stock === 0 ? 'bad' : p.stock <= p.min_stock ? 'warn' : 'ok'
}
export function stockLabel(p: Pick<Product, 'stock' | 'min_stock'>) {
  return p.stock === 0 ? 'Agotado' : p.stock <= p.min_stock ? 'Stock bajo' : 'Disponible'
}

function ProductForm({ initial, cats, onClose, onSaved, onCats }: {
  initial?: Product; cats: Cat[]; onClose: () => void; onSaved: () => void; onCats: () => void
}) {
  const toast = useToast()
  const [f, setF] = useState<any>(initial
    ? { sku: initial.sku, name: initial.name, category_id: initial.category_id ?? '', price: String(initial.price), cost: String(initial.cost), min_stock: String(initial.min_stock), initial_stock: '0', is_active: initial.is_active }
    : { sku: '', name: '', category_id: '', price: '', cost: '', min_stock: '10', initial_stock: '0', is_active: true })
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [newCat, setNewCat] = useState('')
  const set = (k: string, v: unknown) => setF((p: any) => ({ ...p, [k]: v }))

  const addCat = async () => {
    if (newCat.trim().length < 2) return
    try {
      const c = await api.post<Cat>('/categories', { name: newCat.trim() })
      onCats(); set('category_id', String(c.id)); setNewCat(''); toast.ok('Categoría creada')
    } catch (e) { toast.err((e as Error).message) }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const l: Record<string, string> = {}
    if (f.sku.trim().length < 2) l.sku = 'Ingrese un SKU'
    if (f.name.trim().length < 2) l.name = 'Ingrese el nombre'
    if (!(Number(f.price) > 0)) l.price = 'Precio mayor a 0'
    if (Number(f.cost) < 0 || f.cost === '') l.cost = 'Costo inválido'
    setErrs(l)
    if (Object.keys(l).length) return
    setBusy(true)
    try {
      const body = {
        sku: f.sku.trim(), name: f.name.trim(), category_id: f.category_id ? Number(f.category_id) : null,
        price: Number(f.price), cost: Number(f.cost), min_stock: Number(f.min_stock) || 0,
        initial_stock: Number(f.initial_stock) || 0, is_active: f.is_active,
      }
      if (initial) await api.put(`/products/${initial.id}`, body)
      else await api.post('/products', body)
      toast.ok(initial ? 'Producto actualizado' : 'Producto creado')
      onSaved()
    } catch (err) {
      const ae = err as ApiError
      setErrs(ae.fields ?? {}); toast.err(ae.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title={initial ? 'Editar producto' : 'Nuevo producto'} onClose={onClose} footer={
      <>
        <button className="btn" type="button" onClick={onClose}>Cancelar</button>
        <button className="btn primary" form="prod-form" disabled={busy}>{busy && <span className="spinner" />} Guardar</button>
      </>
    }>
      <form id="prod-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="SKU" error={errs.sku}><input className={`input ${errs.sku ? 'invalid' : ''}`} value={f.sku} onChange={(e) => set('sku', e.target.value)} /></Field>
        <Field label="Categoría">
          <select className="select" value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">Sin categoría</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Nombre" error={errs.name} full><input className={`input ${errs.name ? 'invalid' : ''}`} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Precio de venta (sin IGV)" error={errs.price}><input className={`input ${errs.price ? 'invalid' : ''}`} inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
        <Field label="Costo" error={errs.cost}><input className={`input ${errs.cost ? 'invalid' : ''}`} inputMode="decimal" value={f.cost} onChange={(e) => set('cost', e.target.value)} /></Field>
        <Field label="Stock mínimo"><input className="input" inputMode="numeric" value={f.min_stock} onChange={(e) => set('min_stock', e.target.value)} /></Field>
        {!initial && <Field label="Stock inicial"><input className="input" inputMode="numeric" value={f.initial_stock} onChange={(e) => set('initial_stock', e.target.value)} /></Field>}
        <Field label="Nueva categoría" hint="Cree una categoría sin salir del formulario">
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Ej. Snacks" />
            <button type="button" className="btn" onClick={addCat}>Añadir</button>
          </div>
        </Field>
        <Field label="Estado">
          <select className="select" value={f.is_active ? '1' : '0'} onChange={(e) => set('is_active', e.target.value === '1')}>
            <option value="1">Activo</option><option value="0">Inactivo</option>
          </select>
        </Field>
      </form>
    </Modal>
  )
}

export default function ProductsPage() {
  const { can } = useAuth()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [low, setLow] = useState(false)
  const dq = useDebounced(q)
  const { data, loading, error, reload } = useGet<Paged<Product>>('/products', { q: dq, category_id: cat, low_stock: low || undefined })
  const cats = useGet<Cat[]>('/categories')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const items = data?.items ?? []
  const stockValue = items.reduce((s, p) => s + p.stock * p.cost, 0)

  return (
    <div className="page">
      <PageHead title="Productos" subtitle="Catálogo, categorías, precios y estado de stock.">
        {can('products:write') && <button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Nuevo producto</button>}
      </PageHead>
      <div className="grid g-kpi" style={{ marginBottom: 16 }}>
        <Kpi label="Productos" icon="box" value={int(data?.total ?? 0)} color="var(--c1)" />
        <Kpi label="Valor en stock (costo)" icon="tag" value={money(stockValue)} color="var(--c2)" />
        <Kpi label="Con stock bajo" icon="alert" value={int(items.filter((p) => p.stock <= p.min_stock).length)} color="var(--c3)" />
      </div>
      <div className="filters">
        <div className="input-icon" style={{ flex: '1 1 260px', maxWidth: 360 }}>
          <Icon name="search" size={16} />
          <input className="input" placeholder="Buscar por nombre o SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar productos" />
        </div>
        <select className="select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="row small" style={{ gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /> Solo stock bajo</label>
      </div>
      {error && <ErrorBox message={error} retry={reload} />}
      <Card pad={false}>
        {loading && !data ? <div style={{ padding: 18 }}><Skeleton h={260} /></div> : items.length === 0 ? (
          <Empty icon="box" title="Sin productos" text="No hay productos que coincidan con los filtros." />
        ) : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Producto</th><th>Categoría</th><th className="r">Precio</th><th className="r">Margen</th><th className="r">Stock</th><th>Estado</th>{can('products:write') && <th />}</tr></thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.55 }}>
                    <td><div className="cell-main">{p.name}</div><div className="cell-sub mono">{p.sku}</div></td>
                    <td>{p.category ?? '—'}</td>
                    <td className="r">{money(p.price)}</td>
                    <td className="r">{dec(p.margin_pct, 1)}%</td>
                    <td className="r">{int(p.stock)} <span className="muted small">/ mín {p.min_stock}</span></td>
                    <td><Badge tone={stockTone(p)}>{p.is_active ? stockLabel(p) : 'Inactivo'}</Badge></td>
                    {can('products:write') && <td className="r"><button className="icon-btn" onClick={() => setEditing(p)} aria-label={`Editar ${p.name}`}><Icon name="edit" size={16} /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editing && <ProductForm initial={editing === 'new' ? undefined : editing} cats={cats.data ?? []} onCats={cats.reload} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </div>
  )
}
