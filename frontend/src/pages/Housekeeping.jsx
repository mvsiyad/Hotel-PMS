import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Kanban,
  Table as TableIcon,
  Check,
  X,
  UserCheck,
  Clock,
  Play,
  ClipboardList
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  getHousekeeping,
  createHousekeepingTask,
  updateHousekeepingTask,
  inspectTask,
  getRooms,
  getStaff,
} from '../services/api'
import { Badge, Modal, FormGroup, DateTimeDisplay, LoadingOverlay } from '../components/UI'
import Topbar from '../components/Topbar'

// Full FSM matching backend
const TRANSITIONS = {
  PENDING: ['ASSIGNED', 'IN_PROGRESS'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['CLEANED'],
  CLEANED: ['INSPECTION_PENDING'],
  INSPECTION_PENDING: [], // supervisor-only via inspect endpoint
  APPROVED: [],
  REJECTED: ['IN_PROGRESS'],
}

const TRANSITION_LABELS = {
  ASSIGNED: { label: 'Assign Staff', cls: 'btn-secondary', icon: UserCheck },
  IN_PROGRESS: { label: 'Start Cleaning', cls: 'btn-warning', icon: Play },
  CLEANED: { label: 'Mark Cleaned', cls: 'btn-success', icon: Check },
  INSPECTION_PENDING: { label: 'Request Inspection', cls: 'btn-gold', icon: Search },
}

const PRIORITY_COLOR = {
  LOW: '#64748b',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  URGENT: '#ef4444',
}

const ROOM_STATUS_COLOR = {
  DIRTY: '#ef4444',
  CLEANING: '#f59e0b',
  CLEAN: '#10b981',
  READY: '#10b981',
  OCCUPIED: '#6366f1',
  AVAILABLE: '#10b981',
  OUT_OF_ORDER: '#64748b',
}

const COLS = [
  { key: 'PENDING', label: 'Pending', color: '#64748b' },
  { key: 'ASSIGNED', label: 'Assigned', color: '#8b5cf6' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: '#f59e0b' },
  { key: 'CLEANED', label: 'Cleaned', color: '#10b981' },
  { key: 'INSPECTION_PENDING', label: 'Inspection', color: '#0ea5e9' },
  { key: 'APPROVED', label: 'Approved', color: '#10b981' },
  { key: 'REJECTED', label: 'Rejected', color: '#ef4444' },
]

export default function Housekeeping() {
  const { hotelId } = useAuth()
  const [tasks, setTasks] = useState([])
  const [rooms, setRooms] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('kanban') // 'kanban' | 'table'
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showInspect, setShowInspect] = useState(null)
  const [showAssign, setShowAssign] = useState(null)
  const [inspectApprove, setInspectApprove] = useState(true)
  const [rejectReason, setRejectReason] = useState('')
  const [assignStaffId, setAssignStaffId] = useState('')
  const [form, setForm] = useState({
    room_id: '',
    task_type: 'CHECKOUT',
    priority: 'HIGH',
    assigned_staff_id: '',
    notes: '',
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
      toast.error('Failed to load housekeeping records')
    } finally {
      setLoading(false)
    }
  }, [hotelId, filterStatus])

  useEffect(() => {
    load()
  }, [load])

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const getRoom = (id) => rooms.find((r) => r.id === id)
  const getRoomNum = (id) => getRoom(id)?.room_number || `#${id}`
  const getRoomStatus = (id) => getRoom(id)?.status || 'UNKNOWN'
  const getStaffName = (id) => {
    const s = staff.find((s) => s.id === id)
    return s ? `${s.first_name} ${s.last_name}` : id ? `Staff #${id}` : '—'
  }
  const hkStaff = staff.filter((s) =>
    ['HOUSEKEEPING', 'SUPERVISOR', 'HOTEL_MANAGER'].includes(s.role)
  )

  const handleTransition = async (task, status) => {
    try {
      await updateHousekeepingTask(hotelId, task.id, { status })
      const msgs = {
        IN_PROGRESS: `Room ${getRoomNum(task.room_id)} cleaning started`,
        CLEANED: `Room ${getRoomNum(task.room_id)} marked cleaned`,
        INSPECTION_PENDING: `Inspection requested for Room ${getRoomNum(task.room_id)}`,
        ASSIGNED: 'Task assigned',
      }
      toast.success(msgs[status] || `Status updated to ${status}`)
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
          ? `Room ${getRoomNum(showInspect.room_id)} Approved — now AVAILABLE`
          : `Room ${getRoomNum(showInspect.room_id)} Rejected — returned to cleaning`
      )
      setShowInspect(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Inspection action failed')
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
      toast.success('Housekeeping task created')
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
      <Topbar
        title="Housekeeping Board"
        subtitle={`${tasks.length} total tasks · ${dirtyRooms.length} rooms require turnaround`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button
                className={`tab ${view === 'kanban' ? 'active' : ''}`}
                onClick={() => setView('kanban')}
              >
                <Kanban size={13} />
                <span>Board</span>
              </button>
              <button
                className={`tab ${view === 'table' ? 'active' : ''}`}
                onClick={() => setView('table')}
              >
                <TableIcon size={13} />
                <span>Table</span>
              </button>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              <span>New Task</span>
            </button>
          </div>
        }
      />

      <div className="page-container">
        {/* KPI Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Dirty Units</span>
              <div className="stat-icon danger">
                <AlertTriangle size={15} />
              </div>
            </div>
            <div className="stat-value">{dirtyRooms.length}</div>
            <div className="stat-change down">Needs cleaning</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Active Queue</span>
              <div className="stat-icon warning">
                <Sparkles size={15} />
              </div>
            </div>
            <div className="stat-value">{counts.IN_PROGRESS + counts.ASSIGNED + counts.PENDING}</div>
            <div className="stat-change">Pending & In Progress</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Inspection Queue</span>
              <div className="stat-icon gold">
                <Search size={15} />
              </div>
            </div>
            <div className="stat-value">{counts.INSPECTION_PENDING}</div>
            <div className="stat-change">Awaiting supervisor sign-off</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">Approved & Ready</span>
              <div className="stat-icon success">
                <CheckCircle2 size={15} />
              </div>
            </div>
            <div className="stat-value">{counts.APPROVED}</div>
            <div className="stat-change up">Ready for arrival</div>
          </div>
        </div>

        {/* Dirty Rooms Quick Alert Strip */}
        {dirtyRooms.length > 0 && (
          <div
            style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 16px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                color: 'var(--danger)',
                fontWeight: 600,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <AlertTriangle size={15} />
              Dirty Rooms Needing Attention:
            </span>
            {dirtyRooms.map((r) => (
              <span
                key={r.id}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--danger)',
                  padding: '3px 9px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid var(--danger-border)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Room {r.room_number}
              </span>
            ))}
          </div>
        )}

        {/* ── KANBAN BOARD VIEW ── */}
        {view === 'kanban' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(190px, 1fr))',
              gap: 12,
              minHeight: 460,
              overflowX: 'auto',
              paddingBottom: 16,
            }}
          >
            {COLS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.key)
              return (
                <div
                  key={col.key}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 10,
                    border: '1px solid var(--border)',
                  }}
                >
                  {/* Column Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: col.color,
                        }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {col.label}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        background: 'var(--bg-card)',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Task Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {colTasks.length === 0 && (
                      <div
                        style={{
                          padding: '24px 8px',
                          textAlign: 'center',
                          color: 'var(--text-disabled)',
                          fontSize: 11.5,
                          border: '1px dashed var(--border)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        No tasks
                      </div>
                    )}
                    {colTasks.map((task) => {
                      const nextSteps = TRANSITIONS[task.status] || []
                      const room = getRoom(task.room_id)
                      return (
                        <div
                          key={task.id}
                          style={{
                            background: 'var(--bg-card)',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px 14px',
                            border: '1px solid var(--border)',
                            borderLeft: `3px solid ${PRIORITY_COLOR[task.priority] || '#64748b'}`,
                            boxShadow: 'var(--shadow-xs)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          {/* Room + Priority */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                              Room {getRoomNum(task.room_id)}
                            </span>
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-full)',
                                background: `${PRIORITY_COLOR[task.priority]}18`,
                                color: PRIORITY_COLOR[task.priority],
                                border: `1px solid ${PRIORITY_COLOR[task.priority]}33`,
                              }}
                            >
                              {task.priority}
                            </span>
                          </div>

                          {/* Task Type */}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {task.task_type?.replace(/_/g, ' ')}
                          </div>

                          {/* Room Current Status Pill */}
                          {room && (
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '2px 7px',
                                borderRadius: 'var(--radius-full)',
                                display: 'inline-block',
                                width: 'fit-content',
                                background: `${ROOM_STATUS_COLOR[room.status] || '#64748b'}18`,
                                color: ROOM_STATUS_COLOR[room.status] || '#64748b',
                                border: `1px solid ${ROOM_STATUS_COLOR[room.status] || '#64748b'}33`,
                              }}
                            >
                              Unit: {room.status}
                            </div>
                          )}

                          {/* Staff */}
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {task.assigned_staff_id ? (
                              <span>Staff: {getStaffName(task.assigned_staff_id)}</span>
                            ) : (
                              <span style={{ color: 'var(--warning)' }}>Unassigned</span>
                            )}
                          </div>

                          {/* Notes snippet */}
                          {task.notes && (
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                                fontStyle: 'italic',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              "{task.notes}"
                            </div>
                          )}

                          {/* Action Buttons */}
                          {nextSteps.length > 0 && (
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 6,
                                marginTop: 6,
                                paddingTop: 6,
                                borderTop: '1px solid var(--border)',
                              }}
                            >
                              {nextSteps.map((nextStatus) => {
                                const stepDef = TRANSITION_LABELS[nextStatus]
                                if (!stepDef) return null
                                const StepIcon = stepDef.icon
                                return (
                                  <button
                                    key={nextStatus}
                                    className={`btn ${stepDef.cls} btn-sm`}
                                    style={{ flex: 1, padding: '4px 6px', fontSize: 11 }}
                                    onClick={() => {
                                      if (nextStatus === 'ASSIGNED') {
                                        setShowAssign(task)
                                        setAssignStaffId(task.assigned_staff_id || '')
                                      } else {
                                        handleTransition(task, nextStatus)
                                      }
                                    }}
                                  >
                                    {StepIcon && <StepIcon size={12} />}
                                    <span>{stepDef.label}</span>
                                  </button>
                                )
                              })}
                            </div>
                          )}

                          {/* Supervisor Inspection Trigger */}
                          {task.status === 'INSPECTION_PENDING' && (
                            <button
                              className="btn btn-gold btn-sm"
                              style={{ marginTop: 6, width: '100%', fontSize: 11 }}
                              onClick={() => {
                                setShowInspect(task)
                                setInspectApprove(true)
                                setRejectReason('')
                              }}
                            >
                              <Search size={12} />
                              <span>Inspect Room</span>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── TABLE VIEW ── */}
        {view === 'table' && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Task Type</th>
                  <th>Priority</th>
                  <th>Assigned Staff</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <strong>Room {getRoomNum(task.room_id)}</strong>
                    </td>
                    <td>{task.task_type?.replace(/_/g, ' ')}</td>
                    <td>
                      <span style={{ color: PRIORITY_COLOR[task.priority], fontWeight: 600 }}>
                        {task.priority}
                      </span>
                    </td>
                    <td>{getStaffName(task.assigned_staff_id)}</td>
                    <td>
                      <Badge status={task.status} />
                    </td>
                    <td>
                      {task.status === 'INSPECTION_PENDING' ? (
                        <button
                          className="btn btn-gold btn-sm"
                          onClick={() => {
                            setShowInspect(task)
                            setInspectApprove(true)
                          }}
                        >
                          <Search size={12} />
                          <span>Inspect</span>
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setShowAssign(task)
                            setAssignStaffId(task.assigned_staff_id || '')
                          }}
                        >
                          <UserCheck size={12} />
                          <span>Assign</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Task Modal ── */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Housekeeping Task"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" form="hk-form" type="submit">
              Create Task
            </button>
          </>
        }
      >
        <form id="hk-form" onSubmit={handleCreate}>
          <FormGroup label="Select Room">
            <select
              value={form.room_id}
              onChange={(e) => setForm({ ...form, room_id: e.target.value })}
              required
            >
              <option value="">Select room...</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.room_number} — ({r.status})
                </option>
              ))}
            </select>
          </FormGroup>

          <div className="grid-2">
            <FormGroup label="Task Type">
              <select
                value={form.task_type}
                onChange={(e) => setForm({ ...form, task_type: e.target.value })}
              >
                {['CHECKOUT', 'DAILY', 'DEEP_CLEAN', 'TURNDOWN', 'ARRIVAL_PREP', 'INSPECTION'].map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </FormGroup>

            <FormGroup label="Priority Level">
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </FormGroup>
          </div>

          <FormGroup label="Assign Staff Member (Optional)">
            <select
              value={form.assigned_staff_id}
              onChange={(e) => setForm({ ...form, assigned_staff_id: e.target.value })}
            >
              <option value="">Unassigned</option>
              {hkStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.role})
                </option>
              ))}
            </select>
          </FormGroup>

          <FormGroup label="Turnaround Notes (Optional)">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Provide specific notes or guest special requests..."
            />
          </FormGroup>
        </form>
      </Modal>

      {/* ── Assign Staff Modal ── */}
      <Modal
        open={!!showAssign}
        onClose={() => setShowAssign(null)}
        title={`Assign Staff — Room ${showAssign ? getRoomNum(showAssign.room_id) : ''}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAssign(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAssign}>
              Confirm Assignment
            </button>
          </>
        }
      >
        <FormGroup label="Designated Housekeeping Staff">
          <select
            value={assignStaffId}
            onChange={(e) => setAssignStaffId(e.target.value)}
            required
          >
            <option value="">— Select staff member —</option>
            {hkStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name} · {s.role}
              </option>
            ))}
          </select>
        </FormGroup>
      </Modal>

      {/* ── Inspection Modal ── */}
      <Modal
        open={!!showInspect}
        onClose={() => setShowInspect(null)}
        title={`Supervisor Inspection — Room ${showInspect ? getRoomNum(showInspect.room_id) : ''}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowInspect(null)}>
              Cancel
            </button>
            <button
              className={`btn ${inspectApprove ? 'btn-success' : 'btn-danger'}`}
              onClick={handleInspect}
            >
              {inspectApprove ? 'Approve — Mark Room AVAILABLE' : 'Reject — Return to Cleaning'}
            </button>
          </>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <FormGroup label="Inspection Decision">
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className={`btn ${inspectApprove ? 'btn-success' : 'btn-secondary'}`}
                style={{ flex: 1, padding: 12 }}
                onClick={() => setInspectApprove(true)}
              >
                <Check size={16} />
                <span>Approve Room</span>
              </button>
              <button
                type="button"
                className={`btn ${!inspectApprove ? 'btn-danger' : 'btn-secondary'}`}
                style={{ flex: 1, padding: 12 }}
                onClick={() => setInspectApprove(false)}
              >
                <X size={16} />
                <span>Reject Room</span>
              </button>
            </div>
          </FormGroup>

          {!inspectApprove && (
            <FormGroup label="Rejection Reason *">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Specify what requires further attention..."
                required
              />
            </FormGroup>
          )}
        </div>
      </Modal>
    </div>
  )
}
