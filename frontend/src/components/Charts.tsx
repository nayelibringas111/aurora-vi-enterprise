import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { HistBin } from '@/types'
import { dec, int } from '@/utils/format'

export const PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)']

interface TipProps {
  active?: boolean
  payload?: { name: string; value: number; color?: string; payload?: any }[]
  label?: string | number
  fmt?: (v: number, name?: string) => string
  labelFmt?: (l: any) => string
}

function Tip({ active, payload, label, fmt, labelFmt }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="tip">
      <b>{labelFmt ? labelFmt(label) : label}</b>
      {payload.map((p, i) => (
        <div className="l" key={i}>
          <span><i style={{ background: p.color }} />{p.name}</span>
          <span className="num mono">{fmt ? fmt(p.value, p.name) : int(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

const axis = { tickLine: false, axisLine: false } as const

export function TrendChart({ data, x, series, fmt, xFmt, height }: {
  data: Record<string, any>[]
  x: string
  series: { key: string; name: string; color?: string }[]
  fmt?: (v: number) => string
  xFmt?: (v: any) => string
  height?: 'sm' | 'lg'
}) {
  return (
    <div className={`chart-box ${height ?? ''}`}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color ?? PALETTE[i]} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color ?? PALETTE[i]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 4" />
          <XAxis dataKey={x} {...axis} tickFormatter={xFmt} minTickGap={28} tickMargin={8} />
          <YAxis {...axis} width={58} tickFormatter={(v) => (fmt ? fmt(v) : int(v))} />
          <Tooltip content={<Tip fmt={fmt} labelFmt={xFmt} />} cursor={{ stroke: 'var(--line-strong)' }} />
          {series.map((s, i) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color ?? PALETTE[i]} strokeWidth={2}
              fill={`url(#g-${s.key})`} dot={false} activeDot={{ r: 4 }} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ColumnChart({ data, x, y, name, fmt, xFmt, height, color }: {
  data: Record<string, any>[]; x: string; y: string; name: string; fmt?: (v: number) => string
  xFmt?: (v: any) => string; height?: 'sm' | 'lg'; color?: string
}) {
  return (
    <div className={`chart-box ${height ?? ''}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 4" />
          <XAxis dataKey={x} {...axis} tickFormatter={xFmt} tickMargin={8} />
          <YAxis {...axis} width={58} tickFormatter={(v) => (fmt ? fmt(v) : int(v))} />
          <Tooltip content={<Tip fmt={fmt} labelFmt={xFmt} />} cursor={{ fill: 'var(--surface-2)' }} />
          <Bar dataKey={y} name={name} fill={color ?? 'var(--c1)'} radius={[5, 5, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Donut({ data, fmt }: { data: { name: string; value: number }[]; fmt?: (v: number) => string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,170px) 1fr', gap: 18, alignItems: 'center' }}>
      <div style={{ height: 170 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip content={<Tip fmt={fmt} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'grid', gap: 9 }}>
        {data.map((d, i) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13 }}>
            <i style={{ width: 9, height: 9, borderRadius: 2, background: PALETTE[i % PALETTE.length], flex: 'none' }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
            <span className="num muted">{dec((d.value / total) * 100, 1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BarList({ rows, fmt }: { rows: { label: string; value: number; sub?: string }[]; fmt: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <div>
      {rows.map((r, i) => (
        <div className="bar-row" key={r.label + i}>
          <div style={{ minWidth: 0 }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{r.label}</div>
            {r.sub && <div className="cell-sub">{r.sub}</div>}
          </div>
          <div className="track"><div className="fill" style={{ width: `${(r.value / max) * 100}%`, background: PALETTE[0] }} /></div>
          <div className="num" style={{ fontWeight: 600, minWidth: 82, textAlign: 'right' }}>{fmt(r.value)}</div>
        </div>
      ))}
    </div>
  )
}

const binLabel = (b: HistBin) => `${int(b.start)}–${int(b.end)}`

/** Histograma con marcadores de media y mediana (comparación de la Semana 07). */
export function Histogram({ bins, mean, median, unit = '' }: { bins: HistBin[]; mean?: number; median?: number; unit?: string }) {
  const data = bins.map((b) => ({ ...b, label: binLabel(b) }))
  const find = (v?: number) => (v == null ? undefined : data.find((b, i) => v >= b.start && (v < b.end || i === data.length - 1))?.label)
  const mL = find(mean)
  const mdL = find(median)
  return (
    <div>
      <div className="chart-box">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 14, right: 8, left: -8, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} strokeDasharray="3 4" />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" tickMargin={8} minTickGap={22} />
            <YAxis {...axis} width={44} />
            <Tooltip content={<Tip fmt={(v) => `${int(v)} ventas`} labelFmt={(l) => `${l} ${unit}`} />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="count" name="Frecuencia" fill="var(--c1)" radius={[4, 4, 0, 0]} />
            {mL && <ReferenceLine x={mL} stroke="var(--c3)" strokeWidth={2} strokeDasharray="5 3" label={{ value: 'Media', position: 'top', fill: 'var(--c3)', fontSize: 11 }} />}
            {mdL && <ReferenceLine x={mdL} stroke="var(--c4)" strokeWidth={2} label={{ value: 'Mediana', position: 'insideTopRight', fill: 'var(--c4)', fontSize: 11 }} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="legend" style={{ marginTop: 8 }}>
        <span><i style={{ background: 'var(--c1)' }} />Frecuencia</span>
        <span><i style={{ background: 'var(--c3)' }} />Media</span>
        <span><i style={{ background: 'var(--c4)' }} />Mediana</span>
      </div>
    </div>
  )
}

export function PmfChart({ rows }: { rows: { x: number; p: number; cdf?: number }[] }) {
  return (
    <div className="chart-box sm">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 4" />
          <XAxis dataKey="x" {...axis} tickMargin={8} />
          <YAxis {...axis} width={48} tickFormatter={(v) => `${dec(v * 100, 0)}%`} domain={[0, 1]} />
          <Tooltip content={<Tip fmt={(v) => `${dec(v * 100, 2)}%`} labelFmt={(l) => `X = ${l}`} />} />
          <Bar dataKey="p" name="P(X = x)" fill="var(--c2)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Line type="stepAfter" dataKey="cdf" name="F(x) acumulada" stroke="var(--c3)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
