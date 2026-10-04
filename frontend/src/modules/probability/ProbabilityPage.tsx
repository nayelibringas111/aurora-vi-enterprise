import { useState } from 'react'
import { Histogram, PmfChart } from '@/components/Charts'
import { Icon } from '@/components/Icon'
import { Badge, Card, Empty, ErrorBox, Field, PageHead, Stat, Tabs } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useGet } from '@/hooks/useData'
import { api } from '@/services/api'
import { daysAgo, dateTime, dec, int, isoDate, PAY_LABEL, prob } from '@/utils/format'

type Tab = 'bayes' | 'empirico' | 'aleatoria' | 'eventos' | 'historial'
const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')))

function BayesResult({ r }: { r: any }) {
  const up = r.lift != null && r.lift > 1
  return (
    <div className="stack">
      <div>
        <div className="muted small">Probabilidad posterior P(A|B)</div>
        <div className="result-big" style={{ color: 'var(--brand)' }}>{prob(r.posterior)}</div>
        {r.lift != null && (
          <Badge tone={up ? 'ok' : 'warn'}>{up ? 'La evidencia aumenta' : 'La evidencia reduce'} la probabilidad ×{dec(r.lift, 2)} respecto a la previa ({prob(r.prior)})</Badge>
        )}
      </div>
      <div className="formula">{r.formula}</div>
      <div className="steps">{r.steps.map((s: string, i: number) => <div key={i}>{s}</div>)}</div>
      {r.counts && (
        <div className="stat-grid">
          <Stat label="Observaciones" value={int(r.counts.total)} /><Stat label="Evento A" value={int(r.counts.A)} />
          <Stat label="Evidencia B" value={int(r.counts.B)} /><Stat label="A y B" value={int(r.counts.A_y_B)} />
        </div>
      )}
      <p className="small muted">Resultado reproducible: los mismos datos producen siempre el mismo valor.</p>
    </div>
  )
}

function BayesManual() {
  const [f, setF] = useState({ hypothesis: 'Cliente comprará de nuevo', evidence: 'Abrió la promoción', prior: '0.2', likelihood: '0.7', fp: '0.15', mode: 'fp' as 'fp' | 'marginal', marginal: '0.26' })
  const [res, setRes] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  const run = async () => {
    setErr(null)
    const prior = num(f.prior), lik = num(f.likelihood), fp = num(f.fp), marg = num(f.marginal)
    const bad = (x: number) => !Number.isFinite(x) || x < 0 || x > 1
    if (bad(prior) || bad(lik) || (f.mode === 'fp' ? bad(fp) : bad(marg))) { setErr('Todas las probabilidades deben ser números entre 0 y 1.'); return }
    setBusy(true)
    try {
      setRes(await api.post('/probability/bayes', { hypothesis: f.hypothesis, evidence: f.evidence, prior, likelihood: lik, ...(f.mode === 'fp' ? { false_positive: fp } : { marginal: marg }) }))
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="grid g-12" style={{ alignItems: 'start' }}>
      <Card title="Datos del problema" sub="Ingrese probabilidades entre 0 y 1">
        <div className="stack">
          <Field label="Hipótesis (A)"><input className="input" value={f.hypothesis} onChange={(e) => set('hypothesis', e.target.value)} /></Field>
          <Field label="Evidencia (B)"><input className="input" value={f.evidence} onChange={(e) => set('evidence', e.target.value)} /></Field>
          <div className="form-grid">
            <Field label="P(A) · a priori"><input className="input" inputMode="decimal" value={f.prior} onChange={(e) => set('prior', e.target.value)} /></Field>
            <Field label="P(B|A) · verosimilitud"><input className="input" inputMode="decimal" value={f.likelihood} onChange={(e) => set('likelihood', e.target.value)} /></Field>
          </div>
          <div className="seg" style={{ justifySelf: 'start' }}>
            <button className={f.mode === 'fp' ? 'on' : ''} onClick={() => set('mode', 'fp')}>Conozco P(B|¬A)</button>
            <button className={f.mode === 'marginal' ? 'on' : ''} onClick={() => set('mode', 'marginal')}>Conozco P(B)</button>
          </div>
          {f.mode === 'fp' ? <Field label="P(B|¬A) · falso positivo"><input className="input" inputMode="decimal" value={f.fp} onChange={(e) => set('fp', e.target.value)} /></Field>
            : <Field label="P(B) · marginal"><input className="input" inputMode="decimal" value={f.marginal} onChange={(e) => set('marginal', e.target.value)} /></Field>}
          {err && <ErrorBox message={err} />}
          <button className="btn primary" onClick={run} disabled={busy}>{busy && <span className="spinner" />} Calcular posterior</button>
        </div>
      </Card>
      <Card title="Resultado explicado">{res ? <BayesResult r={res} /> : <Empty icon="dice" title="Sin resultado todavía" text="Calcule para ver la probabilidad posterior paso a paso." />}</Card>
    </div>
  )
}

function BayesEmpirical() {
  const [threshold, setThreshold] = useState('150')
  const [method, setMethod] = useState('tarjeta')
  const [segment, setSegment] = useState('')
  const [days, setDays] = useState('365')
  const [res, setRes] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setErr(null)
    const t = num(threshold)
    if (!Number.isFinite(t) || t < 0) { setErr('Ingrese un umbral válido.'); return }
    setBusy(true)
    try {
      setRes(await api.post('/probability/bayes/empirical', { threshold: t, payment_method: method, segment: segment || null, date_from: daysAgo(Number(days) - 1), date_to: isoDate(new Date()) }))
    } catch (e) { setErr((e as Error).message); setRes(null) } finally { setBusy(false) }
  }

  return (
    <div className="grid g-12" style={{ alignItems: 'start' }}>
      <Card title="Bayes con datos reales" sub="A = venta alta · B = método de pago">
        <div className="stack">
          <p className="small muted">Pregunta: si una venta se pagó con el método elegido (B), ¿cuál es la probabilidad de que sea una venta alta (A)? Las probabilidades se estiman con sus propias ventas.</p>
          <Field label="Venta alta si el total es ≥ (S/)"><input className="input" inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></Field>
          <Field label="Evidencia: método de pago"><select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>{Object.entries(PAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Segmento de cliente"><select className="select" value={segment} onChange={(e) => setSegment(e.target.value)}><option value="">Todos</option><option>Minorista</option><option>Mayorista</option><option>Corporativo</option></select></Field>
          <Field label="Periodo"><select className="select" value={days} onChange={(e) => setDays(e.target.value)}><option value="90">Últimos 90 días</option><option value="180">Últimos 6 meses</option><option value="365">Últimos 12 meses</option></select></Field>
          {err && <ErrorBox message={err} />}
          <button className="btn primary" onClick={run} disabled={busy}>{busy && <span className="spinner" />} Calcular con mis ventas</button>
        </div>
      </Card>
      <Card title="Resultado explicado" sub={res ? `${res.hypothesis} dado ${res.evidence.toLowerCase()}` : undefined}>{res ? <BayesResult r={res} /> : <Empty icon="chart" title="Sin resultado todavía" />}</Card>
    </div>
  )
}

function RandomVariable() {
  const [variable, setVariable] = useState('unidades_por_venta')
  const [kind, setKind] = useState('')
  const [res, setRes] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true); setErr(null)
    try { setRes(await api.post('/random-variables/analyze', { variable, kind: kind || null, date_from: daysAgo(364), date_to: isoDate(new Date()) })) }
    catch (e) { setErr((e as Error).message); setRes(null) } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      <Card title="Variable aleatoria" sub="Esperanza, varianza y distribución de probabilidad (últimos 12 meses)">
        <div className="row">
          <select className="select" style={{ width: 'auto' }} value={variable} onChange={(e) => setVariable(e.target.value)} aria-label="Variable">
            <option value="unidades_por_venta">Unidades por venta</option><option value="items_por_venta">Productos distintos por venta</option>
            <option value="monto_venta">Monto de venta</option><option value="descuento_venta">Descuento aplicado</option>
          </select>
          <select className="select" style={{ width: 'auto' }} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Naturaleza">
            <option value="">Detectar naturaleza</option><option value="discreta">Discreta</option><option value="continua">Continua</option>
          </select>
          <button className="btn primary" onClick={run} disabled={busy}>{busy && <span className="spinner" />} Analizar</button>
        </div>
        {err && <div style={{ marginTop: 12 }}><ErrorBox message={err} /></div>}
      </Card>
      {res && (
        <>
          <div className="stat-grid">
            <Stat label="Naturaleza" value={res.kind} /><Stat label="n" value={int(res.n)} />
            <Stat label="Esperanza E[X]" value={dec(res.expected_value, 3)} /><Stat label="Varianza" value={dec(res.variance, 3)} /><Stat label="Desv. estándar" value={dec(res.std, 3)} />
          </div>
          <div className="formula">{res.formula}</div>
          {res.kind === 'discreta' ? (
            <div className="grid g-2">
              <Card title="Distribución de probabilidad"><PmfChart rows={res.pmf} /></Card>
              <Card title="Tabla" pad={false}>
                <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}><table className="t"><thead><tr><th className="r">x</th><th className="r">Frecuencia</th><th className="r">P(X=x)</th><th className="r">F(x)</th></tr></thead>
                  <tbody>{res.pmf.map((r: any) => <tr key={r.x}><td className="r">{r.x}</td><td className="r">{int(r.count)}</td><td className="r">{prob(r.p)}</td><td className="r">{prob(r.cdf)}</td></tr>)}</tbody></table></div>
              </Card>
            </div>
          ) : <Card title="Densidad empírica"><Histogram bins={res.histogram} mean={res.expected_value} median={res.median} /></Card>}
        </>
      )}
    </div>
  )
}

function Events() {
  const [variable, setVariable] = useState('monto_venta')
  const [op, setOp] = useState('ge')
  const [t, setT] = useState('100')
  const [u, setU] = useState('300')
  const [res, setRes] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const run = async () => {
    setErr(null)
    const th = num(t), up = num(u)
    if (!Number.isFinite(th) || (op === 'between' && !Number.isFinite(up))) { setErr('Ingrese valores numéricos válidos.'); return }
    try { setRes(await api.post('/probability/event', { variable, op, threshold: th, upper: op === 'between' ? up : null, date_from: daysAgo(364), date_to: isoDate(new Date()) })) }
    catch (e) { setErr((e as Error).message); setRes(null) }
  }
  const OPS: Record<string, string> = { ge: '≥', gt: '>', le: '≤', lt: '<', eq: '=', between: 'entre' }
  return (
    <Card title="Probabilidad de un evento" sub="Estimada a partir de la frecuencia relativa en sus ventas (12 meses)">
      <div className="row">
        <span>P(</span>
        <select className="select" style={{ width: 'auto' }} value={variable} onChange={(e) => setVariable(e.target.value)} aria-label="Variable">
          <option value="monto_venta">Monto de venta</option><option value="unidades_por_venta">Unidades por venta</option><option value="items_por_venta">Productos por venta</option><option value="descuento_venta">Descuento</option>
        </select>
        <select className="select" style={{ width: 'auto' }} value={op} onChange={(e) => setOp(e.target.value)} aria-label="Operador">{Object.entries(OPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input className="input" style={{ width: 100 }} value={t} onChange={(e) => setT(e.target.value)} aria-label="Valor" />
        {op === 'between' && <><span>y</span><input className="input" style={{ width: 100 }} value={u} onChange={(e) => setU(e.target.value)} aria-label="Valor superior" /></>}
        <span>)</span>
        <button className="btn primary" onClick={run}>Calcular</button>
      </div>
      {err && <div style={{ marginTop: 12 }}><ErrorBox message={err} /></div>}
      {res && (
        <div className="stack" style={{ marginTop: 16 }}>
          <div className="result-big">{prob(res.probability)}</div>
          <div className="formula">P = casos favorables / casos totales = {int(res.favorable)} / {int(res.total)}</div>
        </div>
      )}
    </Card>
  )
}

function History() {
  const { data, error, reload } = useGet<{ bayes: any[] }>('/statistics/history', { limit: 30 })
  if (error) return <ErrorBox message={error} retry={reload} />
  const rows = data?.bayes ?? []
  return (
    <Card title="Análisis de Bayes guardados" pad={false}>
      {rows.length === 0 ? <Empty title="Sin análisis guardados" /> : (
        <div className="table-wrap"><table className="t"><thead><tr><th>Fecha</th><th>Hipótesis</th><th>Evidencia</th><th className="r">P(A)</th><th className="r">P(B|A)</th><th className="r">P(B)</th><th className="r">P(A|B)</th><th>Origen</th></tr></thead>
          <tbody>{rows.map((b) => <tr key={b.id}><td className="small">{dateTime(b.created_at)}</td><td>{b.hypothesis}</td><td>{b.evidence}</td><td className="r">{prob(b.prior)}</td><td className="r">{prob(b.likelihood)}</td><td className="r">{prob(b.marginal)}</td><td className="r cell-main">{prob(b.posterior)}</td><td><Badge plain tone="info">{b.source}</Badge></td></tr>)}</tbody></table></div>
      )}
    </Card>
  )
}

export default function ProbabilityPage() {
  const { can } = useAuth()
  const [tab, setTab] = useState<Tab>('bayes')
  return (
    <div className="page">
      <PageHead title="Probabilidad" subtitle="Teorema de Bayes, eventos y variables aleatorias con resultados reproducibles." />
      {!can('probability:write') && <div className="alert info" style={{ marginBottom: 14 }}><Icon name="info" /> Su rol permite consultar pero no ejecutar análisis nuevos.</div>}
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'bayes', label: 'Bayes (manual)' }, { id: 'empirico', label: 'Bayes con mis ventas' }, { id: 'aleatoria', label: 'Variable aleatoria' }, { id: 'eventos', label: 'Eventos' }, { id: 'historial', label: 'Historial' }]} />
      {tab === 'bayes' && <BayesManual />}
      {tab === 'empirico' && <BayesEmpirical />}
      {tab === 'aleatoria' && <RandomVariable />}
      {tab === 'eventos' && <Events />}
      {tab === 'historial' && <History />}
    </div>
  )
}
