import { useState, type FormEvent } from 'react'
import { BrandMark, Icon } from '@/components/Icon'
import { Field } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'

const DEMOS = [
  { email: 'admin@auroravi.com', pwd: 'Admin123!', label: 'Administrador' },
  { email: 'gerente@auroravi.com', pwd: 'Gerente123!', label: 'Gerente' },
  { email: 'analista@auroravi.com', pwd: 'Analista123!', label: 'Analista' },
  { email: 'vendedor@auroravi.com', pwd: 'Vendedor123!', label: 'Vendedor' },
  { email: 'almacen@auroravi.com', pwd: 'Almacen123!', label: 'Almacén' },
]
const SHOW_DEMO = (import.meta.env.VITE_SHOW_DEMO as string | undefined) !== 'false'

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [show, setShow] = useState(false)

  const submit = async (e?: FormEvent, creds?: { email: string; pwd: string }) => {
    e?.preventDefault()
    const em = creds?.email ?? email
    const pw = creds?.pwd ?? pwd
    setBusy(true)
    setError(null)
    try {
      await login(em.trim(), pw)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-art">
        <div className="brand">
          <BrandMark size={36} />
          <div>
            <div className="brand-name" style={{ fontSize: 18 }}>Aurora VI</div>
            <div className="brand-sub">Enterprise</div>
          </div>
        </div>
        <svg className="deco" viewBox="0 0 520 380" fill="none" aria-hidden="true">
          <g stroke="#2a4a7b" strokeWidth="1">
            {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1="0" x2="520" y1={60 + i * 56} y2={60 + i * 56} strokeDasharray="3 6" />)}
          </g>
          <path d="M20 300 C 90 280, 120 210, 180 220 S 270 300, 330 190 S 430 90, 500 60" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
          <path d="M20 300 C 90 280, 120 210, 180 220 S 270 300, 330 190 S 430 90, 500 60 V 360 H 20 Z" fill="url(#lg)" opacity="0.5" />
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#22d3ee" stopOpacity="0.35" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[[180, 220], [330, 190], [500, 60]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="5" fill="#0a1d38" stroke="#22d3ee" strokeWidth="2.5" />)}
        </svg>
        <h2>Cada venta deja un dato. Cada dato, una decisión.</h2>
        <p className="lead">
          Gestione clientes, inventario y ventas, y obtenga media, mediana, probabilidad y conclusiones explicables sobre su
          operación comercial en un solo lugar.
        </p>
        <div className="facts">
          <div><b>Media · Mediana</b><span>sobre ventas reales</span></div>
          <div><b>Bayes</b><span>resultados reproducibles</span></div>
          <div><b>Auditoría</b><span>trazabilidad completa</span></div>
        </div>
      </div>

      <div className="login-form">
        <form className="login-card" onSubmit={(e) => submit(e)} noValidate>
          <h1>Iniciar sesión</h1>
          <p className="sub">Ingrese con su cuenta corporativa.</p>
          <div className="stack">
            <Field label="Correo electrónico">
              <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" autoFocus required />
            </Field>
            <Field label="Contraseña">
              <div className="input-icon" style={{ position: 'relative' }}>
                <input className="input" style={{ paddingLeft: 11, paddingRight: 64 }} type={show ? 'text' : 'password'} autoComplete="current-password" value={pwd} onChange={(e) => setPwd(e.target.value)} required />
                <button type="button" className="btn ghost sm" style={{ position: 'absolute', right: 3, top: 3 }} onClick={() => setShow((s) => !s)}>
                  {show ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </Field>
            {error && <div className="alert err" role="alert"><Icon name="alert" /> {error}</div>}
            <button className="btn primary" style={{ height: 42 }} disabled={busy || !email || !pwd}>
              {busy ? <><span className="spinner" /> Ingresando…</> : 'Ingresar'}
            </button>
            {busy && <p className="small muted" style={{ textAlign: 'center' }}>Si el servidor estaba inactivo, puede tardar hasta un minuto en despertar.</p>}
          </div>

          {SHOW_DEMO && (
            <div className="demo-list">
              <span className="small muted">Accesos de demostración (clic para ingresar)</span>
              {DEMOS.map((d) => (
                <button key={d.email} type="button" disabled={busy} onClick={() => { setEmail(d.email); setPwd(d.pwd); void submit(undefined, d) }}>
                  <span><b style={{ fontWeight: 600 }}>{d.label}</b> <span className="muted small mono">· {d.email}</span></span>
                  <Icon name="arrow" size={15} />
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
