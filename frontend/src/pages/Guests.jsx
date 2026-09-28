import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { getGuests, createGuest } from '../services/api'
import { Modal, FormGroup, EmptyState, DateDisplay, LoadingOverlay } from '../components/UI'

export default function Guests() {
  const { hotelId } = useAuth()
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', nationality: '', id_number: '' })

  const load = async () => {
    const r = await getGuests(hotelId, search ? { search } : {}).catch(() => ({ data: [] }))
    setGuests(r.data)
    setLoading(false)
  }

  useEffect(() => { if (hotelId) load() }, [hotelId, search])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createGuest(hotelId, form)
      toast.success('Guest profile created')
      setShowCreate(false)
      setForm({ first_name: '', last_name: '', email: '', phone: '', nationality: '', id_number: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  if (loading) return <LoadingOverlay />

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Guests</div>
          <div className="topbar-subtitle">{guests.length} profiles</div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New Guest</button>
        </div>
      </div>

      <div className="page-container">
        <div className="filter-bar">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or phone..."
            style={{ width: 280 }}
          />
        </div>

        {guests.length === 0 ? (
          <EmptyState icon="👥" title="No guests found" message="Create a guest profile to get started." />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Nationality</th>
                  <th>Member Since</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => (
                  <tr key={g.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{g.id}</td>
                    <td><strong>{g.first_name} {g.last_name}</strong></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{g.email || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{g.phone || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{g.nationality || '—'}</td>
                    <td><DateDisplay date={g.created_at} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Guest Profile"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" form="guest-form" type="submit">Save Guest</button>
          </>
        }
      >
        <form id="guest-form" onSubmit={handleCreate}>
          <div className="grid-2">
            <FormGroup label="First Name">
              <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            </FormGroup>
            <FormGroup label="Last Name">
              <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
            </FormGroup>
          </div>
          <div className="grid-2">
            <FormGroup label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </FormGroup>
            <FormGroup label="Phone">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1-555-0100" />
            </FormGroup>
          </div>
          <div className="grid-2">
            <FormGroup label="Nationality">
              <input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="US" />
            </FormGroup>
            <FormGroup label="ID / Passport Number">
              <input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} />
            </FormGroup>
          </div>
        </form>
      </Modal>
    </div>
  )
}
