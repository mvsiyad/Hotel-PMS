import { useState } from 'react'
import {
  X,
  Copy,
  Check,
  Inbox,
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown
} from 'lucide-react'

// Status badge component
export function Badge({ status, label }) {
  const text = label || status?.replace(/_/g, ' ') || ''
  return (
    <span className={`badge badge-${status}`}>
      {text}
    </span>
  )
}

// Priority text
export function Priority({ priority }) {
  return (
    <span className={`priority-${priority}`} style={{ fontWeight: 600, fontSize: 12 }}>
      {priority}
    </span>
  )
}

// Loading spinner
export function Spinner({ size = 20 }) {
  return (
    <div
      className="spinner"
      style={{ width: size, height: size }}
    />
  )
}

// Full-page loading
export function LoadingOverlay() {
  return (
    <div className="loading-overlay">
      <Spinner size={32} />
    </div>
  )
}

// Empty state
export function EmptyState({ icon, title, message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {icon || <Inbox size={38} strokeWidth={1.4} />}
      </div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}

// Modal dialog
export function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 800 } : {}}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// Confirm dialog
export function ConfirmModal({ open, onClose, onConfirm, title, message, danger }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            Confirm
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.6 }}>
        {message}
      </p>
    </Modal>
  )
}

// Form group
export function FormGroup({ label, children, hint }) {
  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      {children}
      {hint && <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

// Copy-to-clipboard button with visual feedback
export function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={copy}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      style={{ padding: '4px 8px' }}
    >
      {copied ? (
        <Check size={13} style={{ color: 'var(--success)' }} />
      ) : (
        <Copy size={13} />
      )}
    </button>
  )
}

// Format currency
export function Currency({ amount, currency = 'USD' }) {
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
      {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0)}
    </span>
  )
}

// Format date
export function DateDisplay({ date }) {
  if (!date) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}
    </span>
  )
}

// Format datetime
export function DateTimeDisplay({ date }) {
  if (!date) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {new Date(date).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}
    </span>
  )
}

// Modern SaaS Metric / Stat Card
export function StatCard({ label, value, icon, color = 'primary', sublabel, change, isPositive }) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-label">{label}</span>
        {icon && <div className={`stat-icon ${color}`}>{icon}</div>}
      </div>
      <div className="stat-value">{value ?? '—'}</div>
      {(sublabel || change !== undefined) && (
        <div className={`stat-change ${isPositive !== undefined ? (isPositive ? 'up' : 'down') : ''}`}>
          {isPositive === true && <TrendingUp size={12} />}
          {isPositive === false && <TrendingDown size={12} />}
          <span>{change || sublabel}</span>
        </div>
      )}
    </div>
  )
}

// Legacy emoji icon mapper kept for compatibility
export const ICONS = {
  dashboard: '▦',
  frontdesk: '🛎',
  reservations: '📋',
  rooms: '🏨',
  housekeeping: '🧹',
  maintenance: '🔧',
  roomservice: '🍽',
  guests: '👥',
  staff: '👤',
  reports: '📊',
  integrations: '🔗',
  settings: '⚙️',
  audit: '📜',
  logout: '→',
}
