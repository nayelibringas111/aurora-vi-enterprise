import { useMemo, useState } from 'react'
import { BarList, ColumnChart, Donut, Histogram, TrendChart } from '@/components/Charts'
import { Badge, Card, Empty, ErrorBox, Kpi, PageHead, PageSkeleton, Segmented, Stat, Tabs } from '@/components/ui'
import { useGet } from '@/hooks/useData'
import type { Overview } from '@/types'
import { daysAgo, dayLabel, dec, int, isoDate, money, moneyCompact, monthLabel, pct } from '@/utils/format'
import { Customers360, Lab, Variables } from './AnalyticsParts'

type Tab = 'resumen' | 'ventas' | 'productos' | 'clientes' | 'vendedores' | 'variables' | 'lab'

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('resumen')
  const [range, setRange] = useState<number | 'custom'>(90)
  const [from, setFrom] = useState(daysAgo(89))
  const [to, setTo] = useState(isoDate(new Date()))
  const [seller, setSeller] = useState('')
  const [category, setCategory] = useState('')
  const [branch, setBranch] = useState('')

  const cats = useGet<{ id: number; name: string }[]>('/categories')
  const emps = useGet<{ id: number; full_name: string; branch: string }[]>('/employees')

  const dates = useMemo(() => (range === 'custom' ? { date_from: from, date_to: to } : { date_from: daysAgo(range - 1), date_to: isoDate(new Date()) }), [range, from, to])
  const q = { ...dates, employee_id: seller, category_id: category, branch }
  const { data, loading, error, reload } = useGet<Overview>('/analytics/overview', q)
  const branches = useMemo(() => Array.from(new Set((emps.data ?? []).map((e) => e.branch))), [emps.data])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'resumen', label: 'Resumen' }, { id: 'ventas', label: 'Ventas' }, { id: 'productos', label: 'Productos' },
    { id: 'clientes', label: 'Clientes' }, { id: 'vendedores', label: 'Vendedores' }, { id: 'variables', label: 'Variables' },
    { id: 'lab', label: 'Laboratorio' },
  ]
  const scoped = ['resumen', 'ventas', 'productos', 'vendedores'].includes(tab)

  return (
    <div className="page">
      <PageHead title="Analytics" subtitle="Las ventas generan los datos; aquí se convierten en estadística, gráficos e insights.">
        <Segmented value={range} onChange={setRange} options={[{ id: 30, label: '30 d' }, { id: 90, label: '90 d' }, { id: 180, label: '6 m' }, { id: 365, label: '12 m' }, { id: 'custom', label: 'Rango' }]} />
      </PageHead>

      <div className="filters">
        {range === 'custom' && (
          <>
            <input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" />
            <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" />
          </>
        )}
        <select className="select" value={seller} onChange={(e) => setSeller(e.target.value)} aria-label="Vendedor">
          <option value="">Todos los vendedores</option>
          {(emps.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="select" value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Sucursal">
          <option value="">Todas las sucursales</option>
          {branches.map((b) => <option key={b}>{b}</option>)}
        </select>
        {(seller || category || branch) && <button className="btn ghost sm" onClick={() => { setSeller(''); setCategory(''); setBranch('') }}>Limpiar filtros</button>}
      </div>

      <Tabs value={tab} onChange={setTab} tabs={tabs} />

      {scoped && error && <ErrorBox message={error} retry={reload} />}
      {scoped && loading && !data && <PageSkeleton />}
      {scoped && data && data.kpis.transactions === 0 && <Card><Empty icon="chart" title="Sin ventas para estos filtros" text="Amplíe el periodo o quite algún filtro." /></Card>}

      {scoped && data && data.kpis.transactions > 0 && (
        <div className="stack" style={{ opacity: loading ? 0.6 : 1 }}>
          {tab === 'resumen' && (
            <>
              <div className="grid g-kpi">
                <Kpi label="Ingresos" icon="tag" value={moneyCompact(data.kpis.revenue)} delta={data.growth.revenue} foot="vs. periodo previo" color="var(--c1)" />
                <Kpi label="Transacciones" icon="cart" value={int(data.kpis.transactions)} delta={data.growth.transactions} color="var(--c2)" />
                <Kpi label="Media del ticket" icon="sigma" value={money(data.kpis.avg_ticket)} delta={data.growth.avg_ticket} color="var(--c3)" />
                <Kpi label="Mediana del ticket" icon="layers" value={money(data.kpis.median_ticket)} delta={data.growth.median_ticket} color="var(--c4)" />
                <Kpi label="Clientes" icon="users" value={int(data.kpis.customers)} delta={data.growth.customers} color="var(--c5)" />
              </div>
              <Card title="Ingresos diarios"><TrendChart data={data.by_day} x="date" series={[{ key: 'revenue', name: 'Ingresos' }]} fmt={moneyCompact} xFmt={dayLabel} /></Card>
              <div className="grid g-2">
                <Card title="Distribución del monto de venta" sub="Histograma con media y mediana">
                  <Histogram bins={data.histogram} mean={data.compare?.mean} median={data.compare?.median} unit="S/" />
                </Card>
                <Card title="Ingresos por categoría"><Donut data={data.by_category.map((c) => ({ name: c.name, value: c.revenue }))} fmt={money} /></Card>
              </div>
            </>
          )}

          {tab === 'ventas' && data.stats && data.compare && (
            <>
              <div className="grid g-2">
                <Card title="Media vs. mediana" sub="Variable: monto de venta">
                  <div className="grid g-2" style={{ marginBottom: 14 }}>
                    <div><div className="muted small">Media aritmética</div><div className="result-big" style={{ color: 'var(--c3)' }}>{money(data.compare.mean)}</div></div>
                    <div><div className="muted small">Mediana</div><div className="result-big" style={{ color: 'var(--c4)' }}>{money(data.compare.median)}</div></div>
                  </div>
                  <div className="row" style={{ marginBottom: 10 }}>
                    <Badge tone={data.compare.shape === 'simétrica' ? 'ok' : 'warn'}>Distribución {data.compare.shape}</Badge>
                    <span className="small muted">Brecha {pct(data.compare.relative_gap_pct)}</span>
                  </div>
                  <p>{data.compare.interpretation}</p>
                  <div className="formula" style={{ marginTop: 14 }}>media = (x₁ + x₂ + … + xₙ) / n<br />mediana = valor central de los n datos ordenados</div>
                </Card>
                <Card title="Histograma" sub={`n = ${int(data.stats.n)} ventas`}>
                  <Histogram bins={data.histogram} mean={data.compare.mean} median={data.compare.median} unit="S/" />
                </Card>
              </div>
              <Card title="Estadísticos descriptivos">
                <div className="stat-grid">
                  <Stat label="n" value={int(data.stats.n)} /><Stat label="Media" value={money(data.stats.mean)} /><Stat label="Mediana" value={money(data.stats.median)} />
                  <Stat label="Mínimo" value={money(data.stats.min)} /><Stat label="Máximo" value={money(data.stats.max)} />
                  <Stat label="Q1" value={money(data.stats.q1)} /><Stat label="Q3" value={money(data.stats.q3)} />
                  <Stat label="Desv. estándar" value={money(data.stats.std)} /><Stat label="Coef. variación" value={pct((data.stats.cv ?? 0) * 100)} />
                  <Stat label="Asimetría" value={dec(data.stats.skewness)} />
                </div>
              </Card>
              <div className="grid g-2">
                <Card title="Ticket por mes" sub="Media frente a mediana"><TrendChart height="sm" data={data.by_month} x="month" series={[{ key: 'avg', name: 'Media', color: 'var(--c3)' }, { key: 'median', name: 'Mediana', color: 'var(--c4)' }]} fmt={money} xFmt={monthLabel} /></Card>
                <Card title="Ingresos por día de la semana"><ColumnChart height="sm" data={data.by_weekday} x="day" y="revenue" name="Ingresos" fmt={moneyCompact} /></Card>
              </div>
            </>
          )}

          {tab === 'productos' && (
            <div className="grid g-21">
              <Card title="Ranking de productos" pad={false}>
                <div className="table-wrap"><table className="t">
                  <thead><tr><th>Producto</th><th className="r">Unidades</th><th className="r">Ingresos</th><th style={{ width: 160 }}>Participación</th></tr></thead>
                  <tbody>{data.top_products.map((p) => (
                    <tr key={p.product_id}><td><div className="cell-main">{p.name}</div><div className="cell-sub mono">{p.sku}</div></td><td className="r">{int(p.units)}</td><td className="r">{money(p.revenue)}</td>
                      <td><div className="bar-row" style={{ gridTemplateColumns: '1fr auto', padding: 0 }}><div className="track"><div className="fill" style={{ width: `${Math.min(p.share * 3, 100)}%` }} /></div><span className="small num">{p.share}%</span></div></td></tr>
                  ))}</tbody></table></div>
              </Card>
              <Card title="Por categoría"><Donut data={data.by_category.map((c) => ({ name: c.name, value: c.revenue }))} fmt={money} /></Card>
            </div>
          )}

          {tab === 'vendedores' && (
            <div className="grid g-21">
              <Card title="Desempeño por vendedor" pad={false}>
                <div className="table-wrap"><table className="t">
                  <thead><tr><th>Vendedor</th><th className="r">Ventas</th><th className="r">Ingresos</th><th className="r">Media</th><th className="r">Mediana</th></tr></thead>
                  <tbody>{data.by_seller.map((s) => <tr key={s.name}><td className="cell-main">{s.name}</td><td className="r">{int(s.count)}</td><td className="r">{money(s.revenue)}</td><td className="r">{money(s.avg)}</td><td className="r">{money(s.median)}</td></tr>)}</tbody></table></div>
              </Card>
              <Card title="Ingresos"><BarList fmt={moneyCompact} rows={data.by_seller.map((s) => ({ label: s.name, value: s.revenue }))} /></Card>
            </div>
          )}
        </div>
      )}

      {tab === 'clientes' && <Customers360 dates={dates} />}
      {tab === 'variables' && <Variables dates={dates} />}
      {tab === 'lab' && <Lab dates={dates} />}
    </div>
  )
}
