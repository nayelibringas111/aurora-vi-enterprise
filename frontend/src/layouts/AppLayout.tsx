import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BrandMark, Icon } from '@/components/Icon'
import { CommandPalette } from '@/components/CommandPalette'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { initials, ROLE_LABEL } from '@/utils/format'
import { NAV } from './nav'

export function AppLayout() {
  const { user, logout, can } = useAuth()
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const [cmd, setCmd] = useState(false)
  const loc = useLocation()

  useEffect(() => { setOpen(false) }, [loc.pathname])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((v) => !v) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const toggleTheme = useCallback(toggle, [toggle])
  const current = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title }))).find((i) => (i.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(i.to)))

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Navegación principal">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">Aurora VI</div>
            <div className="brand-sub">Enterprise</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((g) => {
            const items = g.items.filter((i) => can(i.perm))
            if (!items.length) return null
            return (
              <div className="nav-group" key={g.title}>
                <div className="nav-title">{g.title}</div>
                {items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                    <Icon name={i.icon} /> {i.label}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="user-card">
          <div className="avatar">{initials(user?.full_name ?? '')}</div>
          <div className="who">
            <b>{user?.full_name}</b>
            <span>{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</span>
          </div>
          <button className="icon-btn" style={{ color: '#9db2d1' }} onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Abrir menú"><Icon name="menu" size={20} /></button>
          <div>
            <div className="crumb">{current?.group ?? 'Aurora VI'}</div>
            <strong style={{ fontSize: 14 }}>{current?.label ?? 'Detalle'}</strong>
          </div>
          <div className="spacer" />
          <button className="search-btn" onClick={() => setCmd(true)} aria-label="Abrir buscador de comandos">
            <Icon name="search" size={16} /> <span className="txt">Buscar o ir a…</span> <span className="kbd">Ctrl K</span>
          </button>
          <button className="icon-btn" onClick={toggle} aria-label="Cambiar tema" title="Cambiar tema">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
          </button>
        </header>
        <main id="contenido">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={cmd} onClose={() => setCmd(false)} toggleTheme={toggleTheme} />
    </div>
  )
}
