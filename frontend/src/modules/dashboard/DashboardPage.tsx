import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarList, Donut, TrendChart } from '@/components/Charts'
import { Icon } from '@/components/Icon'
import { Badge, Card, Empty, ErrorBox, Kpi, PageHead, PageSkeleton, Segmented } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useGet } from '@/hooks/useData'
import type { Dashboard } from '@/types'
import { dayLabel, int, money, moneyCompact, monthLabel, PAY_LABEL } from '@/utils/format'

const SEV: Record<string, string> = { critico: 'bad', atencion: 'warn', positivo: 'ok', info: 'info' }

export default function DashboardPage() {
  const { user, can } = useAuth()
  const [days, setDays] = useState(30)
  const { data, loading, error, reload } = useGet<Dashboard>('/dashboard/summary', { days })

  const greeting = (() => {
    const h = new Date().getHours()
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
  })()

  return (
    <div className="page">
      <PageHead title={`${greeting}, ${user?.full_name.split(' ')[0]}`} subtitle="Resumen ejecutivo de la operación comercial.">
        <Segmented value={days} onChange={setDays} options={[{ id: 7, label: '7 días' }, { id: 30, label: '30 días' }, { id: 90, label: '90 días' }, { id: 365, label: '12 meses' }]} />
        {can('sales:write') && <Link to="/ventas/nueva" className="btn primary"><Icon name="plus" size={16} /> Nueva venta</Link>}
      </PageHead>

      {error && <ErrorBox message={error} retry={reload} />}
      {loading && !data && <PageSkeleton />}
      {data && (
        <div className="stack" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          <div className="grid g-kpi">
            <Kpi label="Ingresos" icon="tag" value={moneyCompact(data.kpis.revenue)} delta={data.growth.revenue} foot="vs. periodo anterior" color="var(--c1)" />
            <Kpi label="Transacciones" icon="cart" value={int(data.kpis.transactions)} delta={data.growth.transactions} foot={`${int(data.kpis.units)} unidades`} color="var(--c2)" />
            <Kpi label="Ticket promedio (media)" icon="sigma" value={money(data.kpis.avg_ticket)} delta={data.growth.avg_ticket} color="var(--c3)" />
            <Kpi label="Venta típica (mediana)" icon="layers" value={money(data.kpis.median_ticket)} delta={data.growth.median_ticket} color="var(--c4)" />
            <Kpi label="Clientes activos" icon="users" value={int(data.kpis.customers)} delta={data.growth.customers} color="var(--c5)" />
          </div>

          <div className="grid g-21">
            <Card title="Evolución de ingresos" sub={`Últimos ${days} días`}>
              {data.by_day.length ? (
                <TrendChart data={data.by_day} x="date" series={[{ key: 'revenue', name: 'Ingresos' }]} fmt={moneyCompact} xFmt={dayLabel} />
              ) : <Empty icon="chart" title="Sin ventas en el periodo" />}
            </Card>
            <Card title="Ingresos por categoría" sub="Participación">
              {data.by_category.length ? <Donut data={data.by_category.map((c) => ({ name: c.name, value: c.revenue }))} fmt={money} /> : <Empty title="Sin datos" />}
            </Card>
          </div>

          {data.compare && (
            <div className="alert info" style={{ alignItems: 'center' }}>
              <Icon name="sigma" size={20} />
              <div>
                <b>Media {money(data.compare.mean)} · Mediana {money(data.compare.median)}.</b>{' '}
                <span style={{ opacity: 0.9 }}>{data.compare.interpretation}</span>
              </div>
              {can('analytics:read') && <Link to="/analytics" className="btn sm" style={{ marginLeft: 'auto' }}>Ver análisis</Link>}
            </div>
          )}

          <div className="grid g-3">
            <Card title="Productos líderes" sub="Por ingresos">
              <BarList fmt={moneyCompact} rows={data.top_products.map((p) => ({ label: p.name, value: p.revenue, sub: `${int(p.units)} und · ${p.share}%` }))} />
            </Card>
            <Card title="Ventas por vendedor">
              {data.by_seller.length ? <BarList fmt={moneyCompact} rows={data.by_seller.map((s) => ({ label: s.name, value: s.revenue, sub: `${s.count} ventas · ticket ${money(s.avg)}` }))} /> : <Empty title="Sin datos" />}
            </Card>
            <Card title="Stock en alerta" sub="En o bajo el mínimo" right={can('inventory:read') && <Link to="/inventario" className="small">Ver inventario</Link>}>
              {data.low_stock.length ? (
                <div className="timeline">
                  {data.low_stock.map((p) => (
                    <div className="ev" key={p.id}>
                      <span />
                      <div><div className="cell-main">{p.name}</div><div className="cell-sub">{p.sku} · mínimo {p.min_stock}</div></div>
                      <Badge tone={p.stock === 0 ? 'bad' : 'warn'}>{p.stock} und</Badge>
                    </div>
                  ))}
                </div>
              ) : <Empty icon="check" title="Inventario saludable" text="Ningún producto está bajo su stock mínimo." />}
            </Card>
          </div>

          <div className="grid g-2">
            <Card title="Ticket por mes" sub="Media frente a mediana en el periodo">
              <TrendChart height="sm" data={data.by_month} x="month" series={[{ key: 'avg', name: 'Media', color: 'var(--c3)' }, { key: 'median', name: 'Mediana', color: 'var(--c4)' }]} fmt={money} xFmt={monthLabel} />
              <p className="small muted" style={{ marginTop: 6 }}>Si la media se separa de la mediana, pocas ventas grandes están elevando el promedio.</p>
            </Card>
            <Card title="Hallazgos recientes" right={can('insights:read') && <Link to="/insights" className="small">Ver todos</Link>}>
              {data.insights.length ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {data.insights.map((i) => (
                    <div key={i.id} style={{ display: 'flex', gap: 10 }}>
                      <Badge tone={SEV[i.severity]} plain>{i.severity}</Badge>
                      <div style={{ minWidth: 0 }}><div className="cell-main">{i.title}</div><div className="cell-sub">{i.message}</div></div>
                    </div>
                  ))}
                </div>
              ) : <Empty icon="bulb" title="Aún no hay insights" text="Genere los hallazgos desde la sección Insights." />}
            </Card>
          </div>

          <Card title="Métodos de pago">
            <div className="stat-grid">
              {data.by_payment.map((p) => (
                <div className="stat" key={p.name}><span>{PAY_LABEL[p.name] ?? p.name}</span><b>{money(p.revenue)}</b><div className="cell-sub">{p.count} ventas</div></div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
