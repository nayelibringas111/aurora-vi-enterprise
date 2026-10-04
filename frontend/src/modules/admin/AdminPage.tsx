import { useState, type FormEvent } from 'react'
import { Icon } from '@/components/Icon'
import { Badge, Card, Empty, ErrorBox, Field, Modal, PageHead, Skeleton, Tabs } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useGet } from '@/hooks/useData'
import { useToast } from '@/hooks/useToast'
import { api, ApiError } from '@/services/api'
import type { User } from '@/types'
import { dateTime, ROLE_LABEL } from '@/utils/format'

function UserForm({ initial, onClose, onSaved }: { initial?: User; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ email: initial?.email ?? '', full_name: initial?.full_name ?? '', role: initial?.role ?? 'vendedor', password: '', is_active: initial?.is_active ?? true })
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const l: Record<string, string> = {}
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) l.email = 'Correo inválido'
    if (f.full_name.trim().length < 2) l.full_name = 'Ingrese el nombre'
    if (!initial && f.password.length < 8) l.password = 'Mínimo 8 caracteres'
    if (initial && f.password && f.password.length < 8) l.password = 'Mínimo 8 caracteres'
    setErrs(l)
    if (Object.keys(l).length) return
    setBusy(true)
    try {
      const body = { ...f, password: f.password || null }
      if (initial) await api.put(`/users/${initial.id}`, body); else await api.post('/users', body)
      toast.ok(initial ? 'Usuario actualizado' : 'Usuario creado'); onSaved()
    } catch (err) { setErrs((err as ApiError).fields ?? {}); toast.err((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal title={initial ? 'Editar usuario' : 'Nuevo usuario'} onClose={onClose} footer={
      <><button className="btn" type="button" onClick={onClose}>Cancelar</button><button className="btn primary" form="user-form" disabled={busy}>{busy && <span className="spinner" />} Guardar</button></>
    }>
      <form id="user-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Nombre completo" error={errs.full_name} full><input className={`input ${errs.full_name ? 'invalid' : ''}`} value={f.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
        <Field label="Correo" error={errs.email}><input className={`input ${errs.email ? 'invalid' : ''}`} value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Rol"><select className="select" value={f.role} onChange={(e) => set('role', e.target.value)}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label={initial ? 'Nueva contraseña' : 'Contraseña'} error={errs.password} hint={initial ? 'Déjela vacía para conservar la actual' : 'Mínimo 8 caracteres'}><input className={`input ${errs.password ? 'invalid' : ''}`} type="password" autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} /></Field>
        <Field label="Estado"><select className="select" value={f.is_active ? '1' : '0'} onChange={(e) => set('is_active', e.target.value === '1')}><option value="1">Activo</option><option value="0">Inactivo</option></select></Field>
      </form>
    </Modal>
  )
}

function Users() {
  const { user: me } = useAuth()
  const { data, loading, error, reload } = useGet<User[]>('/users')
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  return (
    <>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Nuevo usuario</button>
      </div>
      {error && <ErrorBox message={error} retry={reload} />}
      <Card pad={false}>
        {loading && !data ? <div style={{ padding: 18 }}><Skeleton h={200} /></div> : (
          <div className="table-wrap"><table className="t"><thead><tr><th>Usuario</th><th>Rol</th><th>Último acceso</th><th>Estado</th><th /></tr></thead>
            <tbody>{(data ?? []).map((u) => (
              <tr key={u.id}><td><div className="cell-main">{u.full_name}{u.id === me?.id && <span className="muted small"> (usted)</span>}</div><div className="cell-sub">{u.email}</div></td>
                <td><Badge tone="info" plain>{ROLE_LABEL[u.role]}</Badge></td><td className="small">{u.last_login ? dateTime(u.last_login) : 'Nunca'}</td>
                <td><Badge tone={u.is_active ? 'ok' : 'bad'}>{u.is_active ? 'Activo' : 'Inactivo'}</Badge></td>
                <td className="r"><button className="icon-btn" onClick={() => setEditing(u)} aria-label={`Editar ${u.full_name}`}><Icon name="edit" size={16} /></button></td></tr>
            ))}</tbody></table></div>
        )}
      </Card>
      {editing && <UserForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </>
  )
}

function Audit() {
  const [action, setAction] = useState('')
  const { data, loading, error, reload } = useGet<any[]>('/audit', { action, limit: 150 })
  const tone = (a: string) => (a.includes('failed') ? 'bad' : a.startsWith('auth') ? 'info' : a.includes('cancel') ? 'warn' : '')
  return (
    <>
      <div className="filters">
        <select className="select" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filtrar por acción">
          <option value="">Todas las acciones</option><option value="auth">Autenticación</option><option value="sale">Ventas</option><option value="customer">Clientes</option>
          <option value="product">Productos</option><option value="inventory">Inventario</option><option value="analysis">Análisis</option><option value="report">Reportes</option><option value="user">Usuarios</option>
        </select>
        <button className="btn sm" onClick={reload}><Icon name="refresh" size={14} /> Actualizar</button>
      </div>
      {error && <ErrorBox message={error} retry={reload} />}
      <Card pad={false}>
        {loading && !data ? <div style={{ padding: 18 }}><Skeleton h={260} /></div> : (data ?? []).length === 0 ? <Empty title="Sin registros" /> : (
          <div className="table-wrap"><table className="t"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th><th>IP</th></tr></thead>
            <tbody>{data!.map((a) => (
              <tr key={a.id}><td className="small">{dateTime(a.created_at)}</td><td className="small">{a.user ?? '—'}</td><td><Badge tone={tone(a.action)} plain>{a.action}</Badge></td>
                <td className="small">{a.entity ? `${a.entity}${a.entity_id ? ` #${a.entity_id}` : ''}` : '—'}</td><td className="small mono" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detail ? JSON.stringify(a.detail) : ''}</td><td className="small mono">{a.ip ?? '—'}</td></tr>
            ))}</tbody></table></div>
        )}
      </Card>
    </>
  )
}

export default function AdminPage() {
  const [tab, setTab] = useState<'users' | 'audit'>('users')
  return (
    <div className="page">
      <PageHead title="Administración" subtitle="Usuarios, roles y registro de auditoría." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'users', label: 'Usuarios' }, { id: 'audit', label: 'Auditoría' }]} />
      {tab === 'users' ? <Users /> : <Audit />}
    </div>
  )
}
