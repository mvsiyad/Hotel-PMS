import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Sidebar from './components/Sidebar'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import FrontDesk from './pages/FrontDesk'
import Reservations from './pages/Reservations'
import Rooms from './pages/Rooms'
import Housekeeping from './pages/Housekeeping'
import Maintenance from './pages/Maintenance'
import RoomService from './pages/RoomService'
import Guests from './pages/Guests'
import Staff from './pages/Staff'
import Integrations from './pages/Integrations'
import AuditLogs from './pages/AuditLogs'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        {children}
      </div>
    </div>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route
        path="/*"
        element={
          <ProtectedLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/front-desk" element={<FrontDesk />} />
              <Route path="/reservations" element={<Reservations />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/housekeeping" element={<Housekeeping />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/room-service" element={<RoomService />} />
              <Route path="/guests" element={<Guests />} />
              <Route path="/staff" element={<Staff />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </ProtectedLayout>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#161D2C',
              color: '#E8EDF5',
              border: '1px solid #1E2A38',
              borderRadius: 10,
              fontSize: 13,
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}
