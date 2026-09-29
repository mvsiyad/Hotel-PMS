import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Webhook,
  Key,
  RefreshCw,
  Database,
  Plus,
  ShieldAlert,
  Trash2,
  Lock,
  Code
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  getIntegrations,
  createIntegration,
  revokeIntegration,
  rotateSecret,
  seedDemo,
} from '../services/api'
import {
  Badge,
  Modal,
  FormGroup,
  DateTimeDisplay,
  CopyButton,
  LoadingOverlay,
} from '../components/UI'
import Topbar from '../components/Topbar'

const ALL_SCOPES = [
  'READ_ROOMS',
  'READ_ROOM_TYPES',
  'READ_AVAILABILITY',
  'READ_RATES',
  'READ_GUESTS',
  'CREATE_GUESTS',
  'UPDATE_GUESTS',
  'READ_RESERVATIONS',
  'CREATE_RESERVATIONS',
  'MODIFY_RESERVATIONS',
  'CANCEL_RESERVATIONS',
  'CHECK_IN',
  'CHECK_OUT',
  'READ_HOUSEKEEPING',
  'CREATE_HOUSEKEEPING_REQUEST',
  'UPDATE_HOUSEKEEPING',
]

const SCOPE_GROUPS = {
  'Room Inventory': ['READ_ROOMS', 'READ_ROOM_TYPES', 'READ_AVAILABILITY', 'READ_RATES'],
  'Guest Profiles': ['READ_GUESTS', 'CREATE_GUESTS', 'UPDATE_GUESTS'],
  'Reservations': [
    'READ_RESERVATIONS',
    'CREATE_RESERVATIONS',
    'MODIFY_RESERVATIONS',
    'CANCEL_RESERVATIONS',
    'CHECK_IN',
    'CHECK_OUT',
  ],
  'Housekeeping': ['READ_HOUSEKEEPING', 'CREATE_HOUSEKEEPING_REQUEST', 'UPDATE_HOUSEKEEPING'],
}

export default function Integrations() {
  const { hotelId } = useAuth()
  const [integrations, setIntegrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newCreds, setNewCreds] = useState(null)
  const [rotatedCreds, setRotatedCreds] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', scopes: [] })
  const [seeding, setSeeding] = useState(false)

  const load = async () => {
    const r = await getIntegrations(hotelId).catch(() => ({ data: [] }))
    setIntegrations(r.data)
    setLoading(false)
  }

  useEffect(() => {
    if (hotelId) load()
  }, [hotelId])

  const toggleScope = (scope) => {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (form.scopes.length === 0) {
      toast.error('Select at least one API scope')
      return
    }
    try {
      const r = await createIntegration(hotelId, form)
      setNewCreds(r.data)
      setShowCreate(false)
      toast.success('Integration created — save credentials securely!')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create integration')
    }
  }

  const handleRevoke = async (int) => {
    if (!confirm(`Revoke API access for "${int.name}"?`)) return
    try {
      await revokeIntegration(hotelId, int.id)
      toast.success('Integration revoked')
      load()
    } catch (err) {
      toast.error('Failed to revoke integration')
    }
  }

  const handleRotate = async (int) => {
    if (
      !confirm(
        `Rotate client secret for "${int.name}"? The current secret will immediately become invalid.`
      )
    )
      return
    try {
      const r = await rotateSecret(hotelId, int.id)
      setRotatedCreds(r.data)
      toast.success('Secret rotated — store the new key immediately!')
    } catch (err) {
      toast.error('Failed to rotate secret')
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await seedDemo(hotelId)
      toast.success('Demo environment populated with realistic data')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Demo seed operation failed')
    } finally {
      setSeeding(false)
    }
  }

  if (loading) return <LoadingOverlay />

  return (
    <div>
      <Topbar
        title="API Integrations & Webhooks"
        subtitle={`${integrations.length} active service-to-service connections`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleSeed}
              disabled={seeding}
            >
              <Database size={13} />
              <span>{seeding ? 'Seeding...' : 'Seed Demo Data'}</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              <span>New Integration</span>
            </button>
          </div>
        }
      />

      <div className="page-container">
        {/* Info Banner */}
        <div
          style={{
            background: 'var(--primary-tint)',
            border: '1px solid var(--primary-glow)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 18px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <Code size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Machine-to-Machine Authentication:</strong>{' '}
            External platforms (such as the Hotel AI Voice Agent) authenticate via{' '}
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                background: 'var(--bg-tertiary)',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              POST /api/v1/integrations/token
            </code>{' '}
            using these OAuth2 Client Credentials.
          </div>
        </div>

        {integrations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Webhook size={38} strokeWidth={1.4} />
            </div>
            <h3>No integrations configured</h3>
            <p>Generate API credentials to grant verified external services access to PMS endpoints.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {integrations.map((int) => (
              <div key={int.id} className="integration-card">
                <div className="integration-header">
                  <div>
                    <div className="integration-name">{int.name}</div>
                    {int.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {int.description}
                      </div>
                    )}
                  </div>
                  <Badge status={int.status} />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 12,
                    background: 'var(--bg-tertiary)',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    margin: '14px 0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 60 }}>
                      Client ID:
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {int.client_id}
                    </span>
                    <CopyButton text={int.client_id} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 60 }}>
                      Secret:
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)',
                        fontSize: 12,
                      }}
                    >
                      ••••••••••••••••••••••••
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 60 }}>
                      Last Used:
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {int.last_used_at ? new Date(int.last_used_at).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: 8,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                    }}
                  >
                    Granted OAuth Scopes
                  </div>
                  <div className="integration-scopes">
                    {JSON.parse(int.scopes_json || '[]').map((s) => (
                      <span key={s} className="scope-tag">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 18,
                    paddingTop: 14,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  {int.status === 'ACTIVE' && (
                    <>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRotate(int)}
                      >
                        <RefreshCw size={12} />
                        <span>Rotate Secret</span>
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => handleRevoke(int)}
                      >
                        <Trash2 size={12} />
                        <span>Revoke Access</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Integration Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Provision Integration API Key"
        wide
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" form="int-form" type="submit">
              Generate Credentials
            </button>
          </>
        }
      >
        <form id="int-form" onSubmit={handleCreate}>
          <FormGroup label="Integration Name">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Hotel AI Voice Agent Platform"
              required
            />
          </FormGroup>
          <FormGroup label="Service Description (Optional)">
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Intended purpose and access scopes..."
            />
          </FormGroup>

          <div style={{ marginBottom: 16 }}>
            <label>Permission Scopes</label>
            {Object.entries(SCOPE_GROUPS).map(([group, scopes]) => (
              <div key={group} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    marginBottom: 6,
                  }}
                >
                  {group}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {scopes.map((scope) => (
                    <label
                      key={scope}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        margin: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.scopes.includes(scope)}
                        onChange={() => toggleScope(scope)}
                        style={{ width: 'auto', margin: 0 }}
                      />
                      <span className="scope-tag" style={{ cursor: 'pointer' }}>
                        {scope}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </form>
      </Modal>

      {/* One-time Credentials Modal */}
      <Modal
        open={!!newCreds}
        onClose={() => setNewCreds(null)}
        title="Save Client Credentials"
        footer={
          <button className="btn btn-primary" onClick={() => setNewCreds(null)}>
            I have stored these credentials securely
          </button>
        }
      >
        {newCreds && (
          <div>
            <div
              style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: 16,
                fontSize: 12.5,
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <ShieldAlert size={16} style={{ flexShrink: 0 }} />
              <span>The client secret will never be displayed again. Store it securely now.</span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label>Client ID</label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-tertiary)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12.5,
                  border: '1px solid var(--border)',
                }}
              >
                <span>{newCreds.client_id}</span>
                <CopyButton text={newCreds.client_id} />
              </div>
            </div>

            <div>
              <label>Client Secret</label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-tertiary)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12.5,
                  border: '1px solid var(--border)',
                  color: 'var(--primary)',
                }}
              >
                <span>{newCreds.client_secret}</span>
                <CopyButton text={newCreds.client_secret} />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Rotated Credentials Modal */}
      <Modal
        open={!!rotatedCreds}
        onClose={() => setRotatedCreds(null)}
        title="New Client Secret"
        footer={
          <button className="btn btn-primary" onClick={() => setRotatedCreds(null)}>
            I have saved the new secret
          </button>
        }
      >
        {rotatedCreds && (
          <div>
            <div
              style={{
                background: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: 16,
                fontSize: 12.5,
                color: 'var(--warning)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <ShieldAlert size={16} style={{ flexShrink: 0 }} />
              <span>The prior secret has been invalidated immediately.</span>
            </div>
            <div>
              <label>New Secret Key</label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-tertiary)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12.5,
                  border: '1px solid var(--border)',
                }}
              >
                <span>{rotatedCreds.client_secret}</span>
                <CopyButton text={rotatedCreds.client_secret} />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
