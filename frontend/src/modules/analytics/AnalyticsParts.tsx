import { useState } from 'react'
import { ColumnChart, Donut, Histogram, PmfChart } from '@/components/Charts'
import { Icon } from '@/components/Icon'
import { Badge, Card, Empty, ErrorBox, Field, Kpi, PageSkeleton, Skeleton, Stat } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useGet } from '@/hooks/useData'
import { useToast } from '@/hooks/useToast'
import { api } from '@/services/api'
import type { Compare, Describe, HistBin } from '@/types'
import { dateTime, dateShort, dec, int, money, moneyCompact, pct } from '@/utils/format'

type Dates = { date_from: string; date_to: string }

export function Customers360({ dates }: { dates: Dates }) {
  const { data, loading, error, reload } = useGet<any>('/analytics/customers', dates)
  if (loading && !data) return <PageSkeleton />
  if (error) return <ErrorBox message={error} retry={reload} />
  if (!data || !data.top_customers.length) return <Card><Empty icon="users" title="Sin compras de clientes identificados" /></Card>
  return (
    <div className="stack">
      <div className="grid g-kpi">
        <Kpi label="Clientes recurrentes" icon="users" value={pct(data.recurrent_share)} foot="compraron más de una vez" color="var(--c1)" />
        {data.frequency_stats && <Kpi label="Frecuencia media" icon="sigma" value={`${dec(data.frequency_stats.mean)} compras`} foot={`mediana ${dec(data.frequency_stats.median, 1)}`} color="var(--c2)" />}
      </div>
      <div className="grid g-2">
        <Card title="Frecuencia de compra" sub="Clientes según cantidad de compras">
          <ColumnChart height="sm" data={data.frequency_distribution} x="purchases" y="customers" name="Clientes" />
        </Card>
        <Card title="Ingresos por segmento"><Donut data={data.by_segment.map((s: any) => ({ name: s.segment, value: s.revenue }))} fmt={money} /></Card>
      </div>
      <Card title="Mejores clientes" pad={false}>
        <div className="table-wrap"><table className="t">
          <thead><tr><th>Cliente</th><th>Segmento</th><th className="r">Compras</th><th className="r">Ingresos</th><th className="r">Ticket prom.</th><th>Última compra</th></tr></thead>
          <tbody>{data.top_customers.map((c: any) => (
            <tr key={c.customer_id}><td className="cell-main">{c.name}</td><td>{c.segment}</td><td className="r">{c.purchases}</td><td className="r">{money(c.revenue)}</td><td className="r">{money(c.avg_ticket)}</td><td className="small">{dateShort(c.last_purchase)}</td></tr>
          ))}</tbody></table></div>
      </Card>
    </div>
  )
}

interface VarMeta { name: string; label: string; unit: string | null; kind: string }

export function Variables({ dates }: { dates: Dates }) {
  const vars = useGet<VarMeta[]>('/analytics/variables')
  const [sel, setSel] = useState('monto_venta')
  const { data, loading, error, reload } = useGet<any>(`/analytics/variables/${sel}`, dates)

  return (
    <div className="stack">
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        {(vars.data ?? []).map((v) => (
          <button key={v.name} onClick={() => setSel(v.name)} className="card" style={{ textAlign: 'left', padding: '14px 16px', cursor: 'pointer', borderColor: sel === v.name ? 'var(--accent)' : undefined, boxShadow: sel === v.name ? '0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent)' : undefined }}>
            <div className="cell-main">{v.label}</div>
            <div className="small muted" style={{ textTransform: 'capitalize' }}>{v.kind}{v.unit ? ` · ${v.unit}` : ''}</div>
          </button>
        ))}
      </div>
      {loading && !data && <Skeleton h={300} />}
      {error && <ErrorBox message={error} retry={reload} />}
      {data && (
        <>
          <Card title={data.label} right={<Badge tone="info" plain>{data.classification.label}</Badge>}>
            <p>{data.classification.explanation}</p>
            <p className="small muted" style={{ marginTop: 6 }}>{int(data.n)} observaciones · {int(data.classification.distinct)} valores distintos</p>
          </Card>
          {data.classification.type === 'cualitativa' && (
            <Card title="Tabla de frecuencias" pad={false}>
              <div className="table-wrap"><table className="t"><thead><tr><th>Categoría</th><th className="r">Frecuencia absoluta</th><th className="r">Relativa</th></tr></thead>
                <tbody>{data.classification.frequencies.map((f: any) => <tr key={f.value}><td className="cell-main" style={{ textTransform: 'capitalize' }}>{f.value}</td><td className="r">{int(f.count)}</td><td className="r">{pct(f.frequency * 100)}</td></tr>)}</tbody></table></div>
            </Card>
          )}
          {data.stats && (
            <div className="grid g-2">
              <Card title="Distribución"><Histogram bins={data.histogram as HistBin[]} mean={data.compare?.mean} median={data.compare?.median} /></Card>
              <Card title="Estadísticos"><StatsGrid s={data.stats} unit={data.unit} /></Card>
            </div>
          )}
          {data.pmf && <Card title="Función de probabilidad empírica" sub="P(X = x) y acumulada"><PmfChart rows={data.pmf} /></Card>}
        </>
      )}
    </div>
  )
}

function StatsGrid({ s, unit }: { s: Describe; unit?: string | null }) {
  const f = (v: number) => (unit === 'S/' ? money(v) : dec(v))
  return (
    <div className="stat-grid">
      <Stat label="Media" value={f(s.mean)} /><Stat label="Mediana" value={f(s.median)} />
      <Stat label="Moda" value={s.mode.length ? s.mode.map((m) => dec(m, 0)).join(', ') : '—'} />
      <Stat label="Mín" value={f(s.min)} /><Stat label="Máx" value={f(s.max)} /><Stat label="Rango" value={f(s.range)} />
      <Stat label="Desv. est." value={f(s.std)} /><Stat label="Varianza" value={dec(s.variance)} /><Stat label="Asimetría" value={dec(s.skewness)} />
    </div>
  )
}

/** Laboratorio: calcula media, mediana y comparación sobre datos propios o variables de ventas. */
export function Lab({ dates }: { dates: Dates }) {
  const { can } = useAuth()
  const toast = useToast()
  const [source, setSource] = useState<'manual' | 'ventas'>('ventas')
  const [text, setText] = useState('120, 85.5, 240, 99, 310, 1450, 130')
  const [variable, setVariable] = useState('monto_venta')
  const [busy, setBusy] = useState<string | null>(null)
  const [res, setRes] = useState<{ kind: string; data: any } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const hist = useGet<{ analyses: any[] }>('/statistics/history', { limit: 12 })

  const parse = (): number[] | null => {
    const nums = text.split(/[\s,;]+/).filter(Boolean).map((t) => Number(t.replace(',', '.')))
    if (!nums.length || nums.some((n) => !Number.isFinite(n))) { setErr('Ingrese solo números separados por comas, espacios o saltos de línea.'); return null }
    return nums
  }

  const run = async (kind: 'mean' | 'median' | 'compare') => {
    setErr(null)
    let body: Record<string, unknown>
    if (source === 'manual') {
      const v = parse(); if (!v) return
      body = { values: v }
    } else body = { variable, date_from: dates.date_from, date_to: dates.date_to }
    setBusy(kind)
    try {
      const data = await api.post(`/statistics/${kind}`, body)
      setRes({ kind, data }); hist.reload()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  const snapshot = async () => {
    try {
      const r = await api.post('/datasets/snapshot', undefined, { date_from: dates.date_from, date_to: dates.date_to })
      toast.ok(`Dataset «${r.name}» creado con ${r.rows} observaciones`)
    } catch (e) { toast.err((e as Error).message) }
  }

  return (
    <div className="stack">
      <div className="grid g-12" style={{ alignItems: 'start' }}>
        <Card title="Datos de entrada" sub="Cada cálculo queda guardado en el historial">
          <div className="stack">
            <div className="seg" style={{ justifySelf: 'start' }}>
              <button className={source === 'ventas' ? 'on' : ''} onClick={() => setSource('ventas')}>Variable de ventas</button>
              <button className={source === 'manual' ? 'on' : ''} onClick={() => setSource('manual')}>Valores manuales</button>
            </div>
            {source === 'ventas' ? (
              <Field label="Variable" hint="Se calcula sobre las ventas del periodo seleccionado">
                <select className="select" value={variable} onChange={(e) => setVariable(e.target.value)}>
                  <option value="monto_venta">Monto de venta</option><option value="unidades_por_venta">Unidades por venta</option>
                  <option value="items_por_venta">Productos distintos por venta</option><option value="descuento_venta">Descuento aplicado</option>
                </select>
              </Field>
            ) : (
              <Field label="Valores" hint="Separe con comas, espacios o saltos de línea"><textarea className="textarea mono" value={text} onChange={(e) => setText(e.target.value)} /></Field>
            )}
            {err && <ErrorBox message={err} />}
            {can('analytics:write') && (
              <div className="row">
                <button className="btn primary" disabled={!!busy} onClick={() => run('mean')}>{busy === 'mean' && <span className="spinner" />} Media</button>
                <button className="btn primary" disabled={!!busy} onClick={() => run('median')}>{busy === 'median' && <span className="spinner" />} Mediana</button>
                <button className="btn" disabled={!!busy} onClick={() => run('compare')}>{busy === 'compare' && <span className="spinner" />} Comparar</button>
              </div>
            )}
            {can('analytics:write') && <button className="btn ghost sm" style={{ justifySelf: 'start' }} onClick={snapshot}><Icon name="layers" size={15} /> Congelar ventas como dataset</button>}
          </div>
        </Card>

        <Card title="Resultado">
          {!res ? <Empty icon="sigma" title="Elija un cálculo" text="Los resultados aparecen aquí con su fórmula y explicación." /> : (
            <div className="stack">
              {res.kind === 'mean' && (<>
                <div><div className="muted small">Media aritmética (n = {int(res.data.n)})</div><div className="result-big">{dec(res.data.mean, 4)}</div></div>
                <div className="formula">{res.data.formula}<br />= {dec(res.data.sum, 2)} / {int(res.data.n)} = {dec(res.data.mean, 4)}</div>
              </>)}
              {res.kind === 'median' && (<>
                <div><div className="muted small">Mediana (n = {int(res.data.n)})</div><div className="result-big">{dec(res.data.median, 4)}</div></div>
                <p>{res.data.method}</p>
                <div className="formula">Valor(es) central(es): {res.data.central_values.map((v: number) => dec(v, 2)).join('  y  ')}</div>
              </>)}
              {res.kind === 'compare' && <CompareResult d={res.data as Compare & { describe: Describe; histogram: HistBin[]; classification: any }} />}
              {res.data.analysis_id && <p className="small muted">Guardado como análisis #{res.data.analysis_id}</p>}
            </div>
          )}
        </Card>
      </div>

      <Card title="Historial de análisis" pad={false}>
        {(hist.data?.analyses ?? []).length === 0 ? <Empty title="Aún no hay análisis" /> : (
          <div className="table-wrap"><table className="t"><thead><tr><th>#</th><th>Fecha</th><th>Tipo</th><th>Variable</th><th className="r">n</th><th>Resultado</th></tr></thead>
            <tbody>{hist.data!.analyses.map((a) => (
              <tr key={a.id}><td className="mono">{a.id}</td><td className="small">{dateTime(a.created_at)}</td><td><Badge tone="info" plain>{a.kind}</Badge></td><td>{a.variable ?? 'manual'}</td><td className="r">{int(a.n)}</td>
                <td className="small mono">{Object.entries(a.results).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k}: ${dec(v as number, 2)}`).join(' · ')}</td></tr>
            ))}</tbody></table></div>
        )}
      </Card>
    </div>
  )
}

function CompareResult({ d }: { d: Compare & { describe: Describe; histogram: HistBin[]; classification: any } }) {
  return (
    <div className="stack">
      <div className="grid g-2">
        <div><div className="muted small">Media</div><div className="result-big" style={{ color: 'var(--c3)' }}>{dec(d.mean)}</div></div>
        <div><div className="muted small">Mediana</div><div className="result-big" style={{ color: 'var(--c4)' }}>{dec(d.median)}</div></div>
      </div>
      <div className="row"><Badge tone={d.shape === 'simétrica' ? 'ok' : 'warn'}>Distribución {d.shape}</Badge><Badge tone="info" plain>{d.classification.label}</Badge></div>
      <p>{d.interpretation}</p>
      {d.histogram.length > 1 && <Histogram bins={d.histogram} mean={d.mean} median={d.median} />}
      <div className="stat-grid"><Stat label="n" value={int(d.describe.n)} /><Stat label="Mín" value={dec(d.describe.min)} /><Stat label="Máx" value={dec(d.describe.max)} /><Stat label="Desv. est." value={dec(d.describe.std)} /></div>
    </div>
  )
}

export { moneyCompact }
