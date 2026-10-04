import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { Badge, Card, Empty, ErrorBox, Field, PageHead, Stat } from '@/components/ui'
import { useGet } from '@/hooks/useData'
import { useToast } from '@/hooks/useToast'
import { api } from '@/services/api'
import { dateShort, dateTime, daysAgo, int, isoDate } from '@/utils/format'

interface Report { kind: string; title: string; generated_at: string; columns: string[]; rows: (string | number)[][]; summary: Record<string, number> }

const cell = (v: string | number) => (typeof v === 'number' ? (Number.isInteger(v) ? int(v) : v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : v)

export default function ReportsPage() {
  const toast = useToast()
  const kinds = useGet<{ kind: string; title: string }[]>('/reports/kinds')
  const history = useGet<any[]>('/reports/history')
  const [kind, setKind] = useState('ventas')
  const [from, setFrom] = useState(daysAgo(29))
  const [to, setTo] = useState(isoDate(new Date()))
  const [rep, setRep] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [limit, setLimit] = useState(100)

  const generate = async () => {
    setBusy(true); setErr(null); setLimit(100)
    try { setRep(await api.get<Report>('/reports', { kind, date_from: from, date_to: to })); history.reload() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const csv = async () => {
    try { await api.download('/reports', { kind, date_from: from, date_to: to, format: 'csv' }, `aurora-vi-${kind}.csv`); toast.ok('Reporte exportado'); history.reload() }
    catch (e) { toast.err((e as Error).message) }
  }

  return (
    <div className="page">
      <PageHead title="Reportes" subtitle="Reportes comerciales y estadísticos con exportación y vista imprimible." />
      <Card className="no-print" title="Parámetros">
        <div className="row" style={{ alignItems: 'end' }}>
          <Field label="Tipo de reporte">
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
              {(kinds.data ?? []).map((k) => <option key={k.kind} value={k.kind}>{k.title}</option>)}
            </select>
          </Field>
          <Field label="Desde"><input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Hasta"><input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
          <button className="btn primary" onClick={generate} disabled={busy}>{busy && <span className="spinner" />} Generar</button>
          <button className="btn" onClick={csv}><Icon name="download" size={16} /> CSV</button>
          {rep && <button className="btn" onClick={() => window.print()}><Icon name="print" size={16} /> Imprimir</button>}
        </div>
      </Card>
      {err && <div style={{ marginTop: 14 }}><ErrorBox message={err} /></div>}

      {rep && (
        <div className="stack" style={{ marginTop: 16 }}>
          <Card title={rep.title} sub={`Generado el ${dateShort(rep.generated_at)} · ${int(rep.rows.length)} filas`}>
            <div className="stat-grid">{Object.entries(rep.summary).map(([k, v]) => <Stat key={k} label={k} value={cell(v)} />)}</div>
          </Card>
          <Card pad={false}>
            {rep.rows.length === 0 ? <Empty title="Sin datos en el periodo" /> : (
              <div className="table-wrap"><table className="t">
                <thead><tr>{rep.columns.map((c, i) => <th key={c} className={typeof rep.rows[0][i] === 'number' ? 'r' : ''}>{c}</th>)}</tr></thead>
                <tbody>{rep.rows.slice(0, limit).map((r, ri) => <tr key={ri}>{r.map((v, i) => <td key={i} className={typeof v === 'number' ? 'r' : ''}>{cell(v)}</td>)}</tr>)}</tbody>
              </table></div>
            )}
            {rep.rows.length > limit && <div className="no-print" style={{ padding: 14, textAlign: 'center' }}><button className="btn sm" onClick={() => setLimit((l) => l + 200)}>Mostrar más ({int(rep.rows.length - limit)} restantes)</button></div>}
          </Card>
        </div>
      )}

      {!rep && !busy && <div style={{ marginTop: 16 }}><Card><Empty icon="file" title="Genere un reporte" text="Elija el tipo y el periodo para ver la vista previa." /></Card></div>}

      <div className="no-print" style={{ marginTop: 16 }}>
        <Card title="Historial reciente" pad={false}>
          {(history.data ?? []).length === 0 ? <Empty title="Aún no se generaron reportes" /> : (
            <div className="table-wrap"><table className="t"><thead><tr><th>Fecha</th><th>Reporte</th><th className="r">Filas</th><th>Periodo</th></tr></thead>
              <tbody>{history.data!.map((h) => <tr key={h.id}><td className="small">{dateTime(h.created_at)}</td><td><Badge plain tone="info">{h.title}</Badge></td><td className="r">{int(h.rows)}</td><td className="small">{h.params?.date_from ?? '—'} → {h.params?.date_to ?? '—'}</td></tr>)}</tbody></table></div>
          )}
        </Card>
      </div>
    </div>
  )
}
