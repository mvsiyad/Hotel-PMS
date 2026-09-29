import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Hotel,
  Settings as SettingsIcon,
  Code,
  Check,
  X,
  Database,
  ExternalLink,
  Save,
  Building2,
  BedDouble,
  Users,
  Briefcase,
  CalendarCheck,
  UtensilsCrossed,
  ShieldAlert
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getHotels, updateHotel, seedDemo } from '../services/api'
import { LoadingOverlay } from '../components/UI'
import Topbar from '../components/Topbar'

function Section({ title, subtitle, children }) {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {subtitle && <div className="card-subtitle">{subtitle}</div>}
        </div>
      </div>
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

export default function Settings() {
  const { user, hotelId } = useAuth()
  const [hotel, setHotel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [hotelForm, setHotelForm] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    website: '',
  })
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('property')

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await getHotels()
        const h = resp.data.find((h) => h.id === hotelId) || resp.data[0]
        if (h) {
          setHotel(h)
          setHotelForm({
            name: h.name || '',
            address: h.address || '',
            city: h.city || '',
            country: h.country || '',
            phone: h.phone || '',
            email: h.email || '',
            website: h.website || '',
          })
        }
      } catch {
        /* skip */
      }
      setLoading(false)
    }
    if (hotelId) load()
  }, [hotelId])

  const handleSaveHotel = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateHotel(hotelId, hotelForm)
      toast.success('Hotel profile settings saved')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const resp = await seedDemo(hotelId)
      const { created } = resp.data
      const parts = Object.entries(created)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`)
        .join(', ')
      toast.success(`Seed complete! ${parts || 'All demo fixtures loaded'}`, { duration: 5000 })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Seed failed')
    } finally {
      setSeeding(false)
    }
  }

  if (loading) return <LoadingOverlay />

  const TABS = [
    { key: 'property', label: 'Property Profile', icon: Hotel },
    { key: 'system', label: 'RBAC & System', icon: SettingsIcon },
    { key: 'developer', label: 'Developer Sandbox', icon: Code },
  ]

  return (
    <div>
      <Topbar
        title="Settings & System Governance"
        subtitle="Property configuration, RBAC permissions, and developer tools"
      />

      <div className="page-container">
        {/* Navigation Tabs */}
        <div className="tabs" style={{ marginBottom: 24 }}>
          {TABS.map((t) => {
            const TabIcon = t.icon
            return (
              <button
                key={t.key}
                className={`tab ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => setActiveTab(t.key)}
              >
                <TabIcon size={14} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>

        {activeTab === 'property' && (
          <Section
            title="Hospitality Property Information"
            subtitle="Update hotel branding, contact channels, and localized address details"
          >
            <form onSubmit={handleSaveHotel}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Property Trade Name">
                  <input
                    value={hotelForm.name}
                    onChange={(e) => setHotelForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Grand Horizon Hotel & Suites"
                  />
                </Field>
                <Field label="Central Reservations Email">
                  <input
                    type="email"
                    value={hotelForm.email}
                    onChange={(e) => setHotelForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="reservations@grandhorizon.com"
                  />
                </Field>
                <Field label="Street Address">
                  <input
                    value={hotelForm.address}
                    onChange={(e) => setHotelForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="100 Ocean Promenade"
                  />
                </Field>
                <Field label="Primary Front Desk Phone">
                  <input
                    value={hotelForm.phone}
                    onChange={(e) => setHotelForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+1 (555) 019-2831"
                  />
                </Field>
                <Field label="Municipality / City">
                  <input
                    value={hotelForm.city}
                    onChange={(e) => setHotelForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Miami"
                  />
                </Field>
                <Field label="Country Code">
                  <input
                    value={hotelForm.country}
                    onChange={(e) => setHotelForm((f) => ({ ...f, country: e.target.value }))}
                    placeholder="USA"
                  />
                </Field>
                <Field label="Official Website URL" hint="Shown on confirmation receipts and invoices">
                  <input
                    value={hotelForm.website}
                    onChange={(e) => setHotelForm((f) => ({ ...f, website: e.target.value }))}
                    placeholder="https://www.grandhorizon.com"
                  />
                </Field>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ marginTop: 8 }}
              >
                <Save size={14} />
                <span>{saving ? 'Saving Changes...' : 'Save Property Profile'}</span>
              </button>
            </form>
          </Section>
        )}

        {activeTab === 'system' && (
          <>
            <Section title="Session Telemetry" subtitle="Active portal credentials and routing context">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 14,
                }}
              >
                {[
                  {
                    label: 'Authenticated User',
                    value:
                      user?.role === 'PMS_ADMIN'
                        ? 'PMS Admin'
                        : `${user?.first_name} ${user?.last_name}`,
                  },
                  { label: 'Assigned Role', value: user?.role?.replace(/_/g, ' ') },
                  { label: 'Active Hotel ID', value: `#${hotelId}` },
                  { label: 'Property Title', value: hotel?.name || 'Grand Horizon' },
                  { label: 'API Gateway', value: '/api/v1' },
                  { label: 'Engine Core', value: 'PMS v2.0 Enterprise' },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      background: 'var(--bg-tertiary)',
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              title="Role-Based Access Control (RBAC) Matrix"
              subtitle="Enforced permission sets per staff tier"
            >
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Module Capability</th>
                      <th style={{ textAlign: 'center' }}>PMS Admin</th>
                      <th style={{ textAlign: 'center' }}>Manager</th>
                      <th style={{ textAlign: 'center' }}>Front Desk</th>
                      <th style={{ textAlign: 'center' }}>Housekeeping</th>
                      <th style={{ textAlign: 'center' }}>Maintenance</th>
                      <th style={{ textAlign: 'center' }}>Supervisor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Staff Provisioning', true, true, false, false, false, false],
                      ['Room Configuration', true, true, false, false, false, false],
                      ['Manage Reservations', true, true, true, false, false, false],
                      ['Check In / Check Out', true, true, true, false, false, false],
                      ['View Housekeeping Queue', true, true, true, true, false, true],
                      ['Dispatch Housekeeping Tasks', true, true, false, true, false, true],
                      ['Inspect Completed Units', true, true, false, false, false, true],
                      ['Manage Maintenance Orders', true, true, false, false, true, false],
                      ['Manage API Integrations', true, false, false, false, false, false],
                    ].map(([perm, ...vals]) => (
                      <tr key={perm}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{perm}</td>
                        {vals.map((v, i) => (
                          <td key={i} style={{ textAlign: 'center' }}>
                            {v ? (
                              <Check
                                size={15}
                                style={{ color: 'var(--success)', display: 'inline-block' }}
                              />
                            ) : (
                              <span style={{ color: 'var(--text-disabled)', fontSize: 13 }}>—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

        {activeTab === 'developer' && (
          <>
            <Section
              title="Demo Data Environment Seeder"
              subtitle="Generate a complete sandbox environment with rooms, reservations, staff, and tasks."
            >
              <div
                style={{
                  background: 'var(--primary-tint)',
                  border: '1px solid var(--primary-glow)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  marginBottom: 20,
                  fontSize: 13,
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <Database size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Idempotent Sandbox Seeder:</strong>{' '}
                  Running the seeder initializes 24 rooms across 4 floors, 5 room types, 7 staff
                  roles, 5 demo guest profiles, and upcoming bookings without duplicating existing
                  entries.
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                {[
                  { icon: Building2, item: '24 rooms (4 floors × 6 units)' },
                  { icon: BedDouble, item: '5 room categories (Standard → Penthouse)' },
                  { icon: Users, item: '5 verified guest test profiles' },
                  { icon: Briefcase, item: '7 role-partitioned staff accounts' },
                  { icon: CalendarCheck, item: '3 live reservation fixtures' },
                  { icon: UtensilsCrossed, item: '10 cataloged dining menu items' },
                ].map(({ icon: ItemIcon, item }) => (
                  <div
                    key={item}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      background: 'var(--bg-tertiary)',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 12.5,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <ItemIcon size={16} style={{ color: 'var(--primary)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
                  </div>
                ))}
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSeed}
                disabled={seeding}
                style={{ minWidth: 180 }}
              >
                <Database size={14} />
                <span>{seeding ? 'Seeding Fixtures...' : 'Run Demo Data Seeder'}</span>
              </button>
            </Section>

            <Section
              title="REST API Endpoints Reference"
              subtitle="Direct HTTP interfaces exposed by the FastAPI PMS microservice"
            >
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  ['POST', '/api/v1/auth/login', 'Bearer JWT staff authentication'],
                  ['GET', '/api/v1/hotels', 'Property resource discovery'],
                  ['GET', '/api/v1/hotels/{id}/rooms', 'Inventory list with room status filter'],
                  ['GET', '/api/v1/hotels/{id}/reservations', 'Reservations data feed'],
                  ['POST', '/api/v1/hotels/{id}/reservations/{id}/check-in', 'Atomic check-in transition'],
                  ['POST', '/api/v1/hotels/{id}/reservations/{id}/check-out', 'Atomic check-out & HK dispatch'],
                  ['GET', '/api/v1/hotels/{id}/availability', 'Date-range room availability query'],
                  ['GET', '/api/v1/hotels/{id}/housekeeping', 'Turnaround workflow tasks'],
                  ['GET', '/api/v1/hotels/{id}/audit-logs', 'Compliance audit trail records'],
                  ['POST', '/api/v1/dev/seed/{id}', 'Idempotent test data seeding'],
                ].map(([method, path, desc]) => (
                  <div
                    key={path}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 12.5,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background:
                          method === 'GET' ? 'var(--success-bg)' : 'var(--primary-tint)',
                        color: method === 'GET' ? 'var(--success)' : 'var(--primary)',
                        border: `1px solid ${
                          method === 'GET' ? 'var(--success-border)' : 'var(--primary-glow)'
                        }`,
                        minWidth: 48,
                        textAlign: 'center',
                      }}
                    >
                      {method}
                    </span>
                    <code
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        flex: 1,
                      }}
                    >
                      {path}
                    </code>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{desc}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 18 }}>
                <a
                  href="http://localhost:8001/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', gap: 6 }}
                >
                  <ExternalLink size={13} />
                  <span>Open Interactive OpenAPI / Swagger Docs</span>
                </a>
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
