import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import {
  getHousekeeping, createHousekeepingTask, updateHousekeepingTask, inspectTask,
  getRooms, getStaff
} from '../services/api'
import { Badge, Modal, FormGroup, DateTimeDisplay, LoadingOverlay } from '../components/UI'

// Full FSM matching backend
const TRANSITIONS = {
  PENDING:            ['ASSIGNED', 'IN_PROGRESS'],
  ASSIGNED:           ['IN_PROGRESS'],
  IN_PROGRESS:        ['CLEANED'],
  CLEANED:            ['INSPECTION_PENDING'],
  INSPECTION_PENDING: [], // supervisor-only via inspect endpoint
  APPROVED:           [],
  REJECTED:           ['IN_PROGRESS'],
}

const TRANSITION_LABELS = {
  ASSIGNED:           { label: '📋 Assign',        cls: 'btn-secondary' },
  IN_PROGRESS:        { label: '🧹 Start Cleaning', cls: 'btn-warning'   },
  CLEANED:            { label: '✅ Mark Cleaned',   cls: 'btn-success'   },
  INSPECTION_PENDING: { label: '🔍 Request Inspection', cls: 'btn-gold'  },
}

const PRIORITY_COLOR = { LOW: '#6b7280', MEDIUM: '#f59e0b', HIGH: '#ef4444', URGENT: '#dc2626' }

const ROOM_STATUS_COLOR = {
  DIRTY:    '#ef4444', CLEANING: '#f59e0b', CLEAN: '#10b981',
  READY:    '#22c55e', OCCUPIED: '#3b82f6', AVAILABLE: '#22c55e',
  OUT_OF_ORDER: '#6b7280',
}

const COLS = [
  { key: 'PENDING',            label: '📥 Pending',          color: '#6b7280' },
  { key: 'ASSIGNED',           label: '👤 Assigned',         color: '#8b5cf6' },
  { key: 'IN_PROGRESS',        label: '🧹 Cleaning',         color: '#f59e0b' },
  { key: 'CLEANED',            label: '✨ Cleaned',           color: '#10b981' },
  { key: 'INSPECTION_PENDING', label: '🔍 Inspection',       color: '#3b82f6' },
  { key: 'APPROVED',           label: '✅ Approved',          color: '#22c55e' },
  { key: 'REJECTED',           label: '❌ Rejected',          color: '#ef4444' },
]

export default function Housekeeping() {
  const { hotelId } = useAuth()
  const [tasks, setTasks]       = useState([])
  const [rooms, setRooms]       = useState([])
  const [staff, setStaff]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [view, setView]         = useState('kanban') // 'kanban' | 'table'
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreate, setShowCreate]   = useState(false)
  const [showInspect, setShowInspect] = useState(null)
  const [showAssign, setShowAssign]   = useState(null)
  const [inspectApprove, setInspectApprove]   = useState(true)
  const [rejectReason, setRejectReason]       = useState('')
  const [assignStaffId, setAssignStaffId]     = useState('')
  const [form, setForm] = useState({
    room_id: '', task_type: 'CHECKOUT', priority: 'HIGH',
    assigned_staff_id: '', notes: '',
  })

  const load = useCallback(async () => {
    if (!hotelId) return
    try {
      const [t, r, s] = await Promise.all([
        getHousekeeping(hotelId, filterStatus ? { status: filterStatus } : {}),
        getRooms(hotelId),
        getStaff(hotelId),
      ])
      setTasks(t.data)
      setRooms(r.data)
      setStaff(s.data)
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [hotelId, filterStatus])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const getRoom   = (id) => rooms.find((r) => r.id === id)
  const getRoomNum = (id) => getRoom(id)?.room_number || `#${id}`
  const getRoomStatus = (id) => getRoom(id)?.status || 'UNKNOWN'
  const getStaffName = (id) => {
    const s = staff.find((s) => s.id === id)
    return s ? `${s.first_name} ${s.last_name}` : id ? `Staff #${id}` : '—'
  }
  const hkStaff = staff.filter((s) => ['HOUSEKEEPING', 'SUPERVISOR', 'HOTEL_MANAGER'].includes(s.role))

  const handleTransition = async (task, status) => {
    try {
      await updateHousekeepingTask(hotelId, task.id, { status })
      const msgs = {
        IN_PROGRESS: `🧹 Room ${getRoomNum(task.room_id)} cleaning started`,
        CLEANED: `✨ Room ${getRoomNum(task.room_id)} marked cleaned`,
        INSPECTION_PENDING: `🔍 Inspection requested for Room ${getRoomNum(task.room_id)}`,
        ASSIGNED: '📋 Task assigned',
      }
      toast.success(msgs[status] || `Status → ${status}`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Transition failed')
    }
  }

  const handleAssign = async () => {
    if (!assignStaffId) return toast.error('Select a staff member')
    try {
      await updateHousekeepingTask(hotelId, showAssign.id, {
        status: 'ASSIGNED',
        assigned_staff_id: parseInt(assignStaffId),
      })
      toast.success(`Task assigned to ${getStaffName(parseInt(assignStaffId))}`)
      setShowAssign(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Assignment failed')
    }
  }

  const handleInspect = async () => {
    try {
      await inspectTask(hotelId, showInspect.id, {
        approved: inspectApprove,
        rejection_reason: inspectApprove ? undefined : rejectReason,
      })
      toast.success(
        inspectApprove
          ? `✅ Room ${getRoomNum(showInspect.room_id)} APPROVED — now READY`
          : `❌ Room ${getRoomNum(showInspect.room_id)} REJECTED — needs re-cleaning`
      )
      setShowInspect(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Inspection failed')
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createHousekeepingTask(hotelId, {
        ...form,
        room_id: parseInt(form.room_id),
        assigned_staff_id: form.assigned_staff_id ? parseInt(form.assigned_staff_id) : null,
      })
      toast.success('Task created')
      setShowCreate(false)
      setForm({ room_id: '', task_type: 'CHECKOUT', priority: 'HIGH', assigned_staff_id: '', notes: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create task')
    }
  }

  if (loading) return <LoadingOverlay />

  const statuses = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED', 'INSPECTION_PENDING', 'APPROVED', 'REJECTED']
  const counts = Object.fromEntries(statuses.map((s) => [s, tasks.filter((t) => t.status === s).length]))
  const dirtyRooms = rooms.filter((r) => r.status === 'DIRTY')

  return (
    <div>
      {/* Top bar */}
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Housekeeping</div>
          <div className="topbar-subtitle">{tasks.length} tasks · {dirtyRooms.length} rooms need cleaning</div>
        </div>
        <div className="topbar-actions">
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab ${view === 'kanban' ? 'active' : ''}`} onClick={() => setView('kanban')}>⬛ Board</button>
            <button className={`tab ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>☰ Table</button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New Task</button>
        </div>
      </div>

      <div className="page-container">

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Dirty Rooms', value: dirtyRooms.length, icon: '🚨', color: 'danger' },
            { label: 'In Progress', value: counts.IN_PROGRESS + counts.ASSIGNED + counts.PENDING, icon: '🧹', color: 'warning' },
            { label: 'Pending Inspection', value: counts.INSPECTION_PENDING, icon: '🔍', color: 'gold' },
            { label: 'Completed', value: counts.APPROVED, icon: '✅', color: 'success' },
          ].map((s) => (
            <div key={s.label} className={`stat-card ${s.color}`}>
              <div className={`stat-icon ${s.color}`}>{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Dirty rooms banner */}
        {dirtyRooms.length > 0 && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>🚨 Rooms Needing Cleaning:</span>
            {dirtyRooms.map((r) => (
              <span key={r.id} style={{
                background: 'rgba(239,68,68,0.2)', color: '#ef4444',
                padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              }}>
                Room {r.room_number}
              </span>
            ))}
          </div>
        )}

        {/* ── KANBAN VIEW ─────────────────────────────────────────────────── */}
        {view === 'kanban' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12, minHeight: 400 }}>
            {COLS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.key)
              return (
                <div key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Column header */}
                  <div style={{
                    padding: '8px 12px', borderRadius: 8,
                    background: `${col.color}22`, border: `1px solid ${col.color}44`,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 12, color: col.color, fontWeight: 700 }}>{col.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: col.color }}>{colTasks.length}</div>
                  </div>

                  {/* Task cards */}
                  {colTasks.map((task) => {
                    const nextSteps = TRANSITIONS[task.status] || []
                    const room = getRoom(task.room_id)
                    return (
                      <div key={task.id} style={{
                        background: 'var(--surface-2)', borderRadius: 10,
                        padding: '10px 12px', border: '1px solid var(--border)',
                        borderLeft: `3px solid ${PRIORITY_COLOR[task.priority] || '#6b7280'}`,
                        cursor: 'default',
                      }}>
                        {/* Room + priority */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>Rm. {getRoomNum(task.room_id)}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
                            background: `${PRIORITY_COLOR[task.priority]}22`,
                            color: PRIORITY_COLOR[task.priority],
                          }}>{task.priority}</span>
                        </div>

                        {/* Task type */}
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                          {task.task_type.replace('_', ' ')}
                        </div>

                        {/* Room current status pill */}
                        {room && (
                          <div style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                            display: 'inline-block', marginBottom: 6,
                            background: `${ROOM_STATUS_COLOR[room.status] || '#6b7280'}22`,
                            color: ROOM_STATUS_COLOR[room.status] || '#6b7280',
                          }}>
                            Room: {room.status}
                          </div>
                        )}

                        {/* Assigned staff */}
                        {task.assigned_staff_id ? (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                            👤 {getStaffName(task.assigned_staff_id)}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 6 }}>⚠ Unassigned</div>
                        )}

                        {/* Notes snippet */}
                        {task.notes && (
                          <div style={{
                            fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic',
                            marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          }}>
                            {task.notes}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                          {task.status === 'PENDING' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              onClick={() => { setShowAssign(task); setAssignStaffId('') }}
                            >
                              👤 Assign Staff
                            </button>
                          )}
                          {nextSteps.filter((s) => s !== 'ASSIGNED').map((s) => {
                            const meta = TRANSITION_LABELS[s] || { label: `→ ${s}`, cls: 'btn-secondary' }
                            return (
                              <button
                                key={s}
                                className={`btn ${meta.cls} btn-sm`}
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                onClick={() => handleTransition(task, s)}
                              >
                                {meta.label}
                              </button>
                            )
                          })}
                          {task.status === 'INSPECTION_PENDING' && (
                            <button
                              className="btn btn-gold btn-sm"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              onClick={() => { setShowInspect(task); setInspectApprove(true); setRejectReason('') }}
                            >
                              🔍 Inspect
                            </button>
                          )}
                        </div>

                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                          <DateTimeDisplay date={task.created_at} />
                        </div>
                      </div>
                    )
                  })}

                  {colTasks.length === 0 && (
                    <div style={{
                      textAlign: 'center', padding: '20px 8px',
                      color: 'var(--text-muted)', fontSize: 12,
                      border: '1px dashed var(--border)', borderRadius: 8,
                    }}>
                      No tasks
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── TABLE VIEW ──────────────────────────────────────────────────── */}
        {view === 'table' && (
          <>
            <div className="tabs" style={{ marginBottom: 16 }}>
              {['', ...statuses].map((s) => (
                <button key={s || 'all'} className={`tab ${filterStatus === s ? 'active' : ''}`}
                  onClick={() => setFilterStatus(s)}>
                  {s || 'All'}{s && counts[s] ? ` (${counts[s]})` : ''}
                </button>
              ))}
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Room</th><th>Room Status</th><th>Type</th>
                    <th>Priority</th><th>Assigned To</th><th>Task Status</th>
                    <th>Created</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No tasks</td></tr>
                  )}
                  {tasks.map((task) => {
                    const nextSteps = TRANSITIONS[task.status] || []
                    const roomStatus = getRoomStatus(task.room_id)
                    return (
                      <tr key={task.id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{task.id}</td>
                        <td><strong>Rm. {getRoomNum(task.room_id)}</strong></td>
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                            background: `${ROOM_STATUS_COLOR[roomStatus] || '#6b7280'}22`,
                            color: ROOM_STATUS_COLOR[roomStatus] || '#6b7280',
                          }}>
                            {roomStatus}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{task.task_type}</td>
                        <td>
                          <span style={{ color: PRIORITY_COLOR[task.priority], fontWeight: 700, fontSize: 12 }}>
                            {task.priority}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                          {task.assigned_staff_id
                            ? getStaffName(task.assigned_staff_id)
                            : <span style={{ color: '#f59e0b' }}>⚠ Unassigned</span>}
                        </td>
                        <td><Badge status={task.status} /></td>
                        <td><DateTimeDisplay date={task.created_at} /></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {task.status === 'PENDING' && (
                              <button className="btn btn-secondary btn-sm"
                                onClick={() => { setShowAssign(task); setAssignStaffId('') }}>
                                👤 Assign
                              </button>
                            )}
                            {nextSteps.filter((s) => s !== 'ASSIGNED').map((s) => {
                              const meta = TRANSITION_LABELS[s] || { label: `→ ${s}`, cls: 'btn-secondary' }
                              return (
                                <button key={s} className={`btn ${meta.cls} btn-sm`}
                                  onClick={() => handleTransition(task, s)}>
                                  {meta.label}
                                </button>
                              )
                            })}
                            {task.status === 'INSPECTION_PENDING' && (
                              <button className="btn btn-gold btn-sm"
                                onClick={() => { setShowInspect(task); setInspectApprove(true); setRejectReason('') }}>
                                🔍 Inspect
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
          </>
        )}
      </div>

      {/* ── Create Task Modal ─────────────────────────────────────────────── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Housekeeping Task"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="btn btn-primary" form="hk-form" type="submit">Create Task</button>
        </>}
      >
        <form id="hk-form" onSubmit={handleCreate}>
          <FormGroup label="Room">
            <select value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })} required>
              <option value="">Select room...</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.room_number} — {r.status}
                </option>
              ))}
            </select>
          </FormGroup>
          <div className="grid-2">
            <FormGroup label="Task Type">
              <select value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })}>
                {['CHECKOUT', 'DAILY', 'DEEP_CLEAN', 'TURNDOWN', 'ARRIVAL_PREP', 'INSPECTION'].map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </FormGroup>
            <FormGroup label="Priority">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </FormGroup>
          </div>
          <FormGroup label="Assign To (optional)">
            <select value={form.assigned_staff_id} onChange={(e) => setForm({ ...form, assigned_staff_id: e.target.value })}>
              <option value="">Unassigned</option>
              {hkStaff.map((s) => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.role})</option>
              ))}
            </select>
          </FormGroup>
          <FormGroup label="Notes (optional)">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Special instructions for the cleaning team..." />
          </FormGroup>
        </form>
      </Modal>

      {/* ── Assign Staff Modal ────────────────────────────────────────────── */}
      <Modal open={!!showAssign} onClose={() => setShowAssign(null)}
        title={`Assign Task — Room ${showAssign ? getRoomNum(showAssign?.room_id) : ''}`}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowAssign(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAssign}>Assign</button>
        </>}
      >
        <FormGroup label="Select Housekeeping Staff">
          <select value={assignStaffId} onChange={(e) => setAssignStaffId(e.target.value)} required>
            <option value="">— Select staff member —</option>
            {hkStaff.map((s) => (
              <option key={s.id} value={s.id}>{s.first_name} {s.last_name} · {s.role}</option>
            ))}
          </select>
        </FormGroup>
        {showAssign && (
          <div style={{
            background: 'var(--surface-3)', borderRadius: 8, padding: 12, marginTop: 8,
            fontSize: 13, color: 'var(--text-secondary)',
          }}>
            <div>📍 <strong>Room {getRoomNum(showAssign.room_id)}</strong> · {showAssign.task_type}</div>
            <div style={{ marginTop: 4 }}>🔴 Priority: <strong>{showAssign.priority}</strong></div>
            {showAssign.notes && <div style={{ marginTop: 4, fontStyle: 'italic' }}>{showAssign.notes}</div>}
          </div>
        )}
      </Modal>

      {/* ── Inspection Modal ──────────────────────────────────────────────── */}
      <Modal
        open={!!showInspect}
        onClose={() => setShowInspect(null)}
        title={`Inspect Room ${showInspect ? getRoomNum(showInspect.room_id) : ''}`}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowInspect(null)}>Cancel</button>
          <button
            className={`btn ${inspectApprove ? 'btn-success' : 'btn-danger'}`}
            onClick={handleInspect}
          >
            {inspectApprove ? '✅ Approve — Mark READY' : '❌ Reject — Back to Cleaning'}
          </button>
        </>}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{
            background: 'var(--surface-3)', borderRadius: 8, padding: 12,
            marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)',
          }}>
            {showInspect && <>
              <div>🛏 <strong>Room {getRoomNum(showInspect.room_id)}</strong></div>
              <div>🧹 Task type: {showInspect?.task_type}</div>
              {showInspect?.assigned_staff_id && (
                <div>👤 Cleaned by: {getStaffName(showInspect.assigned_staff_id)}</div>
              )}
            </>}
          </div>
          <FormGroup label="Inspection Decision">
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className={`btn ${inspectApprove ? 'btn-success' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setInspectApprove(true)}
              >
                ✅ Approve
                <div style={{ fontSize: 11, opacity: 0.8 }}>Room → READY</div>
              </button>
              <button
                type="button"
                className={`btn ${!inspectApprove ? 'btn-danger' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setInspectApprove(false)}
              >
                ❌ Reject
                <div style={{ fontSize: 11, opacity: 0.8 }}>Room → DIRTY</div>
              </button>
            </div>
          </FormGroup>
          {!inspectApprove && (
            <FormGroup label="Rejection Reason *">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="What needs to be cleaned again? Be specific..."
                required
              />
            </FormGroup>
          )}
        </div>
      </Modal>
    </div>
  )
}
