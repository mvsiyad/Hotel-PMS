import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { FormGroup } from '../components/UI'

export default function Login() {
  const [email, setEmail] = useState('admin@hotelpms.com')
  const [password, setPassword] = useState('Admin@123!')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome to Hotel PMS')
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">🏨</div>
          <div className="login-logo-text">
            <h1>Hotel PMS</h1>
            <span>Property Management System</span>
          </div>
        </div>

        <div className="login-form">
          <h2>Sign In</h2>
          <p>Access your hotel management dashboard</p>

          <form onSubmit={handleSubmit}>
            <FormGroup label="Email Address">
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@hotelpms.com"
                required
                autoComplete="email"
              />
            </FormGroup>

            <FormGroup label="Password">
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </FormGroup>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary login-btn"
              disabled={loading}
            >
              {loading ? 'Signing in...' : '🔐  Sign In to PMS'}
            </button>
          </form>

          <div style={{ marginTop: 28, padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Demo Credentials
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              admin@hotelpms.com / Admin@123!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
