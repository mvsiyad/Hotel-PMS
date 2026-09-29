import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Hotel,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Star,
  ShieldCheck,
  Sparkles,
  CheckCircle2
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const DEMO_ACCOUNTS = [
  {
    roleName: 'PMS Admin',
    email: 'admin@hotelpms.com',
    pass: 'Admin@123!',
    tag: 'Full Root Access',
  },
  {
    roleName: 'Front Desk',
    email: 'frontdesk@hotelpms.com',
    pass: 'Staff@123!',
    tag: 'Check-in / Desk',
  },
  {
    roleName: 'General Manager',
    email: 'manager@hotelpms.com',
    pass: 'Manager@123!',
    tag: 'Operations & Reports',
  },
]

export default function Login() {
  const [email, setEmail] = useState('admin@hotelpms.com')
  const [password, setPassword] = useState('Admin@123!')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [activePreset, setActivePreset] = useState('PMS Admin')

  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleSelectPreset = (acc) => {
    setActivePreset(acc.roleName)
    setEmail(acc.email)
    setPassword(acc.pass)
    toast.success(`Loaded credentials for ${acc.roleName}`)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Authentication verified. Welcome to Grand Horizon PMS.')
      navigate('/')
    } catch (err) {
      toast.error(
        err.response?.data?.detail || 'Authentication failed. Please verify credentials.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-split-page">
      {/* ── LEFT HERO SHOWCASE ────────────────────────────────────────── */}
      <div className="login-hero-panel">
        <div className="login-hero-overlay" />

        <div className="login-hero-content">
          {/* Top Brand Pill */}
          <div className="login-hero-badge">
            <Sparkles size={14} style={{ color: '#fbbf24' }} />
            <span>Grand Horizon Cloud PMS · Enterprise Suite</span>
          </div>

          {/* Bottom Luxury Glassmorphic Testimonial Card */}
          <div className="login-hero-card">
            <div className="login-hero-stars">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={15} fill="#fbbf24" stroke="#fbbf24" />
              ))}
            </div>

            <div className="login-hero-quote">
              "The unified operating system for high-yield luxury boutique resorts, villas, and
              hospitality portfolios worldwide."
            </div>

            <div
              style={{
                fontSize: 12,
                color: '#94a3b8',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ color: '#f8fafc', fontWeight: 600 }}>Grand Horizon Collection</span>
              <span>·</span>
              <span>Ranked #1 PMS Architecture 2026</span>
            </div>

            {/* Live Operational Metrics */}
            <div className="login-hero-metrics">
              <div>
                <div className="login-hero-metric-val">98.4%</div>
                <div className="login-hero-metric-lbl">Seasonal Occupancy</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <div className="login-hero-metric-val">3,400+</div>
                <div className="login-hero-metric-lbl">Live Inventory Units</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <div className="login-hero-metric-val">&lt; 12ms</div>
                <div className="login-hero-metric-lbl">Engine Telemetry</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT AUTHENTICATION CONSOLE ──────────────────────────────── */}
      <div className="login-form-panel">
        {/* Header: Brand & Theme Toggle */}
        <div className="login-form-header">
          <div className="login-brand-logo">
            <div className="login-brand-icon">
              <Hotel size={20} />
            </div>
            <div>
              <div className="login-brand-title">Hotel PMS</div>
              <div className="login-brand-sub">Grand Horizon Enterprise</div>
            </div>
          </div>

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

        {/* Form Body */}
        <div className="login-form-body">
          <h1 className="login-heading">Sign in to console</h1>
          <p className="login-subheading">
            Enter your authorized operator credentials to access real-time property management.
          </p>

          {/* Quick 1-Click Role Switcher */}
          <div className="login-demo-selector">
            <div className="login-demo-header">
              <span>Quick Demo Role Presets</span>
              <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 700 }}>
                1-Click Sign-in
              </span>
            </div>
            <div className="login-role-chips">
              {DEMO_ACCOUNTS.map((acc) => (
                <div
                  key={acc.roleName}
                  className={`login-role-chip ${activePreset === acc.roleName ? 'active' : ''}`}
                  onClick={() => handleSelectPreset(acc)}
                >
                  <div className="login-role-chip-name">{acc.roleName}</div>
                  <div className="login-role-chip-sub">{acc.tag}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Work Email Address</label>
              <div className="login-input-wrap">
                <Mail size={16} className="login-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  className="login-input-with-icon"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setActivePreset('')
                  }}
                  placeholder="name@hotelpms.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Security Password</label>
              <div className="login-input-wrap">
                <Lock size={16} className="login-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input-with-icon"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setActivePreset('')
                  }}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Utility Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 12.5,
                margin: '12px 0 20px',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  margin: 0,
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: 'auto', margin: 0 }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>Remember workstation</span>
              </label>

              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault()
                  toast('Demo password reset: Use default Admin@123!', { icon: 'ℹ️' })
                }}
                style={{ color: 'var(--primary)', fontWeight: 500 }}
              >
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary login-submit-btn"
              disabled={loading}
            >
              {loading ? (
                'Verifying credentials...'
              ) : (
                <>
                  <span>Sign In to Console</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Security Badges */}
        <div className="login-form-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
            <span>256-bit TLS Encryption</span>
          </div>
          <div>SOC2 Type II Certified</div>
        </div>
      </div>
    </div>
  )
}
