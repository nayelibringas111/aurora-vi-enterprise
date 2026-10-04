const BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '')
const TOKEN_KEY = 'aurora.token'

export class ApiError extends Error {
  status: number
  fields: Record<string, string>
  constructor(message: string, status: number, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
  },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t) } catch { /* modo privado */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY) } catch { /* noop */ } },
}

type Query = Record<string, string | number | boolean | null | undefined>

function qs(q?: Query): string {
  if (!q) return ''
  const p = new URLSearchParams()
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

async function raw(path: string, init: RequestInit = {}, q?: Query): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = tokenStore.get()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 60_000) // el plan gratuito de Render puede tardar en despertar
  let res: Response
  try {
    res = await fetch(`${BASE}/api${path}${qs(q)}`, { ...init, headers, signal: ctrl.signal })
  } catch (e) {
    throw new ApiError(
      (e as Error).name === 'AbortError'
        ? 'El servidor tardó demasiado en responder. Inténtelo nuevamente.'
        : 'No se pudo conectar con el servidor.',
      0,
    )
  } finally {
    clearTimeout(timer)
  }
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    tokenStore.clear()
    window.dispatchEvent(new Event('aurora:unauthorized'))
  }
  if (!res.ok) {
    let msg = `Error ${res.status}`
    const fields: Record<string, string> = {}
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') msg = body.detail
      if (Array.isArray(body.errors)) {
        body.errors.forEach((e: { field: string; message: string }) => { fields[e.field] = e.message })
        const first = body.errors[0]
        if (first) msg = `${first.field ? first.field + ': ' : ''}${first.message}`
      }
    } catch { /* cuerpo no JSON */ }
    throw new ApiError(msg, res.status, fields)
  }
  return res
}

async function json<T>(path: string, init: RequestInit = {}, q?: Query): Promise<T> {
  const res = await raw(path, init, q)
  return (await res.json()) as T
}

export const api = {
  get: <T = any>(path: string, q?: Query) => json<T>(path, { method: 'GET' }, q),
  post: <T = any>(path: string, body?: unknown, q?: Query) =>
    json<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }, q),
  put: <T = any>(path: string, body?: unknown) => json<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  /** Descarga un archivo (CSV) respetando la autenticación. */
  async download(path: string, q: Query, fallbackName: string) {
    const res = await raw(path, { method: 'GET' }, q)
    const blob = await res.blob()
    const cd = res.headers.get('Content-Disposition') ?? ''
    const name = /filename="?([^"]+)"?/.exec(cd)?.[1] ?? fallbackName
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
  /** Despierta el backend (cold start en Render) sin bloquear la UI. */
  warmup() {
    fetch(`${BASE}/health`, { method: 'GET' }).catch(() => undefined)
  },
}
