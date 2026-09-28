import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import {
  getRooms, getRoomTypes, createRoom, updateRoomStatus
} from '../services/api'
import { Badge, Modal, FormGroup, EmptyState, LoadingOverlay } from '../components/UI'

const STATUSES = ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED', 'READY', 'OUT_OF_ORDER', 'MAINTENANCE']

export default function Rooms() {
  const { hotelId } = useAuth()
  const [rooms, setRooms] = useState([])
  const [roomTypes, setRoomTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [floorFilter, setFloorFilter] = useState('')
  const [view, setView] = useState('board') // board | table
  const [showCreate, setShowCreate] = useState(false)
  const [showStatus, setShowStatus] = useState(null) // room
  const [newRoom, setNewRoom] = useState({ room_number: '', room_type_id: '', floor: 1 })
  const [newStatus, setNewStatus] = useState('')

  const load = async () => {
    const [r, rt] = await Promise.all([
      getRooms(hotelId).catch(() => ({ data: [] })),
      getRoomTypes(hotelId).catch(() => ({ data: [] })),
    ])
    setRooms(r.data)
    setRoomTypes(rt.data)
    setLoading(false)
  }

  useEffect(() => { if (hotelId) load() }, [hotelId])

  const filtered = rooms.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false
    if (floorFilter && r.floor !== parseInt(floorFilter)) return false
    return true
  })

  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b)

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createRoom(hotelId, { ...newRoom, room_type_id: parseInt(newRoom.room_type_id), floor: parseInt(newRoom.floor) })
      toast.success('Room created')
      setShowCreate(false)
      setNewRoom({ room_number: '', room_type_id: '', floor: 1 })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create room')
    }
  }

  const handleStatusUpdate = async () => {
    try {
      await updateRoomStatus(hotelId, showStatus.id, { status: newStatus })
      toast.success(`Room ${showStatus.room_number} → ${newStatus}`)
      setShowStatus(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid transition')
    }
  }

  const getRoomTypeName = (id) => roomTypes.find((rt) => rt.id === id)?.name || 'Unknown'

  if (loading) return <LoadingOverlay />

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Rooms</div>
          <div className="topbar-subtitle">{rooms.length} rooms total</div>
        </div>
        <div className="topbar-actions">
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab ${view === 'board' ? 'active' : ''}`} onClick={() => setView('board')}>🟦 Board</button>
            <button className={`tab ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>≡ Table</button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Add Room</button>
        </div>
      </div>

      <div className="page-container">
        {/* Filters */}
        <div className="filter-bar">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 180 }}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} style={{ width: 140 }}>
            <option value="">All Floors</option>
            {floors.map((f) => <option key={f} value={f}>Floor {f}</option>)}
          </select>
          {(statusFilter || floorFilter) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setStatusFilter(''); setFloorFilter('') }}>Clear</button>
          )}
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }}>
            {filtered.length} rooms
          </span>
        </div>

        {view === 'board' ? (
          floors
            .filter((f) => !floorFilter || f === parseInt(floorFilter))
            .map((floor) => {
              const floorRooms = filtered.filter((r) => r.floor === floor)
              if (floorRooms.length === 0) return null
              return (
                <div key={floor} style={{ marginBottom: 28 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Floor {floor}
                  </div>
                  <div className="room-board">
                    {floorRooms.map((room) => (
                      <div
                        key={room.id}
                        className={`room-card status-${room.status}`}
                        onClick={() => { setShowStatus(room); setNewStatus(room.status) }}
                      >
                        <div className="room-number">{room.room_number}</div>
                        <div className="room-type">{getRoomTypeName(room.room_type_id)}</div>
                        <div style={{ marginTop: 8 }}>
                          <Badge status={room.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Floor</th>
                  <th>Type</th>
                  <th>Occupancy</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No rooms found</td></tr>
                )}
                {filtered.map((room) => (
                  <tr key={room.id}>
                    <td><strong>{room.room_number}</strong></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{room.floor}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{getRoomTypeName(room.room_type_id)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>Max {room.occupancy_limit}</td>
                    <td><Badge status={room.status} /></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setShowStatus(room); setNewStatus(room.status) }}>
                        Change Status
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add New Room"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" form="create-room-form" type="submit">Create Room</button>
          </>
        }
      >
        <form id="create-room-form" onSubmit={handleCreate}>
          <div className="grid-2">
            <FormGroup label="Room Number">
              <input value={newRoom.room_number} onChange={(e) => setNewRoom({ ...newRoom, room_number: e.target.value })} placeholder="101" required />
            </FormGroup>
            <FormGroup label="Floor">
              <input type="number" value={newRoom.floor} onChange={(e) => setNewRoom({ ...newRoom, floor: e.target.value })} min={1} required />
            </FormGroup>
          </div>
          <FormGroup label="Room Type">
            <select value={newRoom.room_type_id} onChange={(e) => setNewRoom({ ...newRoom, room_type_id: e.target.value })} required>
              <option value="">Select room type...</option>
              {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name} (${rt.base_rate}/night)</option>)}
            </select>
          </FormGroup>
        </form>
      </Modal>

      {/* Status Update Modal */}
      <Modal
        open={!!showStatus}
        onClose={() => setShowStatus(null)}
        title={`Room ${showStatus?.room_number} — Update Status`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowStatus(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={newStatus === showStatus?.status} onClick={handleStatusUpdate}>
              Update Status
            </button>
          </>
        }
      >
        {showStatus && (
          <>
            <div style={{ marginBottom: 16 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Current: </span>
              <Badge status={showStatus.status} />
            </div>
            <FormGroup label="New Status">
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormGroup>
            <div className="alert alert-warning">
              ⚠️ Only valid FSM transitions are permitted. Invalid transitions will be rejected.
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
