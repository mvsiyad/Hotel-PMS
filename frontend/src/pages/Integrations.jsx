import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import {
  getIntegrations, createIntegration, revokeIntegration, rotateSecret,
  getIntegrationToken, seedDemo
} from '../services/api'
import { Badge, Modal, FormGroup, DateTimeDisplay, CopyButton, LoadingOverlay } from '../components/UI'

const ALL_SCOPES = [
  'READ_ROOMS', 'READ_ROOM_TYPES', 'READ_AVAILABILITY', 'READ_RATES',
  'READ_GUESTS', 'CREATE_GUESTS', 'UPDATE_GUESTS',
  'READ_RESERVATIONS', 'CREATE_RESERVATIONS', 'MODIFY_RESERVATIONS',
  'CANCEL_RESERVATIONS', 'CHECK_IN', 'CHECK_OUT',
  'READ_HOUSEKEEPING', 'CREATE_HOUSEKEEPING_REQUEST', 'UPDATE_HOUSEKEEPING',
]

const SCOPE_GROUPS = {
  'Room Data': ['READ_ROOMS', 'READ_ROOM_TYPES', 'READ_AVAILABILITY', 'READ_RATES'],
  'Guests': ['READ_GUESTS', 'CREATE_GUESTS', 'UPDATE_GUESTS'],
  'Reservations': ['READ_RESERVATIONS', 'CREATE_RESERVATIONS', 'MODIFY_RESERVATIONS', 'CANCEL_RESERVATIONS', 'CHECK_IN', 'CHECK_OUT'],
  'Housekeeping': ['READ_HOUSEKEEPING', 'CREATE_HOUSEKEEPING_REQUEST', 'UPDATE_HOUSEKEEPING'],
}

export default function Integrations() {
  const { hotelId } = useAuth()
  const [integrations, setIntegrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newCreds, setNewCreds] = useState(null)  // One-time credential display
  const [rotatedCreds, setRotatedCreds] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', scopes: [] })
  const [testResult, setTestResult] = useState(null)
  const [seeding, setSeeding] = useState(false)

  const load = async () => {
    const r = await getIntegrations(hotelId).catch(() => ({ data: [] }))
    setIntegrations(r.data)
    setLoading(false)
  }

  useEffect(() => { if (hotelId) load() }, [hotelId])

  const toggleScope = (scope) => {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope) ? prev.scopes.filter((s) => s !== scope) : [...prev.scopes, scope],
    }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (form.scopes.length === 0) { toast.error('Select at least one scope'); return }
    try {
      const r = await createIntegration(hotelId, form)
      setNewCreds(r.data)
      setShowCreate(false)
      toast.success('Integration created — save credentials now!')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  const handleRevoke = async (int) => {
    if (!confirm(`Revoke "${int.name}"?`)) return
    try {
      await revokeIntegration(hotelId, int.id)
      toast.success('Integration revoked')
      load()
    } catch (err) {
      toast.error('Failed to revoke')
    }
  }

  const handleRotate = async (int) => {
    if (!confirm(`Rotate secret for "${int.name}"? The current secret will immediately stop working.`)) return
    try {
      const r = await rotateSecret(hotelId, int.id)
      setRotatedCreds(r.data)
      toast.success('Secret rotated — save the new secret!')
    } catch (err) {
      toast.error('Failed to rotate')
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await seedDemo(hotelId)
      toast.success('🌱 Demo data seeded successfully!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Seed failed')
    } finally {
      setSeeding(false)
    }
  }

  if (loading) return <LoadingOverlay />

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Integrations & API Access</div>
          <div className="topbar-subtitle">{integrations.length} integrations</div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleSeed} disabled={seeding}>
            {seeding ? '⏳ Seeding...' : '🌱 Seed Demo Data'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New Integration</button>
        </div>
      </div>

      <div className="page-container">
        {/* Info box */}
        <div className="alert alert-info" style={{ marginBottom: 24 }}>
          <div>
            <strong>Integration API</strong> — Client credentials are used by external systems (like the Hotel AI Platform) to authenticate against the PMS.
            Use <code style={{ fontFamily: 'var(--font-mono)' }}>POST /api/v1/integrations/token</code> to get a scoped JWT.
          </div>
        </div>

        {integrations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔗</div>
            <h3>No integrations configured</h3>
            <p>Create an integration to allow external systems to connect to this PMS.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {integrations.map((int) => (
              <div key={int.id} className="integration-card">
                <div className="integration-header">
                  <div>
                    <div className="integration-name">{int.name}</div>
                    {int.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{int.description}</div>}
                  </div>
                  <Badge status={int.status} />
                </div>

                <div className="integration-credentials">
                  <div className="cred-row">
                    <span className="cred-label">Client ID</span>
                    <span className="cred-value">{int.client_id}</span>
                    <CopyButton text={int.client_id} />
                  </div>
                  <div className="cred-row">
                    <span className="cred-label">Secret</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 12 }}>••••••••••••••••</span>
                  </div>
                  <div className="cred-row">
                    <span className="cred-label">Last Used</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {int.last_used_at ? new Date(int.last_used_at).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Scopes</div>
                  <div className="scope-list">
                    {JSON.parse(int.scopes_json || '[]').map((s) => (
                      <span key={s} className="scope-tag">{s}</span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  {int.status === 'ACTIVE' && (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRotate(int)}>🔄 Rotate Secret</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleRevoke(int)}>Revoke</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Integration Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Integration" wide
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" form="int-form" type="submit">Create Integration</button>
          </>
        }
      >
        <form id="int-form" onSubmit={handleCreate}>
          <FormGroup label="Integration Name">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Hotel AI Platform" required />
          </FormGroup>
          <FormGroup label="Description (optional)">
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this integration do?" />
          </FormGroup>

          <div style={{ marginBottom: 16 }}>
            <label>API Scopes</label>
            <div className="alert alert-warning" style={{ margin: '8px 0' }}>
              ⚠️ Only grant the minimum scopes required. Principle of least privilege.
            </div>
            {Object.entries(SCOPE_GROUPS).map(([group, scopes]) => (
              <div key={group} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{group}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {scopes.map((scope) => (
                    <label key={scope} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', textTransform: 'none', letterSpacing: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={form.scopes.includes(scope)}
                        onChange={() => toggleScope(scope)}
                        style={{ width: 'auto' }}
                      />
                      <span className="scope-tag" style={{ cursor: 'pointer' }}>{scope}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </form>
      </Modal>

      {/* One-time credentials display */}
      <Modal
        open={!!newCreds}
        onClose={() => setNewCreds(null)}
        title="🔐 Save Your Credentials — Shown Once!"
        footer={
          <button className="btn btn-primary" onClick={() => setNewCreds(null)}>I've saved the credentials</button>
        }
      >
        {newCreds && (
          <>
            <div className="secret-warning">
              ⚠️ The client_secret will NEVER be shown again. Copy it now and store it securely.
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>Client ID</label>
              <div className="secret-box" style={{ color: 'var(--primary)' }}>
                {newCreds.client_id}
                <CopyButton text={newCreds.client_id} />
              </div>
            </div>
            <div>
              <label>Client Secret (SAVE THIS NOW)</label>
              <div className="secret-box">
                {newCreds.client_secret}
                <CopyButton text={newCreds.client_secret} />
              </div>
            </div>
            <div className="alert alert-info" style={{ marginTop: 16 }}>
              <div>
                Use these credentials to authenticate:<br />
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  POST /api/v1/integrations/token<br />
                  {'{ "client_id": "...", "client_secret": "..." }'}
                </code>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Rotated credentials */}
      <Modal
        open={!!rotatedCreds}
        onClose={() => setRotatedCreds(null)}
        title="🔄 New Secret — Save Now!"
        footer={
          <button className="btn btn-primary" onClick={() => setRotatedCreds(null)}>I've saved the new secret</button>
        }
      >
        {rotatedCreds && (
          <>
            <div className="secret-warning">
              ⚠️ The old secret has been invalidated. Save this new secret immediately.
            </div>
            <div>
              <label>New Client Secret</label>
              <div className="secret-box">{rotatedCreds.client_secret}</div>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
