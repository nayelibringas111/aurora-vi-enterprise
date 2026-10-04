import { useEffect, useRef, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { dec } from '@/utils/format'

export function PageHead({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  )
}

export function Card({ title, sub, right, children, pad = true, className = '' }: {
  title?: string; sub?: string; right?: ReactNode; children: ReactNode; pad?: boolean; className?: string
}) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <div className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {sub && <div className="sub">{sub}</div>}
          </div>
          {right && <div className="right-slot">{right}</div>}
        </div>
      )}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  )
}

export function Delta({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="delta flat">sin base</span>
  const tone = value > 0.05 ? 'up' : value < -0.05 ? 'down' : 'flat'
  return (
    <span className={`delta ${tone}`}>
      {tone !== 'flat' && <Icon name={tone === 'up' ? 'up' : 'down'} size={12} strokeWidth={2.4} />}
      {dec(Math.abs(value), 1)}%
    </span>
  )
}

export function Kpi({ label, value, icon, delta, foot, color }: {
  label: string; value: string; icon?: IconName; delta?: number | null; foot?: string; color?: string
}) {
  return (
    <div className="card kpi" style={color ? ({ ['--kc' as string]: color } as React.CSSProperties) : undefined}>
      <div className="label">{icon && <Icon name={icon} size={15} />}{label}</div>
      <div className="value">{value}</div>
      <div className="foot">
        {delta !== undefined && <Delta value={delta} />}
        {foot && <span>{foot}</span>}
      </div>
    </div>
  )
}

export function Badge({ tone = '', children, plain }: { tone?: string; children: ReactNode; plain?: boolean }) {
  return <span className={`badge ${tone} ${plain ? 'plain' : ''}`}>{children}</span>
}

export function Empty({ icon = 'info', title, text, action }: { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ico-wrap"><Icon name={icon} size={22} /></div>
      <b>{title}</b>
      {text && <p style={{ maxWidth: 360 }}>{text}</p>}
      {action}
    </div>
  )
}

export function Skeleton({ h = 16, w = '100%', style }: { h?: number; w?: number | string; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />
}

export function PageSkeleton() {
  return (
    <div className="stack" aria-busy="true" aria-label="Cargando">
      <div className="grid g-kpi">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={96} />)}</div>
      <Skeleton h={300} />
      <div className="grid g-2"><Skeleton h={240} /><Skeleton h={240} /></div>
    </div>
  )
}

export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="alert err" role="alert">
      <Icon name="alert" size={18} />
      <div style={{ flex: 1 }}>{message}</div>
      {retry && <button className="btn sm" onClick={retry}>Reintentar</button>}
    </div>
  )
}

export function Field({ label, error, hint, children, full }: {
  label: string; error?: string; hint?: string; children: ReactNode; full?: boolean
}) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label>{label}</label>
      {children}
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string | number>({ options, value, onChange }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button key={String(o.id)} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  )
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = prev }
  }, [onClose])
}

export function Modal({ title, onClose, children, footer, wide }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  useEscape(onClose)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.querySelector<HTMLElement>('input,select,textarea')?.focus() }, [])
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Drawer({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEscape(onClose)
  return (
    <div className="drawer-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
        </div>
        <div className="modal-body" style={{ flex: 1 }}>{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </aside>
    </div>
  )
}

export function Confirm({ title, text, confirmLabel = 'Confirmar', danger, busy, onConfirm, onClose }: {
  title: string; text: string; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void
}) {
  return (
    <Modal title={title} onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm} disabled={busy}>{busy && <span className="spinner" />}{confirmLabel}</button>
      </>
    }>
      <p>{text}</p>
    </Modal>
  )
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return <div className="stat"><span>{label}</span><b>{value}</b></div>
}
