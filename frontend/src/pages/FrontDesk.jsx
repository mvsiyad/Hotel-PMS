import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  PlaneLanding,
  PlaneTakeoff,
  Building2,
  Check,
  X,
  DoorOpen,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  getReservations,
  checkIn,
  checkOut,
  getRooms,
  getGuests,
} from '../services/api'
import { Badge, Currency, DateDisplay, LoadingOverlay } from '../components/UI'
import Topbar from '../components/Topbar'

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

  useEffect(() => {
    if (hotelId) load()
  }, [hotelId])

  const getGuestName = (id) => {
    const g = guests.find((g) => g.id === id)
    return g ? `${g.first_name} ${g.last_name}` : `Guest #${id}`
  }

  const handleCheckIn = async (res) => {
    if (!roomAssign) {
      toast.error('Please assign a room before proceeding')
      return
    }
    try {
      await checkIn(hotelId, res.id, { room_id: parseInt(roomAssign) })
      const roomNum = readyRooms.find((r) => r.id === parseInt(roomAssign))?.room_number
      toast.success(`${getGuestName(res.guest_id)} successfully checked in to Room ${roomNum}`)
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
      toast.success(`${getGuestName(res.guest_id)} checked out. Housekeeping task dispatched.`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Check-out failed')
    }
  }

  if (loading) return <LoadingOverlay />

  const tabs = [
    { key: 'arrivals', label: 'Expected Arrivals', icon: PlaneLanding, count: arrivals.length },
    { key: 'departures', label: 'Expected Departures', icon: PlaneTakeoff, count: departures.length },
    { key: 'inhouse', label: 'In-House Guests', icon: Building2, count: inHouse.length },
  ]

  const currentList = tab === 'arrivals' ? arrivals : tab === 'departures' ? departures : inHouse

  return (
    <div>
      <Topbar
        title="Front Desk Reception"
        subtitle={`Today: ${new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}`}
        actions={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--text-muted)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              padding: '5px 10px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <DoorOpen size={13} style={{ color: 'var(--gold)' }} />
            <span>
              <strong style={{ color: 'var(--text-primary)' }}>{readyRooms.length}</strong> rooms ready
            </span>
          </div>
        }
      />

      <div className="page-container">
        {/* KPI Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Today's Arrivals</span>
              <div className="stat-icon success">
                <PlaneLanding size={16} />
              </div>
            </div>
            <div className="stat-value">{arrivals.length}</div>
            <div className="stat-change">Awaiting guest check-in</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Today's Departures</span>
              <div className="stat-icon warning">
                <PlaneTakeoff size={16} />
              </div>
            </div>
            <div className="stat-value">{departures.length}</div>
            <div className="stat-change">Check-outs scheduled</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Currently In-House</span>
              <div className="stat-icon primary">
                <Building2 size={16} />
              </div>
            </div>
            <div className="stat-value">{inHouse.length}</div>
            <div className="stat-change">Active checked-in stays</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="tabs">
          {tabs.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                className={`tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <Icon size={14} />
                <span>{t.label}</span>
                {t.count > 0 && (
                  <span
                    style={{
                      background: 'var(--primary-tint)',
                      color: 'var(--primary)',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 999,
                      border: '1px solid var(--primary-glow)',
                    }}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Data Table */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Confirmation</th>
                <th>Guest</th>
                <th>Room Type</th>
                <th>Dates</th>
                <th>Total Value</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentList.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: 48,
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: 13.5,
                    }}
                  >
                    {tab === 'arrivals'
                      ? 'No arrivals remaining for today'
                      : tab === 'departures'
                      ? 'No departures remaining for today'
                      : 'No guests currently in-house'}
                  </td>
                </tr>
              ) : (
                currentList.map((res) => (
                  <tr key={res.id}>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          color: 'var(--primary)',
                          fontWeight: 600,
                        }}
                      >
                        {res.confirmation_number}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {getGuestName(res.guest_id)}
                      </strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>Room Type #{res.room_type_id}</td>
                    <td>
                      <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <DateDisplay date={res.check_in_date} />
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        <DateDisplay date={res.check_out_date} />
                      </div>
                    </td>
                    <td>
                      <Currency amount={res.total_amount} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {tab === 'arrivals' &&
                        (checkingIn?.id === res.id ? (
                          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                            <select
                              value={roomAssign}
                              onChange={(e) => setRoomAssign(e.target.value)}
                              style={{ width: 140, padding: '5px 8px', fontSize: 12 }}
                            >
                              <option value="">Assign Room...</option>
                              {readyRooms.map((r) => (
                                <option key={r.id} value={r.id}>
                                  Room {r.room_number}
                                </option>
                              ))}
                            </select>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleCheckIn(res)}
                            >
                              <Check size={13} />
                              <span>Complete</span>
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setCheckingIn(null)}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => {
                              setCheckingIn(res)
                              setRoomAssign('')
                            }}
                          >
                            <DoorOpen size={13} />
                            <span>Check In</span>
                          </button>
                        ))}
                      {tab === 'departures' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleCheckOut(res)}
                        >
                          <CheckCircle2 size={13} />
                          <span>Check Out</span>
                        </button>
                      )}
                      {tab === 'inhouse' && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <Badge status="CHECKED_IN" />
                          {res.room_id && (
                            <span
                              style={{
                                fontSize: 12,
                                color: 'var(--text-secondary)',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              Rm. {res.room_id}
                            </span>
                          )}
                        </div>
                      )}
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
