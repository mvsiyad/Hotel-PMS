import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Wrench, AlertTriangle, Plus, ArrowRight, CheckCircle2, Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getMaintenance, createMaintenance, updateMaintenance, getRooms } from '../services/api'
import { Badge, Modal, FormGroup, DateTimeDisplay, LoadingOverlay } from '../components/UI'
import Topbar from '../components/Topbar'

const VALID_TRANSITIONS = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['FIXED'],
  FIXED: ['VERIFIED', 'IN_PROGRESS'],
  VERIFIED: ['CLOSED'],
  CLOSED: [],
}

export default function Maintenance() {
  const { hotelId } = useAuth()
  const [issues, setIssues] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    room_id: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    mark_room_out_of_order: false,
  })

  const load = async () => {
    const [i, r] = await Promise.all([
      getMaintenance(hotelId, statusFilter ? { status: statusFilter } : {}).catch(() => ({ data: [] })),
      getRooms(hotelId).catch(() => ({ data: [] })),
    ])
    setIssues(i.data)
    setRooms(r.data)
    setLoading(false)
  }

  useEffect(() => {
    if (hotelId) load()
  }, [hotelId, statusFilter])

  const getRoomNum = (id) => rooms.find((r) => r.id === id)?.room_number || `#${id}`

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createMaintenance(hotelId, {
        ...form,
        room_id: form.room_id ? parseInt(form.room_id) : null,
      })
      toast.success('Work order filed successfully')
      setShowCreate(false)
      setForm({ room_id: '', title: '', description: '', priority: 'MEDIUM', mark_room_out_of_order: false })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to file work order')
    }
  }

  const handleStatus = async (issue, status) => {
    try {
      await updateMaintenance(hotelId, issue.id, { status })
      toast.success(`Work order transitioned to ${status}`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Cannot update status')
    }
  }

  if (loading) return <LoadingOverlay />

  return (
    <div>
      <Topbar
        title="Maintenance Work Orders"
        subtitle={`${issues.length} total work orders filed`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            <span>File Work Order</span>
          </button>
        }
      />

      <div className="page-container">
        {/* Status Tabs */}
        <div className="tabs">
          {['', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'CLOSED'].map((s) => (
            <button
              key={s || 'all'}
              className={`tab ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s ? s.replace(/_/g, ' ') : 'All Work Orders'}
            </button>
          ))}
        </div>

        {/* Work Orders Table */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Work Order Title</th>
                <th>Target Room</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Reported On</th>
                <th style={{ textAlign: 'right' }}>Workflow Transitions</th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}
                  >
                    No maintenance issues reported matching this filter
                  </td>
                </tr>
              ) : (
                issues.map((issue) => (
                  <tr key={issue.id}>
                    <td>
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>{issue.title}</strong>
                      </div>
                      {issue.description && (
                        <div
                          style={{
                            fontSize: 11.5,
                            color: 'var(--text-muted)',
                            marginTop: 2,
                            maxWidth: 340,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {issue.description}
                        </div>
                      )}
                    </td>
                    <td>
                      {issue.room_id ? (
                        <span style={{ fontWeight: 600 }}>Room {getRoomNum(issue.room_id)}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>General Facility</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`priority-${issue.priority}`}
                        style={{ fontWeight: 600, fontSize: 11 }}
                      >
                        {issue.priority}
                      </span>
                    </td>
                    <td>
                      <Badge status={issue.status} />
                    </td>
                    <td>
                      <DateTimeDisplay date={issue.created_at} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          gap: 6,
                          flexWrap: 'wrap',
                          justifyContent: 'flex-end',
                        }}
                      >
                        {(VALID_TRANSITIONS[issue.status] || []).map((s) => (
                          <button
                            key={s}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => handleStatus(issue, s)}
                          >
                            <ArrowRight size={11} />
                            <span>{s.replace(/_/g, ' ')}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="File Maintenance Work Order"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" form="maint-form" type="submit">
              Dispatch Work Order
            </button>
          </>
        }
      >
        <form id="maint-form" onSubmit={handleCreate}>
          <FormGroup label="Issue Title">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. AC cooling malfunction"
              required
            />
          </FormGroup>
          <div className="grid-2">
            <FormGroup label="Impacted Room (Optional)">
              <select
                value={form.room_id}
                onChange={(e) => setForm({ ...form, room_id: e.target.value })}
              >
                <option value="">No specific room unit</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.room_number} ({r.status})
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
          <FormGroup label="Detailed Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Provide technician diagnostics or details..."
            />
          </FormGroup>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
            }}
          >
            <input
              type="checkbox"
              id="out-of-order"
              checked={form.mark_room_out_of_order}
              onChange={(e) => setForm({ ...form, mark_room_out_of_order: e.target.checked })}
              style={{ width: 'auto', margin: 0 }}
            />
            <label
              htmlFor="out-of-order"
              style={{
                margin: 0,
                textTransform: 'none',
                letterSpacing: 0,
                fontSize: 12.5,
                fontWeight: 500,
                color: 'var(--warning)',
                cursor: 'pointer',
              }}
            >
              Automatically take unit OUT OF ORDER until verified
            </label>
          </div>
        </form>
      </Modal>
    </div>
  )
}
