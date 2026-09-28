// Status badge component
export function Badge({ status, label }) {
  const text = label || status
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
export function Spinner({ size = 24 }) {
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
export function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}

// Modal
export function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 800 } : {}}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
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
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => { onConfirm(); onClose() }}
          >
            Confirm
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{message}</p>
    </Modal>
  )
}

// Form group
export function FormGroup({ label, children, hint }) {
  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      {children}
      {hint && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

// Copy-to-clipboard button
export function CopyButton({ text }) {
  const copy = () => {
    navigator.clipboard.writeText(text)
  }
  return (
    <button className="btn btn-ghost btn-sm" onClick={copy} title="Copy">
      📋
    </button>
  )
}

// Format currency
export function Currency({ amount, currency = 'USD' }) {
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)}
    </span>
  )
}

// Format date
export function DateDisplay({ date }) {
  if (!date) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <span>
      {new Date(date).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      })}
    </span>
  )
}

// Format datetime
export function DateTimeDisplay({ date }) {
  if (!date) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <span>
      {new Date(date).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      })}
    </span>
  )
}

/* ─── Sidebar Navigation Icon set ─── */
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
