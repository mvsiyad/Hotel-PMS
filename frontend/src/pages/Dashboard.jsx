import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getRooms, getReservations, getHousekeeping, getMaintenance } from '../services/api'
import { Badge, Currency, DateDisplay, LoadingOverlay } from '../components/UI'

function StatCard({ label, value, icon, color = 'primary', sublabel }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
      {sublabel && <div className="stat-change">{sublabel}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { hotelId } = useAuth()
  const [rooms, setRooms] = useState([])
  const [reservations, setReservations] = useState([])
  const [housekeeping, setHousekeeping] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hotelId) return
    const load = async () => {
      const [r, res, hk, maint] = await Promise.all([
        getRooms(hotelId).catch(() => ({ data: [] })),
        getReservations(hotelId).catch(() => ({ data: [] })),
        getHousekeeping(hotelId).catch(() => ({ data: [] })),
        getMaintenance(hotelId).catch(() => ({ data: [] })),
      ])
      setRooms(r.data)
      setReservations(res.data)
      setHousekeeping(hk.data)
      setMaintenance(maint.data)
      setLoading(false)
    }
    load()
  }, [hotelId])

  const today = new Date().toISOString().split('T')[0]

  const todayArrivals = reservations.filter(
    (r) => r.check_in_date === today && r.status === 'CONFIRMED'
  )
  const todayDepartures = reservations.filter(
    (r) => r.check_out_date === today && r.status === 'CHECKED_IN'
  )
  const occupied = rooms.filter((r) => r.status === 'OCCUPIED').length
  const available = rooms.filter((r) => r.status === 'READY' || r.status === 'AVAILABLE').length
  const dirty = rooms.filter((r) => r.status === 'DIRTY').length
  const outOfOrder = rooms.filter((r) => r.status === 'OUT_OF_ORDER').length
  const pendingHk = housekeeping.filter((t) => ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)).length
  const openMaint = maintenance.filter((m) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(m.status)).length
  const occupancyPct = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0

  const recentReservations = [...reservations]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8)

  if (loading) return <LoadingOverlay />

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Dashboard</div>
          <div className="topbar-subtitle">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div className="topbar-actions">
          <span className="badge badge-ACTIVE" style={{ fontSize: 12 }}>🟢 System Online</span>
        </div>
      </div>

      <div className="page-container">
        {/* Occupancy Overview */}
        <div className="stat-grid">
          <StatCard label="Occupancy Rate" value={`${occupancyPct}%`} icon="📊" color="primary"
            sublabel={`${occupied} / ${rooms.length} rooms`} />
          <StatCard label="Today's Arrivals" value={todayArrivals.length} icon="🛬" color="success" />
          <StatCard label="Today's Departures" value={todayDepartures.length} icon="🛫" color="warning" />
          <StatCard label="Available Rooms" value={available} icon="✅" color="success" />
          <StatCard label="Dirty Rooms" value={dirty} icon="🧹" color="warning" />
          <StatCard label="Out of Order" value={outOfOrder} icon="⛔" color="danger" />
          <StatCard label="Pending Housekeeping" value={pendingHk} icon="🫧" color="purple" />
          <StatCard label="Open Maintenance" value={openMaint} icon="🔧" color="gold" />
        </div>

        {/* Room Status Quick View */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Room Status Overview</div>
              <div className="card-subtitle">All {rooms.length} rooms</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['READY', 'AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED', 'MAINTENANCE', 'OUT_OF_ORDER'].map((status) => {
              const count = rooms.filter((r) => r.status === status).length
              if (count === 0) return null
              return (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-tertiary)', padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <Badge status={status} />
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Reservations */}
        <div className="table-container">
          <div className="table-header">
            <div className="table-title">Recent Reservations</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Confirmation</th>
                <th>Guest ID</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentReservations.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No reservations yet</td></tr>
              )}
              {recentReservations.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--primary)' }}>
                      {r.confirmation_number}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>#{r.guest_id}</td>
                  <td><DateDisplay date={r.check_in_date} /></td>
                  <td><DateDisplay date={r.check_out_date} /></td>
                  <td><Badge status={r.status} /></td>
                  <td><Currency amount={r.total_amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
