import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ICONS } from './UI'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: ICONS.dashboard, section: 'Operations' },
  { path: '/front-desk', label: 'Front Desk', icon: ICONS.frontdesk, section: 'Operations' },
  { path: '/reservations', label: 'Reservations', icon: ICONS.reservations, section: 'Operations' },
  { path: '/rooms', label: 'Rooms', icon: ICONS.rooms, section: 'Operations' },
  { path: '/housekeeping', label: 'Housekeeping', icon: ICONS.housekeeping, section: 'Operations' },
  { path: '/maintenance', label: 'Maintenance', icon: ICONS.maintenance, section: 'Services' },
  { path: '/room-service', label: 'Room Service', icon: ICONS.roomservice, section: 'Services' },
  { path: '/guests', label: 'Guests', icon: ICONS.guests, section: 'Services' },
  { path: '/staff', label: 'Staff', icon: ICONS.staff, section: 'Admin', requirePerm: 'manage_staff' },
  { path: '/integrations', label: 'Integrations', icon: ICONS.integrations, section: 'Admin', requirePerm: 'manage_integrations' },
  { path: '/audit-logs', label: 'Audit Logs', icon: ICONS.audit, section: 'Admin', requirePerm: 'view_audit_logs' },
  { path: '/reports', label: 'Reports', icon: '📊', section: 'Admin' },
  { path: '/settings', label: 'Settings', icon: '⚙️', section: 'Admin' },
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
    ? `${user.role === 'PMS_ADMIN' ? '★' : (user.first_name?.[0] || 'U')}`.toUpperCase()
    : 'U'

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🏨</div>
        <div className="sidebar-logo-text">
          <div className="sidebar-logo-title">Hotel PMS</div>
          <div className="sidebar-logo-subtitle">Property Management</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {sections.map((section) => {
          const items = NAV_ITEMS.filter(
            (i) => i.section === section && (!i.requirePerm || hasPermission(i.requirePerm))
          )
          if (items.length === 0) return null
          return (
            <div className="sidebar-section" key={section}>
              <div className="sidebar-section-label">{section}</div>
              {items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `sidebar-link${isActive ? ' active' : ''}`
                  }
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">
              {user?.role === 'PMS_ADMIN' ? 'PMS Admin' : `${user?.first_name || ''} ${user?.last_name || ''}`}
            </div>
            <div className="sidebar-user-role">{user?.role?.replace('_', ' ')}</div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            style={{ marginLeft: 'auto', fontSize: 16 }}
            title="Logout"
          >
            →
          </button>
        </div>
      </div>
    </aside>
  )
}
