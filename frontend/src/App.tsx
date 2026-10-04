import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PageSkeleton } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { AppLayout } from '@/layouts/AppLayout'
import { NAV } from '@/layouts/nav'
import LoginPage from '@/modules/auth/LoginPage'
import DashboardPage from '@/modules/dashboard/DashboardPage'

const CustomersPage = lazy(() => import('@/modules/customers/CustomersPage'))
const ProductsPage = lazy(() => import('@/modules/products/ProductsPage'))
const InventoryPage = lazy(() => import('@/modules/inventory/InventoryPage'))
const SalesPage = lazy(() => import('@/modules/sales/SalesPage'))
const NewSalePage = lazy(() => import('@/modules/sales/NewSalePage'))
const AnalyticsPage = lazy(() => import('@/modules/analytics/AnalyticsPage'))
const ProbabilityPage = lazy(() => import('@/modules/probability/ProbabilityPage'))
const InsightsPage = lazy(() => import('@/modules/insights/InsightsPage'))
const ReportsPage = lazy(() => import('@/modules/reports/ReportsPage'))
const AdminPage = lazy(() => import('@/modules/admin/AdminPage'))

function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAuth()
  if (!can(perm)) {
    return (
      <div className="page"><div className="card card-pad" style={{ maxWidth: 480 }}>
        <h3>Acceso restringido</h3>
        <p className="muted" style={{ marginTop: 6 }}>Su rol no tiene permiso para ver esta sección.</p>
      </div></div>
    )
  }
  return <>{children}</>
}

function Home() {
  const { can } = useAuth()
  if (can('dashboard:read')) return <DashboardPage />
  const first = NAV.flatMap((g) => g.items).find((i) => can(i.perm))
  return first ? <Navigate to={first.to} replace /> : <Guard perm="none"><span /></Guard>
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: 40 }}><PageSkeleton /></div>
  if (!user) return <LoginPage />
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<div className="page"><PageSkeleton /></div>}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route path="ventas" element={<Guard perm="sales:read"><SalesPage /></Guard>} />
            <Route path="ventas/nueva" element={<Guard perm="sales:write"><NewSalePage /></Guard>} />
            <Route path="clientes" element={<Guard perm="customers:read"><CustomersPage /></Guard>} />
            <Route path="productos" element={<Guard perm="products:read"><ProductsPage /></Guard>} />
            <Route path="inventario" element={<Guard perm="inventory:read"><InventoryPage /></Guard>} />
            <Route path="analytics" element={<Guard perm="analytics:read"><AnalyticsPage /></Guard>} />
            <Route path="probabilidad" element={<Guard perm="probability:read"><ProbabilityPage /></Guard>} />
            <Route path="insights" element={<Guard perm="insights:read"><InsightsPage /></Guard>} />
            <Route path="reportes" element={<Guard perm="reports:read"><ReportsPage /></Guard>} />
            <Route path="admin" element={<Guard perm="users:read"><AdminPage /></Guard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
