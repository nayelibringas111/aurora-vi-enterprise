import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Icon } from '@/components/Icon'

interface T { id: number; msg: string; kind: 'ok' | 'err' }
const Ctx = createContext<{ ok: (m: string) => void; err: (m: string) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([])
  const push = useCallback((kind: T['kind'], msg: string) => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s, { id, msg, kind }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === 'err' ? 6000 : 3600)
  }, [])
  const value = useMemo(() => ({ ok: (m: string) => push('ok', m), err: (m: string) => push('err', m) }), [push])
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <Icon name={t.kind === 'ok' ? 'check' : 'alert'} size={18} />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast requiere ToastProvider')
  return v
}
