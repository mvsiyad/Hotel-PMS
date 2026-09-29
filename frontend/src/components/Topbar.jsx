import { Sun, Moon, Search, Hotel, ShieldCheck, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

export default function Topbar({ title, subtitle, actions }) {
  const { user, hotelId, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="topbar">
      {/* Left: Title & Property Indicator */}
      <div className="topbar-left">
        {title && (
          <div>
            <div className="topbar-title">{title}</div>
            {subtitle && <div className="topbar-subtitle">{subtitle}</div>}
          </div>
        )}
      </div>

      {/* Right: Global SaaS Controls */}
      <div className="topbar-actions">
        {/* Actions passed from individual pages */}
        {actions}

        {/* Global Search Pill */}
        <button
          type="button"
          className="topbar-search-btn"
          onClick={() => {
            // Optional quick search hint or modal
          }}
          title="Global Search"
        >
          <Search size={14} />
          <span>Quick Find...</span>
          <kbd className="topbar-kbd">⌘K</kbd>
        </button>

        {/* Property Selector Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            padding: '5px 10px',
            borderRadius: 'var(--radius-md)',
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
          title={`Active Property ID: ${hotelId || 1}`}
        >
          <Hotel size={13} style={{ color: 'var(--primary)' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            Grand Horizon
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            #{hotelId || 1}
          </span>
        </div>

        {/* PMS Live Pulse */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--success)',
            background: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            padding: '4px 9px',
            borderRadius: 'var(--radius-full)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--success)',
              boxShadow: '0 0 6px var(--success)',
            }}
          />
          Live
        </div>

        {/* Theme Switcher (Dark / Light) */}
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          style={{ width: 34, height: 34 }}
        >
          {theme === 'dark' ? (
            <Sun size={16} style={{ color: '#fbbf24' }} />
          ) : (
            <Moon size={16} style={{ color: '#6366f1' }} />
          )}
        </button>
      </div>
    </header>
  )
}
