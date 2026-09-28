import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { getHotels, updateHotel, seedDemo } from '../services/api'
import { LoadingOverlay } from '../components/UI'

function Section({ title, subtitle, children }) {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {subtitle && <div className="card-subtitle">{subtitle}</div>}
        </div>
      </div>
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

export default function Settings() {
  const { user, hotelId } = useAuth()
  const [hotel, setHotel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [hotelForm, setHotelForm] = useState({ name: '', address: '', city: '', country: '', phone: '', email: '', website: '' })
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('property')

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await getHotels()
        const h = resp.data.find(h => h.id === hotelId) || resp.data[0]
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
      } catch { /* skip */ }
      setLoading(false)
    }
    if (hotelId) load()
  }, [hotelId])

  const handleSaveHotel = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateHotel(hotelId, hotelForm)
      toast.success('Hotel settings saved!')
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
        .map(([k, v]) => `${v} ${k.replace('_', ' ')}`)
        .join(', ')
      toast.success(`✅ Seed complete! ${parts || 'All data already seeded'}`, { duration: 5000 })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Seed failed')
    } finally {
      setSeeding(false)
    }
  }


  if (loading) return <LoadingOverlay />

  const TABS = [
    { key: 'property', label: '🏨 Property' },
    { key: 'system', label: '⚙️ System' },
    { key: 'developer', label: '🛠️ Developer' },
  ]

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Settings</div>
          <div className="topbar-subtitle">System configuration and developer tools</div>
        </div>
      </div>

      <div className="page-container">
        <div className="tabs" style={{ marginBottom: 24 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'property' && (
          <Section title="Property Information" subtitle="Update your hotel's profile and contact details">
            <form onSubmit={handleSaveHotel}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Hotel Name">
                  <input value={hotelForm.name} onChange={e => setHotelForm(f => ({ ...f, name: e.target.value }))} placeholder="Grand Luxury Hotel" />
                </Field>
                <Field label="Email">
                  <input type="email" value={hotelForm.email} onChange={e => setHotelForm(f => ({ ...f, email: e.target.value }))} placeholder="info@hotel.com" />
                </Field>
                <Field label="Address">
                  <input value={hotelForm.address} onChange={e => setHotelForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Ocean Drive" />
                </Field>
                <Field label="Phone">
                  <input value={hotelForm.phone} onChange={e => setHotelForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1-555-000-0000" />
                </Field>
                <Field label="City">
                  <input value={hotelForm.city} onChange={e => setHotelForm(f => ({ ...f, city: e.target.value }))} placeholder="Miami" />
                </Field>
                <Field label="Country">
                  <input value={hotelForm.country} onChange={e => setHotelForm(f => ({ ...f, country: e.target.value }))} placeholder="USA" />
                </Field>
                <Field label="Website" hint="Optional — used in guest-facing materials">
                  <input value={hotelForm.website} onChange={e => setHotelForm(f => ({ ...f, website: e.target.value }))} placeholder="https://www.hotel.com" />
                </Field>
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '⏳ Saving...' : '💾 Save Property Settings'}
              </button>
            </form>
          </Section>
        )}

        {activeTab === 'system' && (
          <>
            <Section title="Portal Information" subtitle="Current session and access details">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                {[
                  { label: 'Logged In As', value: user?.role === 'PMS_ADMIN' ? 'PMS Admin' : `${user?.first_name} ${user?.last_name}` },
                  { label: 'Role', value: user?.role?.replace(/_/g, ' ') },
                  { label: 'Hotel ID', value: `#${hotelId}` },
                  { label: 'Hotel Name', value: hotel?.name || '—' },
                  { label: 'Backend Version', value: 'v1.0.0' },
                  { label: 'API Base', value: '/api/v1' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--bg-tertiary)', padding: '14px 18px', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Role Permissions Matrix" subtitle="What each staff role can do">
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Permission</th>
                      <th>PMS Admin</th>
                      <th>Manager</th>
                      <th>Front Desk</th>
                      <th>Housekeeping</th>
                      <th>Maintenance</th>
                      <th>Supervisor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Manage Staff', true, true, false, false, false, false],
                      ['Manage Rooms', true, true, false, false, false, false],
                      ['Manage Reservations', true, true, true, false, false, false],
                      ['Check In / Out', true, true, true, false, false, false],
                      ['View Housekeeping', true, true, true, true, false, true],
                      ['Manage Housekeeping', true, true, false, true, false, true],
                      ['Inspect Rooms', true, true, false, false, false, true],
                      ['Manage Maintenance', true, true, false, false, true, false],
                      ['Manage Integrations', true, false, false, false, false, false],
                    ].map(([perm, ...vals]) => (
                      <tr key={perm}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{perm}</td>
                        {vals.map((v, i) => (
                          <td key={i} style={{ textAlign: 'center', fontSize: 16 }}>{v ? '✅' : '❌'}</td>
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
            <Section title="Demo Data Seeder" subtitle="Populate the hotel with realistic test data. Safe to run multiple times (idempotent).">
              <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ fontWeight: 700, color: '#f87171', marginBottom: 6 }}>⚠️ Developer Tool</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  This creates demo room types, rooms, staff accounts, guests, reservations, and room service menu items.
                  It will not duplicate data if already seeded.
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { icon: '🏠', item: '24 rooms (4 floors × 6 rooms)' },
                  { icon: '🛏️', item: '5 room types (Standard → Suite)' },
                  { icon: '👤', item: '5 demo guests with contact info' },
                  { icon: '👔', item: '7 staff accounts with roles' },
                  { icon: '📋', item: '3 upcoming reservations' },
                  { icon: '🍽️', item: '10 room service menu items' },
                ].map(({ icon, item }) => (
                  <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-primary"
                onClick={handleSeed}
                disabled={seeding}
                style={{ minWidth: 200 }}
              >
                {seeding ? '⏳ Seeding...' : '🌱 Run Demo Seed'}
              </button>
            </Section>

            <Section title="API Endpoints" subtitle="Quick reference for the PMS REST API">
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  ['POST', '/api/v1/auth/login', 'Staff authentication'],
                  ['GET', '/api/v1/hotels', 'List hotels'],
                  ['GET', '/api/v1/hotels/{id}/rooms', 'List rooms'],
                  ['GET', '/api/v1/hotels/{id}/reservations', 'List reservations'],
                  ['POST', '/api/v1/hotels/{id}/reservations/{id}/check-in', 'Check in guest'],
                  ['POST', '/api/v1/hotels/{id}/reservations/{id}/check-out', 'Check out guest'],
                  ['GET', '/api/v1/hotels/{id}/availability', 'Room availability'],
                  ['GET', '/api/v1/hotels/{id}/housekeeping', 'Housekeeping tasks'],
                  ['GET', '/api/v1/hotels/{id}/audit-logs', 'Audit log'],
                  ['POST', '/api/v1/dev/seed/{id}', 'Seed demo data'],
                ].map(([method, path, desc]) => (
                  <div key={path} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 13 }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: method === 'GET' ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)',
                      color: method === 'GET' ? '#4ade80' : '#818cf8',
                      minWidth: 48,
                      textAlign: 'center',
                    }}>
                      {method}
                    </span>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{path}</code>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{desc}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <a href="http://localhost:8001/docs" target="_blank" rel="noreferrer" className="btn btn-ghost">
                  📖 Open Swagger UI →
                </a>
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
