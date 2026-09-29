import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Users, Search, Mail, Phone, Globe, Shield } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getGuests, createGuest } from '../services/api'
import { Modal, FormGroup, EmptyState, DateDisplay, LoadingOverlay } from '../components/UI'
import Topbar from '../components/Topbar'

export default function Guests() {
  const { hotelId } = useAuth()
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    nationality: '',
    id_number: '',
  })

  const load = async () => {
    const r = await getGuests(hotelId, search ? { search } : {}).catch(() => ({ data: [] }))
    setGuests(r.data)
    setLoading(false)
  }

  useEffect(() => {
    if (hotelId) load()
  }, [hotelId, search])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createGuest(hotelId, form)
      toast.success('Guest profile registered')
      setShowCreate(false)
      setForm({ first_name: '', last_name: '', email: '', phone: '', nationality: '', id_number: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create guest')
    }
  }

  if (loading) return <LoadingOverlay />

  return (
    <div>
      <Topbar
        title="Guest Directory"
        subtitle={`${guests.length} registered guest profiles`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            <span>New Guest</span>
          </button>
        }
      />

      <div className="page-container">
        <div className="filter-bar">
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              width: 300,
            }}
          >
            <Search
              size={14}
              style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or phone..."
              style={{ paddingLeft: 32 }}
            />
          </div>
        </div>

        {guests.length === 0 ? (
          <EmptyState
            icon={<Users size={36} strokeWidth={1.4} />}
            title="No guest profiles found"
            message="Create a new guest record or adjust your search filter."
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Guest ID</th>
                  <th>Full Name</th>
                  <th>Email Address</th>
                  <th>Phone Number</th>
                  <th>Nationality</th>
                  <th>Member Since</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          color: 'var(--text-muted)',
                        }}
                      >
                        #{g.id}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {g.first_name} {g.last_name}
                      </strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{g.email || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {g.phone || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{g.nationality || '—'}</td>
                    <td>
                      <DateDisplay date={g.created_at} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Register Guest Profile"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" form="guest-form" type="submit">
              Save Guest Profile
            </button>
          </>
        }
      >
        <form id="guest-form" onSubmit={handleCreate}>
          <div className="grid-2">
            <FormGroup label="First Name">
              <input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
              />
            </FormGroup>
            <FormGroup label="Last Name">
              <input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
              />
            </FormGroup>
          </div>
          <div className="grid-2">
            <FormGroup label="Email Address">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </FormGroup>
            <FormGroup label="Phone Number">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1-555-0100"
              />
            </FormGroup>
          </div>
          <div className="grid-2">
            <FormGroup label="Nationality">
              <input
                value={form.nationality}
                onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                placeholder="US"
              />
            </FormGroup>
            <FormGroup label="Passport / ID Document">
              <input
                value={form.id_number}
                onChange={(e) => setForm({ ...form, id_number: e.target.value })}
              />
            </FormGroup>
          </div>
        </form>
      </Modal>
    </div>
  )
}
