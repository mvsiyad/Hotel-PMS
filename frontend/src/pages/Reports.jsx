import { useState, useEffect } from 'react'
import {
  DollarSign,
  CalendarCheck,
  UtensilsCrossed,
  BedDouble,
  TrendingUp,
  Sparkles,
  Wrench,
  BarChart3,
  Calendar
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  getRooms,
  getReservations,
  getHousekeeping,
  getMaintenance,
  getRoomServiceOrders,
} from '../services/api'
import { Badge, Currency, LoadingOverlay } from '../components/UI'
import Topbar from '../components/Topbar'

function MetricCard({ label, value, sublabel, color = 'primary', icon }) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-label">{label}</span>
        <div className={`stat-icon ${color}`}>{icon}</div>
      </div>
      <div className="stat-value">{value}</div>
      {sublabel && <div className="stat-change">{sublabel}</div>}
    </div>
  )
}

function ProgressBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const barColor = color || (pct >= 80 ? 'var(--danger)' : pct >= 50 ? 'var(--warning)' : 'var(--success)')
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {value} / {max} ({pct}%)
        </span>
      </div>
      <div
        style={{
          height: 7,
          background: 'var(--bg-tertiary)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: barColor,
            borderRadius: 999,
            transition: 'width 0.8s ease',
          }}
        />
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
  const [period, setPeriod] = useState('30')

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

  useEffect(() => {
    load()
  }, [hotelId])

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - parseInt(period))
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const filteredRes = reservations.filter(
    (r) => r.created_at >= cutoffStr || r.check_in_date >= cutoffStr
  )

  const totalRevenue = filteredRes
    .filter((r) => ['CHECKED_IN', 'CHECKED_OUT'].includes(r.status))
    .reduce((s, r) => s + (r.total_amount || 0), 0)
  const pendingRevenue = filteredRes
    .filter((r) => r.status === 'CONFIRMED')
    .reduce((s, r) => s + (r.total_amount || 0), 0)
  const roomServiceRevenue = orders
    .filter((o) => ['DELIVERED', 'IN_ROOM'].includes(o.status))
    .reduce((s, o) => s + (o.total_amount || 0), 0)

  const occupied = rooms.filter((r) => r.status === 'OCCUPIED').length
  const available = rooms.filter((r) => ['READY', 'AVAILABLE', 'CLEAN'].includes(r.status)).length
  const outOfOrder = rooms.filter((r) => r.status === 'OUT_OF_ORDER').length
  const occupancyPct = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0

  const statusCounts = {}
  rooms.forEach((r) => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1
  })

  const byStatus = {}
  reservations.forEach((r) => {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1
  })

  const cancelled = byStatus['CANCELLED'] || 0
  const noShow = byStatus['NO_SHOW'] || 0
  const confirmed = byStatus['CONFIRMED'] || 0
  const checkedIn = byStatus['CHECKED_IN'] || 0
  const checkedOut = byStatus['CHECKED_OUT'] || 0

  const hkPending = housekeeping.filter((h) => h.status === 'PENDING').length
  const hkInProgress = housekeeping.filter((h) => h.status === 'IN_PROGRESS').length
  const hkCompleted = housekeeping.filter((h) => ['APPROVED', 'CLEANED'].includes(h.status)).length

  const maintOpen = maintenance.filter((m) => m.status === 'OPEN').length
  const maintInProgress = maintenance.filter((m) => m.status === 'IN_PROGRESS').length
  const maintClosed = maintenance.filter((m) => m.status === 'CLOSED').length

  if (loading) return <LoadingOverlay />

  return (
    <div>
      <Topbar
        title="Business Intelligence & Analytics"
        subtitle="Operational metrics, yield management, and performance telemetry"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{ fontSize: 12.5, width: 150 }}
            >
              <option value="7">Trailing 7 Days</option>
              <option value="30">Trailing 30 Days</option>
              <option value="90">Trailing Quarter</option>
              <option value="365">Trailing Year</option>
            </select>
          </div>
        }
      />

      <div className="page-container">
        {/* Revenue Overview */}
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <MetricCard
            label="Realized Revenue"
            value={`$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            icon={<DollarSign size={16} />}
            color="success"
            sublabel="Checked-in and completed stays"
          />
          <MetricCard
            label="Pipeline Revenue"
            value={`$${pendingRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            icon={<CalendarCheck size={16} />}
            color="warning"
            sublabel="Confirmed upcoming bookings"
          />
          <MetricCard
            label="F&B Dining Revenue"
            value={`$${roomServiceRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            icon={<UtensilsCrossed size={16} />}
            color="primary"
            sublabel="Room service orders delivered"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Occupancy Breakdown */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Room Inventory Utilization</div>
                <div className="card-subtitle">Real-time status breakdown of {rooms.length} units</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <ProgressBar label="Occupied" value={occupied} max={rooms.length} color="var(--primary)" />
              <ProgressBar label="Available & Ready" value={available} max={rooms.length} color="var(--success)" />
              <ProgressBar label="Out of Order" value={outOfOrder} max={rooms.length} color="var(--danger)" />
            </div>
            <div
              style={{
                marginTop: 20,
                padding: '16px 0',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              {Object.entries(statusCounts).map(([s, c]) => (
                <div
                  key={s}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                >
                  <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {c}
                  </span>
                  <Badge status={s} />
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 16,
                textAlign: 'center',
                fontSize: 34,
                fontWeight: 800,
                color: occupancyPct >= 70 ? 'var(--success)' : 'var(--text-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {occupancyPct}%
              <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginTop: 4 }}>
                Occupancy Ratio
              </div>
            </div>
          </div>

          {/* Reservation Funnel */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Booking Conversion & Retention</div>
                <div className="card-subtitle">{reservations.length} total bookings tracked</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              {[
                { label: 'Confirmed (Scheduled)', value: confirmed, max: reservations.length, color: 'var(--primary)' },
                { label: 'Currently In-House', value: checkedIn, max: reservations.length, color: 'var(--success)' },
                { label: 'Checked Out', value: checkedOut, max: reservations.length, color: 'var(--text-muted)' },
                { label: 'Cancelled', value: cancelled, max: reservations.length, color: 'var(--warning)' },
                { label: 'No Show', value: noShow, max: reservations.length, color: 'var(--danger)' },
              ].map((item) => (
                <ProgressBar key={item.label} {...item} />
              ))}
            </div>
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div
                style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  textAlign: 'center',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>
                  {reservations.length > 0
                    ? Math.round(
                        ((reservations.length - cancelled - noShow) / reservations.length) * 100
                      )
                    : 0}
                  %
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Realization Rate</div>
              </div>
              <div
                style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  textAlign: 'center',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--warning)' }}>
                  {reservations.length > 0
                    ? Math.round(((cancelled + noShow) / reservations.length) * 100)
                    : 0}
                  %
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cancellation Rate</div>
              </div>
            </div>
          </div>
        </div>

        {/* Operational Efficiency */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Housekeeping Turnaround Queue</div>
                <div className="card-subtitle">{housekeeping.length} tasks recorded</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <ProgressBar label="Pending Assignment" value={hkPending} max={housekeeping.length || 1} color="var(--warning)" />
              <ProgressBar label="In Progress" value={hkInProgress} max={housekeeping.length || 1} color="var(--primary)" />
              <ProgressBar label="Completed & Approved" value={hkCompleted} max={housekeeping.length || 1} color="var(--success)" />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Maintenance Resolution Queue</div>
                <div className="card-subtitle">{maintenance.length} work orders filed</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <ProgressBar label="Open Work Orders" value={maintOpen} max={maintenance.length || 1} color="var(--danger)" />
              <ProgressBar label="Under Active Repair" value={maintInProgress} max={maintenance.length || 1} color="var(--warning)" />
              <ProgressBar label="Closed & Verified" value={maintClosed} max={maintenance.length || 1} color="var(--success)" />
            </div>
          </div>
        </div>

        {/* Top Reservations Table */}
        <div className="table-container">
          <div className="table-header">
            <div>
              <div className="table-title">Top Reservations by Yield</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Highest gross booking value
              </div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Confirmation</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Stay Duration</th>
                <th>Status</th>
                <th>Total Value</th>
              </tr>
            </thead>
            <tbody>
              {[...reservations]
                .sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0))
                .slice(0, 10)
                .map((r) => (
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
                    <td>{r.check_in_date}</td>
                    <td>{r.check_out_date}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {Math.max(
                        1,
                        Math.round(
                          (new Date(r.check_out_date) - new Date(r.check_in_date)) / 86400000
                        )
                      )}{' '}
                      nights
                    </td>
                    <td>
                      <Badge status={r.status} />
                    </td>
                    <td>
                      <Currency amount={r.total_amount} />
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
