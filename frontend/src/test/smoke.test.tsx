/**
 * Prueba de humo: renderiza cada pantalla contra la API real (VITE_TEST_API, por defecto localhost:8000)
 * y verifica que carga datos sin errores. Requiere el backend en ejecución con datos semilla.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import App from '@/App'
import { AuthProvider } from '@/hooks/useAuth'
import { ToastProvider } from '@/hooks/useToast'

const API = (import.meta as any).env?.VITE_TEST_API ?? 'http://localhost:8000'

class RO { observe() {} unobserve() {} disconnect() {} }
beforeAll(async () => {
  ;(globalThis as any).ResizeObserver = RO
  window.matchMedia = window.matchMedia ?? (((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as any)
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => realFetch(String(url).startsWith('/') ? API + url : url, init))
})
afterEach(() => { cleanup(); localStorage.clear() })

async function login(email: string, password: string) {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
  localStorage.setItem('aurora.token', (await r.json()).access_token)
}
function mount(path: string) {
  window.history.pushState({}, '', path)
  return render(<ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider>)
}

describe('pantallas (admin)', () => {
  const routes: [string, RegExp][] = [
    ['/', /Resumen ejecutivo/],
    ['/ventas', /Pedidos, ventas y pagos/],
    ['/ventas/nueva', /Cliente → pedido/],
    ['/clientes', /Ficha, historial/],
    ['/productos', /Catálogo, categorías/],
    ['/inventario', /Existencias y trazabilidad/],
    ['/analytics', /Las ventas generan los datos/],
    ['/probabilidad', /Teorema de Bayes, eventos/],
    ['/insights', /Hallazgos explicables/],
    ['/reportes', /Reportes comerciales/],
    ['/admin', /Usuarios, roles y registro/],
  ]
  for (const [path, re] of routes) {
    it(`renderiza ${path}`, async () => {
      await login('admin@auroravi.com', 'Admin123!')
      mount(path)
      await waitFor(() => expect(screen.getByText(re)).toBeTruthy(), { timeout: 20000 })
      await new Promise((r) => setTimeout(r, 1200)) // deja resolver las cargas de datos
      expect(screen.queryByRole('alert')).toBeNull()
    })
  }

  it('el panel muestra KPIs con datos reales', async () => {
    await login('admin@auroravi.com', 'Admin123!')
    mount('/')
    await waitFor(() => expect(screen.getAllByText(/S\/ /).length).toBeGreaterThan(2), { timeout: 20000 })
  })

  it('analytics > ventas muestra media y mediana', async () => {
    await login('admin@auroravi.com', 'Admin123!')
    mount('/analytics')
    const tab = await screen.findByRole('tab', { name: 'Ventas' })
    tab.click()
    await waitFor(() => expect(screen.getByText(/Media vs\. mediana/)).toBeTruthy(), { timeout: 20000 })
  })
})

describe('roles', () => {
  it('almacén no ve Analytics en el menú', async () => {
    await login('almacen@auroravi.com', 'Almacen123!')
    mount('/productos')
    await screen.findByText(/Catálogo, categorías/, undefined, { timeout: 20000 })
    expect(screen.queryByRole('link', { name: /Analytics/ })).toBeNull()
  })
  it('vendedor es redirigido de una ruta restringida', async () => {
    await login('vendedor@auroravi.com', 'Vendedor123!')
    mount('/analytics')
    await screen.findByText(/Acceso restringido/, undefined, { timeout: 20000 })
  })
  it('sin sesión muestra el login', async () => {
    mount('/')
    await screen.findByText('Iniciar sesión')
  })
})
