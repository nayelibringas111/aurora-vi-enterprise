import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { Badge, Card, Empty, ErrorBox, PageHead, Segmented, Skeleton } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useGet } from '@/hooks/useData'
import { useToast } from '@/hooks/useToast'
import { api } from '@/services/api'
import type { Insight } from '@/types'
import { dateTime } from '@/utils/format'

const TONE: Record<string, string> = { critico: 'bad', atencion: 'warn', positivo: 'ok', info: 'info' }
const LABEL: Record<string, string> = { critico: 'Crítico', atencion: 'Atención', positivo: 'Positivo', info: 'Informativo' }

function label(k: string): string {
  return k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}
function fmtVal(v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' && x ? Object.values(x as object).join(' · ') : String(x))).join(', ')
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
  return String(v)
}

export default function InsightsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useGet<Insight[]>('/insights')
  const [days, setDays] = useState(90)
  const [busy, setBusy] = useState(false)

  const generate = async () => {
    setBusy(true)
    try {
      const r = await api.post<Insight[]>('/insights/generate', undefined, { days })
      toast.ok(`${r.length} hallazgos generados`)
      reload()
    } catch (e) { toast.err((e as Error).message) } finally { setBusy(false) }
  }

  const counts = (data ?? []).reduce<Record<string, number>>((m, i) => ({ ...m, [i.severity]: (m[i.severity] ?? 0) + 1 }), {})

  return (
    <div className="page">
      <PageHead title="Insights" subtitle="Hallazgos explicables: cada conclusión muestra la evidencia numérica que la originó.">
        {can('insights:write') && (
          <>
            <Segmented value={days} onChange={setDays} options={[{ id: 30, label: '30 d' }, { id: 90, label: '90 d' }, { id: 365, label: '12 m' }]} />
            <button className="btn primary" onClick={generate} disabled={busy}>{busy ? <span className="spinner" /> : <Icon name="sparkle" size={16} />} Generar análisis</button>
          </>
        )}
      </PageHead>
      {error && <ErrorBox message={error} retry={reload} />}
      {loading && !data && <Skeleton h={300} />}
      {data && data.length === 0 && (
        <Card><Empty icon="bulb" title="Aún no hay hallazgos" text="Genere el análisis para evaluar las reglas sobre sus ventas recientes." /></Card>
      )}
      {data && data.length > 0 && (
        <div className="stack">
          <div className="row">
            {Object.entries(counts).map(([k, n]) => <Badge key={k} tone={TONE[k]}>{n} {LABEL[k].toLowerCase()}</Badge>)}
            <span className="small muted">Generado {dateTime(data[0].created_at)}</span>
          </div>
          {data.map((i) => (
            <article key={i.id} className={`insight ${i.severity}`}>
              <div className="bar" />
              <div>
                <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <h4>{i.title}</h4>
                  <Badge tone={TONE[i.severity]} plain>{LABEL[i.severity]}</Badge>
                </div>
                <p>{i.message}</p>
                {i.evidence && (
                  <div className="evidence" aria-label="Evidencia">
                    {Object.entries(i.evidence).map(([k, v]) => <span key={k}>{label(k)}: {fmtVal(v)}</span>)}
                  </div>
                )}
                <div className="small muted" style={{ marginTop: 8 }}>Regla: <span className="mono">{i.rule_code}</span></div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
