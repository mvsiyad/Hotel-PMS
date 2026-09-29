import { useState, useEffect } from 'react'
import {
  BarChart3,
  PlaneLanding,
  PlaneTakeoff,
  CheckCircle2,
  Sparkles,
  AlertOctagon,
  Brush,
  Wrench,
  BedDouble,
  ArrowUpRight
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getRooms, getReservations, getHousekeeping, getMaintenance } from '../services/api'
import { Badge, Currency, DateDisplay, LoadingOverlay } from '../components/UI'
import Topbar from '../components/Topbar'

function StatCard({ label, value, icon, color = 'primary', sublabel }) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-label">{label}</span>
        <div className={`stat-icon ${color}`}>{icon}</div>
      </div>
      <div className="stat-value">{value ?? '—'}</div>
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
      <Topbar
        title="Operations Dashboard"
        subtitle={new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      />

      <div className="page-container">
        {/* KPI Metrics Grid */}
        <div className="stat-grid">
          <StatCard
            label="Occupancy Rate"
            value={`${occupancyPct}%`}
            icon={<BarChart3 size={16} />}
            color="primary"
            sublabel={`${occupied} of ${rooms.length} rooms occupied`}
          />
          <StatCard
            label="Today's Arrivals"
            value={todayArrivals.length}
            icon={<PlaneLanding size={16} />}
            color="success"
            sublabel="Scheduled check-ins"
          />
          <StatCard
            label="Today's Departures"
            value={todayDepartures.length}
            icon={<PlaneTakeoff size={16} />}
            color="warning"
            sublabel="Pending check-outs"
          />
          <StatCard
            label="Available Rooms"
            value={available}
            icon={<CheckCircle2 size={16} />}
            color="success"
            sublabel="Ready for guest check-in"
          />
          <StatCard
            label="Dirty Rooms"
            value={dirty}
            icon={<Sparkles size={16} />}
            color="warning"
            sublabel="Turnaround needed"
          />
          <StatCard
            label="Out of Order"
            value={outOfOrder}
            icon={<AlertOctagon size={16} />}
            color="danger"
            sublabel="Offline inventory"
          />
          <StatCard
            label="Pending Housekeeping"
            value={pendingHk}
            icon={<Brush size={16} />}
            color="purple"
            sublabel="Active cleaning tasks"
          />
          <StatCard
            label="Open Maintenance"
            value={openMaint}
            icon={<Wrench size={16} />}
            color="gold"
            sublabel="Work orders awaiting resolution"
          />
        </div>

        {/* Room Status Quick View */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Room Inventory Status</div>
              <div className="card-subtitle">Real-time status breakdown across {rooms.length} total units</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              'READY',
              'AVAILABLE',
              'OCCUPIED',
              'RESERVED',
              'DIRTY',
              'CLEANING',
              'CLEAN',
              'INSPECTED',
              'MAINTENANCE',
              'OUT_OF_ORDER',
            ].map((status) => {
              const count = rooms.filter((r) => r.status === status).length
              if (count === 0) return null
              return (
                <div
                  key={status}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--bg-tertiary)',
                    padding: '7px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <Badge status={status} />
                  <span style={{ fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Reservations Table */}
        <div className="table-container">
          <div className="table-header">
            <div>
              <div className="table-title">Recent Reservations</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Latest bookings synced into the PMS core
              </div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Confirmation</th>
                <th>Guest ID</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Status</th>
                <th>Total Value</th>
              </tr>
            </thead>
            <tbody>
              {recentReservations.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '36px 16px' }}>
                    No reservations found for this property
                  </td>
                </tr>
              ) : (
                recentReservations.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          color: 'var(--primary)',
                          fontWeight: 600,
                        }}
                      >
                        {r.confirmation_number}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>Guest #{r.guest_id}</td>
                    <td>
                      <DateDisplay date={r.check_in_date} />
                    </td>
                    <td>
                      <DateDisplay date={r.check_out_date} />
                    </td>
                    <td>
                      <Badge status={r.status} />
                    </td>
                    <td>
                      <Currency amount={r.total_amount} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
