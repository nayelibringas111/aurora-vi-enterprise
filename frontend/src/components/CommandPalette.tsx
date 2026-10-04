import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { NAV } from '@/layouts/nav'
import { useAuth } from '@/hooks/useAuth'

interface Cmd { id: string; label: string; group: string; icon: IconName; run: () => void; keywords?: string }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function CommandPalette({ open, onClose, toggleTheme }: { open: boolean; onClose: () => void; toggleTheme: () => void }) {
  const { can, logout } = useAuth()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const cmds = useMemo<Cmd[]>(() => {
    const list: Cmd[] = []
    NAV.forEach((g) =>
      g.items.filter((i) => can(i.perm)).forEach((i) =>
        list.push({ id: i.to, label: `Ir a ${i.label}`, group: g.title, icon: i.icon, keywords: i.keywords, run: () => nav(i.to) })),
    )
    if (can('sales:write')) list.unshift({ id: 'new-sale', label: 'Registrar nueva venta', group: 'Acciones', icon: 'plus', keywords: 'crear pedido', run: () => nav('/ventas/nueva') })
    if (can('customers:write')) list.push({ id: 'new-cust', label: 'Crear cliente', group: 'Acciones', icon: 'user', run: () => nav('/clientes?nuevo=1') })
    list.push({ id: 'theme', label: 'Cambiar tema claro / oscuro', group: 'Preferencias', icon: 'moon', keywords: 'modo oscuro', run: toggleTheme })
    list.push({ id: 'logout', label: 'Cerrar sesión', group: 'Preferencias', icon: 'logout', run: logout })
    return list
  }, [can, nav, toggleTheme, logout])

  const results = useMemo(() => {
    const t = norm(q.trim())
    if (!t) return cmds
    return cmds.filter((c) => norm(`${c.label} ${c.keywords ?? ''} ${c.group}`).includes(t))
  }, [cmds, q])

  useEffect(() => { setSel(0) }, [q, open])
  useEffect(() => {
    if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 10) }
  }, [open])

  if (!open) return null
  const run = (c?: Cmd) => { if (c) { onClose(); c.run() } }

  return (
    <div className="overlay" style={{ alignItems: 'start' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
        <input
          ref={inputRef} value={q} placeholder="Buscar páginas y acciones…" aria-label="Buscar"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
            else if (e.key === 'Enter') run(results[sel])
            else if (e.key === 'Escape') onClose()
          }}
        />
        <ul role="listbox">
          {results.length === 0 && <li style={{ cursor: 'default' }} className="muted">Sin resultados para «{q}»</li>}
          {results.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === sel} className={i === sel ? 'sel' : ''} onMouseEnter={() => setSel(i)} onClick={() => run(c)}>
              <Icon name={c.icon} /> <span>{c.label}</span> <span className="grp">{c.group}</span>
            </li>
          ))}
        </ul>
        <div className="foot"><span>↑↓ navegar</span><span>↵ abrir</span><span>esc cerrar</span></div>
      </div>
    </div>
  )
}
