import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ConciergeBell,
  CalendarCheck,
  BedDouble,
  Sparkles,
  Wrench,
  UtensilsCrossed,
  Users,
  ShieldCheck,
  Webhook,
  ScrollText,
  BarChart3,
  Sliders,
  LogOut,
  Hotel
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, section: 'Operations' },
  { path: '/front-desk', label: 'Front Desk', icon: ConciergeBell, section: 'Operations' },
  { path: '/reservations', label: 'Reservations', icon: CalendarCheck, section: 'Operations' },
  { path: '/rooms', label: 'Rooms', icon: BedDouble, section: 'Operations' },
  { path: '/housekeeping', label: 'Housekeeping', icon: Sparkles, section: 'Operations' },
  { path: '/maintenance', label: 'Maintenance', icon: Wrench, section: 'Services' },
  { path: '/room-service', label: 'Room Service', icon: UtensilsCrossed, section: 'Services' },
  { path: '/guests', label: 'Guests', icon: Users, section: 'Services' },
  { path: '/staff', label: 'Staff', icon: ShieldCheck, section: 'Admin', requirePerm: 'manage_staff' },
  { path: '/integrations', label: 'Integrations', icon: Webhook, section: 'Admin', requirePerm: 'manage_integrations' },
  { path: '/audit-logs', label: 'Audit Logs', icon: ScrollText, section: 'Admin', requirePerm: 'view_audit_logs' },
  { path: '/reports', label: 'Reports', icon: BarChart3, section: 'Admin' },
  { path: '/settings', label: 'Settings', icon: Sliders, section: 'Admin' },
]

export default function Sidebar() {
  const { user, logout, hasPermission } = useAuth()
  const navigate = useNavigate()

  const sections = [...new Set(NAV_ITEMS.map((i) => i.section))]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user
    ? user.role === 'PMS_ADMIN'
      ? 'PA'
      : `${user.first_name?.[0] || 'U'}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'U'

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Hotel size={18} />
        </div>
        <div className="sidebar-logo-text">
          <div className="sidebar-logo-title">Hotel PMS</div>
          <div className="sidebar-logo-subtitle">
            <span>Enterprise Suite</span>
            <span className="sidebar-logo-badge">v2.0</span>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="sidebar-nav">
        {sections.map((section) => {
          const items = NAV_ITEMS.filter(
            (i) => i.section === section && (!i.requirePerm || hasPermission(i.requirePerm))
          )
          if (items.length === 0) return null
          return (
            <div className="sidebar-section" key={section}>
              <div className="sidebar-section-label">{section}</div>
              {items.map((item) => {
                const IconComponent = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      `sidebar-link${isActive ? ' active' : ''}`
                    }
                  >
                    <span className="sidebar-icon">
                      <IconComponent size={16} strokeWidth={2} />
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">
              {user?.role === 'PMS_ADMIN'
                ? 'PMS Admin'
                : `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'User'}
            </div>
            <div className="sidebar-user-role">
              {user?.role?.replace('_', ' ') || 'Staff Member'}
            </div>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            onClick={handleLogout}
            style={{ width: 30, height: 30, color: 'var(--text-muted)' }}
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
