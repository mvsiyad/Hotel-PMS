import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import {
  getReservations, createReservation, checkIn, checkOut,
  cancelReservation, noShow, getGuests, getRoomTypes, getRooms
} from '../services/api'
import { Badge, Modal, FormGroup, Currency, DateDisplay, EmptyState, LoadingOverlay } from '../components/UI'

const STATUS_FILTERS = ['', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW']

export default function Reservations() {
  const { hotelId } = useAuth()
  const [reservations, setReservations] = useState([])
  const [guests, setGuests] = useState([])
  const [roomTypes, setRoomTypes] = useState([])
  const [rooms, setRooms] = useState([])
  const [statusFilter, setStatusFilter] = useState('CONFIRMED')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showCheckin, setShowCheckin] = useState(null)
  const [selectedRoom, setSelectedRoom] = useState('')
  const [form, setForm] = useState({
    guest_id: '', room_type_id: '', check_in_date: '', check_out_date: '', adults: 1, children: 0
  })

  const load = async () => {
    const [r, g, rt, rm] = await Promise.all([
      getReservations(hotelId, statusFilter ? { status: statusFilter } : {}).catch(() => ({ data: [] })),
      getGuests(hotelId).catch(() => ({ data: [] })),
      getRoomTypes(hotelId).catch(() => ({ data: [] })),
      getRooms(hotelId, { status: 'READY' }).catch(() => ({ data: [] })),
    ])
    setReservations(r.data)
    setGuests(g.data)
    setRoomTypes(rt.data)
    setRooms(rm.data)
    setLoading(false)
  }

  useEffect(() => { if (hotelId) load() }, [hotelId, statusFilter])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createReservation(hotelId, { ...form, guest_id: parseInt(form.guest_id), room_type_id: parseInt(form.room_type_id), adults: parseInt(form.adults), children: parseInt(form.children) })
      toast.success('Reservation created')
      setShowCreate(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create reservation')
    }
  }

  const handleCheckIn = async () => {
    try {
      await checkIn(hotelId, showCheckin.id, { room_id: parseInt(selectedRoom) })
      toast.success('Guest checked in successfully')
      setShowCheckin(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Check-in failed')
    }
  }

  const handleCheckOut = async (res) => {
    try {
      await checkOut(hotelId, res.id, {})
      toast.success('Guest checked out. Room is now DIRTY.')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Check-out failed')
    }
  }

  const handleCancel = async (res) => {
    if (!confirm(`Cancel reservation ${res.confirmation_number}?`)) return
    try {
      await cancelReservation(hotelId, res.id)
      toast.success('Reservation cancelled')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Cannot cancel')
    }
  }

  const getGuestName = (id) => {
    const g = guests.find((g) => g.id === id)
    return g ? `${g.first_name} ${g.last_name}` : `#${id}`
  }

  const getRTName = (id) => roomTypes.find((rt) => rt.id === id)?.name || '—'

  if (loading) return <LoadingOverlay />

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Reservations</div>
          <div className="topbar-subtitle">{reservations.length} records</div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New Reservation</button>
        </div>
      </div>

      <div className="page-container">
        {/* Status filter tabs */}
        <div className="tabs">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s || 'all'}
              className={`tab ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Confirmation</th>
                <th>Guest</th>
                <th>Room Type</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Nights</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No reservations found</td></tr>
              )}
              {reservations.map((r) => {
                const nights = Math.round((new Date(r.check_out_date) - new Date(r.check_in_date)) / 86400000)
                return (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--primary)' }}>
                        {r.confirmation_number}
                      </span>
                    </td>
                    <td>{getGuestName(r.guest_id)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{getRTName(r.room_type_id)}</td>
                    <td><DateDisplay date={r.check_in_date} /></td>
                    <td><DateDisplay date={r.check_out_date} /></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{nights}n</td>
                    <td><Currency amount={r.total_amount} /></td>
                    <td><Badge status={r.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {r.status === 'CONFIRMED' && (
                          <button className="btn btn-success btn-sm" onClick={() => { setShowCheckin(r); setSelectedRoom('') }}>
                            Check In
                          </button>
                        )}
                        {r.status === 'CHECKED_IN' && (
                          <button className="btn btn-primary btn-sm" onClick={() => handleCheckOut(r)}>
                            Check Out
                          </button>
                        )}
                        {['CONFIRMED', 'PENDING'].includes(r.status) && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleCancel(r)}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Reservation Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Reservation"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" form="create-res-form" type="submit">Create Reservation</button>
          </>
        }
      >
        <form id="create-res-form" onSubmit={handleCreate}>
          <FormGroup label="Guest">
            <select value={form.guest_id} onChange={(e) => setForm({ ...form, guest_id: e.target.value })} required>
              <option value="">Select guest...</option>
              {guests.map((g) => <option key={g.id} value={g.id}>{g.first_name} {g.last_name} – {g.email || 'No email'}</option>)}
            </select>
          </FormGroup>
          <FormGroup label="Room Type">
            <select value={form.room_type_id} onChange={(e) => setForm({ ...form, room_type_id: e.target.value })} required>
              <option value="">Select room type...</option>
              {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name} (${rt.base_rate}/night)</option>)}
            </select>
          </FormGroup>
          <div className="grid-2">
            <FormGroup label="Check-In Date">
              <input type="date" value={form.check_in_date} onChange={(e) => setForm({ ...form, check_in_date: e.target.value })} required />
            </FormGroup>
            <FormGroup label="Check-Out Date">
              <input type="date" value={form.check_out_date} onChange={(e) => setForm({ ...form, check_out_date: e.target.value })} required />
            </FormGroup>
            <FormGroup label="Adults">
              <input type="number" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} min={1} required />
            </FormGroup>
            <FormGroup label="Children">
              <input type="number" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} min={0} />
            </FormGroup>
          </div>
        </form>
      </Modal>

      {/* Check-In Modal */}
      <Modal
        open={!!showCheckin}
        onClose={() => setShowCheckin(null)}
        title={`Check In — ${showCheckin?.confirmation_number}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCheckin(null)}>Cancel</button>
            <button className="btn btn-success" disabled={!selectedRoom} onClick={handleCheckIn}>
              ✓ Complete Check-In
            </button>
          </>
        }
      >
        {showCheckin && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Badge status="CONFIRMED" /> Reservation confirmed
            </div>
            <FormGroup label="Assign Room (READY rooms only)">
              <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} required>
                <option value="">Select a ready room...</option>
                {rooms.filter((r) => r.room_type_id === showCheckin.room_type_id || true).map((r) => (
                  <option key={r.id} value={r.id}>Room {r.room_number} — {r.status}</option>
                ))}
              </select>
            </FormGroup>
            <div className="alert alert-info">
              ℹ️ Only READY, CLEAN, or AVAILABLE rooms can be used for check-in.
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
