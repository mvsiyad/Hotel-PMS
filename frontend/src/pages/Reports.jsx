import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getRooms, getReservations, getHousekeeping, getMaintenance, getRoomServiceOrders } from '../services/api'
import { Badge, Currency, LoadingOverlay } from '../components/UI'

function MetricCard({ label, value, sublabel, color = 'primary', icon }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sublabel && <div className="stat-change">{sublabel}</div>}
    </div>
  )
}

function ProgressBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const barColor = color || (pct >= 80 ? '#ef4444' : pct >= 50 ? '#f59e0b' : '#22c55e')
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{value} / {max} ({pct}%)</span>
      </div>
      <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 4, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

export default function Reports() {
  const { hotelId } = useAuth()
  const [rooms, setRooms] = useState([])
  const [reservations, setReservations] = useState([])
  const [housekeeping, setHousekeeping] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30') // days

  const load = async () => {
    if (!hotelId) return
    setLoading(true)
    const [r, res, hk, maint, ord] = await Promise.all([
      getRooms(hotelId).catch(() => ({ data: [] })),
      getReservations(hotelId).catch(() => ({ data: [] })),
      getHousekeeping(hotelId).catch(() => ({ data: [] })),
      getMaintenance(hotelId).catch(() => ({ data: [] })),
      getRoomServiceOrders(hotelId).catch(() => ({ data: [] })),
    ])
    setRooms(r.data)
    setReservations(res.data)
    setHousekeeping(hk.data)
    setMaintenance(maint.data)
    setOrders(ord.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [hotelId])

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - parseInt(period))
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const filteredRes = reservations.filter(r => r.created_at >= cutoffStr || r.check_in_date >= cutoffStr)

  // Revenue
  const totalRevenue = filteredRes
    .filter(r => ['CHECKED_IN', 'CHECKED_OUT'].includes(r.status))
    .reduce((s, r) => s + (r.total_amount || 0), 0)
  const pendingRevenue = filteredRes
    .filter(r => r.status === 'CONFIRMED')
    .reduce((s, r) => s + (r.total_amount || 0), 0)
  const roomServiceRevenue = orders
    .filter(o => ['DELIVERED', 'IN_ROOM'].includes(o.status))
    .reduce((s, o) => s + (o.total_amount || 0), 0)

  // Occupancy
  const occupied = rooms.filter(r => r.status === 'OCCUPIED').length
  const available = rooms.filter(r => ['READY', 'AVAILABLE', 'CLEAN'].includes(r.status)).length
  const outOfOrder = rooms.filter(r => r.status === 'OUT_OF_ORDER').length
  const occupancyPct = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0

  // Status breakdown
  const statusCounts = {}
  rooms.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1 })

  // Reservation stats
  const byStatus = {}
  reservations.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1 })

  const cancelled = byStatus['CANCELLED'] || 0
  const noShow = byStatus['NO_SHOW'] || 0
  const confirmed = byStatus['CONFIRMED'] || 0
  const checkedIn = byStatus['CHECKED_IN'] || 0
  const checkedOut = byStatus['CHECKED_OUT'] || 0

  // Housekeeping
  const hkPending = housekeeping.filter(h => h.status === 'PENDING').length
  const hkInProgress = housekeeping.filter(h => h.status === 'IN_PROGRESS').length
  const hkCompleted = housekeeping.filter(h => ['APPROVED', 'CLEANED'].includes(h.status)).length

  // Maintenance
  const maintOpen = maintenance.filter(m => m.status === 'OPEN').length
  const maintInProgress = maintenance.filter(m => m.status === 'IN_PROGRESS').length
  const maintClosed = maintenance.filter(m => m.status === 'CLOSED').length

  if (loading) return <LoadingOverlay />

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Reports & Analytics</div>
          <div className="topbar-subtitle">Operational insights and performance metrics</div>
        </div>
        <div className="topbar-actions">
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            style={{ fontSize: 13 }}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>
      </div>

      <div className="page-container">
        {/* Revenue overview */}
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <MetricCard label="Revenue Earned" value={`$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon="💰" color="success" sublabel="Checked-in + checked-out bookings" />
          <MetricCard label="Pending Revenue" value={`$${pendingRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon="📋" color="warning" sublabel="Confirmed bookings" />
          <MetricCard label="Room Service" value={`$${roomServiceRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} icon="🍽️" color="primary" sublabel="F&B revenue" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Occupancy */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🛏️ Room Status Distribution</div>
              <div className="card-subtitle">Live snapshot of all {rooms.length} rooms</div>
            </div>
            <div style={{ marginTop: 8 }}>
              <ProgressBar label="Occupied" value={occupied} max={rooms.length} color="#6366f1" />
              <ProgressBar label="Available / Ready" value={available} max={rooms.length} color="#22c55e" />
              <ProgressBar label="Out of Order" value={outOfOrder} max={rooms.length} color="#ef4444" />
            </div>
            <div style={{ marginTop: 20, padding: '16px 0', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {Object.entries(statusCounts).map(([s, c]) => (
                <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 800 }}>{c}</span>
                  <Badge status={s} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, textAlign: 'center', fontSize: 36, fontWeight: 800, color: occupancyPct >= 70 ? '#22c55e' : 'var(--text-secondary)' }}>
              {occupancyPct}%
              <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginTop: 4 }}>Current Occupancy Rate</div>
            </div>
          </div>

          {/* Reservation funnel */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">📈 Reservation Breakdown</div>
              <div className="card-subtitle">{reservations.length} total reservations on record</div>
            </div>
            <div style={{ marginTop: 8 }}>
              {[
                { label: 'Confirmed (Upcoming)', value: confirmed, max: reservations.length, color: '#6366f1' },
                { label: 'Currently Checked In', value: checkedIn, max: reservations.length, color: '#22c55e' },
                { label: 'Checked Out', value: checkedOut, max: reservations.length, color: '#94a3b8' },
                { label: 'Cancelled', value: cancelled, max: reservations.length, color: '#f59e0b' },
                { label: 'No Show', value: noShow, max: reservations.length, color: '#ef4444' },
              ].map(item => (
                <ProgressBar key={item.label} {...item} />
              ))}
            </div>
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{reservations.length > 0 ? Math.round(((reservations.length - cancelled - noShow) / reservations.length) * 100) : 0}%</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Conversion Rate</div>
              </div>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>{reservations.length > 0 ? Math.round(((cancelled + noShow) / reservations.length) * 100) : 0}%</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cancellation Rate</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Housekeeping performance */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🧹 Housekeeping</div>
              <div className="card-subtitle">{housekeeping.length} total tasks</div>
            </div>
            <div style={{ marginTop: 8 }}>
              <ProgressBar label="Pending" value={hkPending} max={housekeeping.length || 1} color="#f59e0b" />
              <ProgressBar label="In Progress" value={hkInProgress} max={housekeeping.length || 1} color="#6366f1" />
              <ProgressBar label="Completed" value={hkCompleted} max={housekeeping.length || 1} color="#22c55e" />
            </div>
            {housekeeping.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: 13 }}>
                No housekeeping tasks recorded
              </div>
            )}
          </div>

          {/* Maintenance */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🔧 Maintenance</div>
              <div className="card-subtitle">{maintenance.length} total tickets</div>
            </div>
            <div style={{ marginTop: 8 }}>
              <ProgressBar label="Open" value={maintOpen} max={maintenance.length || 1} color="#ef4444" />
              <ProgressBar label="In Progress" value={maintInProgress} max={maintenance.length || 1} color="#f59e0b" />
              <ProgressBar label="Closed / Resolved" value={maintClosed} max={maintenance.length || 1} color="#22c55e" />
            </div>
            {maintenance.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: 13 }}>
                No maintenance tickets recorded
              </div>
            )}
          </div>
        </div>

        {/* Recent reservations by revenue */}
        <div className="table-container">
          <div className="table-header">
            <div className="table-title">Top Reservations by Value</div>
            <div className="table-subtitle">Highest-value bookings</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Confirmation</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Nights</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {[...reservations]
                .sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0))
                .slice(0, 10)
                .map(r => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--primary)' }}>
                        {r.confirmation_number}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{r.check_in_date}</td>
                    <td style={{ fontSize: 13 }}>{r.check_out_date}</td>
                    <td style={{ fontSize: 13, textAlign: 'center' }}>
                      {Math.max(1, Math.round((new Date(r.check_out_date) - new Date(r.check_in_date)) / 86400000))}
                    </td>
                    <td><Badge status={r.status} /></td>
                    <td><Currency amount={r.total_amount} /></td>
                  </tr>
                ))}
              {reservations.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 13 }}>
                    No reservations found. Run the demo seed to populate data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
