import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import {
  getReservations, checkIn, checkOut, getRooms, getGuests
} from '../services/api'
import { Badge, Currency, DateDisplay, LoadingOverlay } from '../components/UI'

export default function FrontDesk() {
  const { hotelId } = useAuth()
  const [arrivals, setArrivals] = useState([])
  const [departures, setDepartures] = useState([])
  const [inHouse, setInHouse] = useState([])
  const [readyRooms, setReadyRooms] = useState([])
  const [guests, setGuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('arrivals')
  const [checkingIn, setCheckingIn] = useState(null)
  const [roomAssign, setRoomAssign] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const load = async () => {
    const [res, rooms, g] = await Promise.all([
      getReservations(hotelId).catch(() => ({ data: [] })),
      getRooms(hotelId).catch(() => ({ data: [] })),
      getGuests(hotelId).catch(() => ({ data: [] })),
    ])
    const all = res.data
    setArrivals(all.filter((r) => r.check_in_date === today && r.status === 'CONFIRMED'))
    setDepartures(all.filter((r) => r.check_out_date === today && r.status === 'CHECKED_IN'))
    setInHouse(all.filter((r) => r.status === 'CHECKED_IN'))
    setReadyRooms(rooms.data.filter((r) => ['READY', 'AVAILABLE', 'CLEAN'].includes(r.status)))
    setGuests(g.data)
    setLoading(false)
  }

  useEffect(() => { if (hotelId) load() }, [hotelId])

  const getGuestName = (id) => {
    const g = guests.find((g) => g.id === id)
    return g ? `${g.first_name} ${g.last_name}` : `Guest #${id}`
  }

  const handleCheckIn = async (res) => {
    if (!roomAssign) { toast.error('Please select a room'); return }
    try {
      await checkIn(hotelId, res.id, { room_id: parseInt(roomAssign) })
      toast.success(`✓ ${getGuestName(res.guest_id)} checked in to Room ${readyRooms.find(r=>r.id===parseInt(roomAssign))?.room_number}`)
      setCheckingIn(null)
      setRoomAssign('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Check-in failed')
    }
  }

  const handleCheckOut = async (res) => {
    try {
      await checkOut(hotelId, res.id, {})
      toast.success(`✓ ${getGuestName(res.guest_id)} checked out. Housekeeping task created.`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Check-out failed')
    }
  }

  if (loading) return <LoadingOverlay />

  const tabs = [
    { key: 'arrivals', label: '🛬 Arrivals', count: arrivals.length },
    { key: 'departures', label: '🛫 Departures', count: departures.length },
    { key: 'inhouse', label: '🏠 In-House', count: inHouse.length },
  ]

  const currentList = tab === 'arrivals' ? arrivals : tab === 'departures' ? departures : inHouse

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Front Desk</div>
          <div className="topbar-subtitle">
            Today: {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div className="topbar-actions">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{readyRooms.length} rooms ready</span>
        </div>
      </div>

      <div className="page-container">
        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: "Today's Arrivals", value: arrivals.length, color: 'success', icon: '🛬' },
            { label: "Today's Departures", value: departures.length, color: 'warning', icon: '🛫' },
            { label: "Currently In-House", value: inHouse.length, color: 'primary', icon: '🏠' },
          ].map((s) => (
            <div key={s.label} className={`stat-card ${s.color}`}>
              <div className={`stat-icon ${s.color}`}>{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label} {t.count > 0 && <span className="sidebar-badge" style={{ marginLeft: 6 }}>{t.count}</span>}
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
                <th>Dates</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {currentList.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                    {tab === 'arrivals' ? '🎉 No arrivals expected today' :
                      tab === 'departures' ? '✨ No departures today' :
                        '🏨 No guests currently in-house'}
                  </td>
                </tr>
              )}
              {currentList.map((res) => (
                <tr key={res.id}>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--primary)' }}>
                      {res.confirmation_number}
                    </span>
                  </td>
                  <td><strong>{getGuestName(res.guest_id)}</strong></td>
                  <td style={{ color: 'var(--text-secondary)' }}>Room Type #{res.room_type_id}</td>
                  <td>
                    <div style={{ fontSize: 12 }}>
                      <DateDisplay date={res.check_in_date} /> → <DateDisplay date={res.check_out_date} />
                    </div>
                  </td>
                  <td><Currency amount={res.total_amount} /></td>
                  <td>
                    {tab === 'arrivals' && (
                      checkingIn?.id === res.id ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <select value={roomAssign} onChange={(e) => setRoomAssign(e.target.value)} style={{ width: 150 }}>
                            <option value="">Pick room...</option>
                            {readyRooms.map((r) => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
                          </select>
                          <button className="btn btn-success btn-sm" onClick={() => handleCheckIn(res)}>✓ Check In</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setCheckingIn(null)}>✕</button>
                        </div>
                      ) : (
                        <button className="btn btn-success btn-sm" onClick={() => { setCheckingIn(res); setRoomAssign('') }}>
                          Check In
                        </button>
                      )
                    )}
                    {tab === 'departures' && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleCheckOut(res)}>
                        Check Out
                      </button>
                    )}
                    {tab === 'inhouse' && (
                      <div>
                        <Badge status="CHECKED_IN" />
                        {res.room_id && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>Rm. #{res.room_id}</span>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
