import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { getMaintenance, createMaintenance, updateMaintenance, getRooms } from '../services/api'
import { Badge, Modal, FormGroup, DateTimeDisplay, LoadingOverlay } from '../components/UI'

export default function Maintenance() {
  const { hotelId } = useAuth()
  const [issues, setIssues] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ room_id: '', title: '', description: '', priority: 'MEDIUM', mark_room_out_of_order: false })

  const load = async () => {
    const [i, r] = await Promise.all([
      getMaintenance(hotelId, statusFilter ? { status: statusFilter } : {}).catch(() => ({ data: [] })),
      getRooms(hotelId).catch(() => ({ data: [] })),
    ])
    setIssues(i.data)
    setRooms(r.data)
    setLoading(false)
  }

  useEffect(() => { if (hotelId) load() }, [hotelId, statusFilter])

  const getRoomNum = (id) => rooms.find((r) => r.id === id)?.room_number || `#${id}`

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createMaintenance(hotelId, { ...form, room_id: form.room_id ? parseInt(form.room_id) : null })
      toast.success('Maintenance issue reported')
      setShowCreate(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  const handleStatus = async (issue, status) => {
    try {
      await updateMaintenance(hotelId, issue.id, { status })
      toast.success(`Issue → ${status}`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Cannot update status')
    }
  }

  const VALID_TRANSITIONS = {
    OPEN: ['ASSIGNED', 'IN_PROGRESS'],
    ASSIGNED: ['IN_PROGRESS'],
    IN_PROGRESS: ['FIXED'],
    FIXED: ['VERIFIED', 'IN_PROGRESS'],
    VERIFIED: ['CLOSED'],
    CLOSED: [],
  }

  if (loading) return <LoadingOverlay />

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Maintenance</div>
          <div className="topbar-subtitle">{issues.length} issues</div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-danger btn-sm" onClick={() => setShowCreate(true)}>⚠️ Report Issue</button>
        </div>
      </div>

      <div className="page-container">
        <div className="tabs">
          {['', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'CLOSED'].map((s) => (
            <button key={s || 'all'} className={`tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s || 'All'}
            </button>
          ))}
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Room</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Reported</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No issues found</td></tr>
              )}
              {issues.map((issue) => (
                <tr key={issue.id}>
                  <td>
                    <div><strong>{issue.title}</strong></div>
                    {issue.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{issue.description.slice(0, 60)}...</div>}
                  </td>
                  <td>{issue.room_id ? `Rm. ${getRoomNum(issue.room_id)}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td><span className={`priority-${issue.priority}`} style={{ fontWeight: 600, fontSize: 12 }}>{issue.priority}</span></td>
                  <td><Badge status={issue.status} /></td>
                  <td><DateTimeDisplay date={issue.created_at} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(VALID_TRANSITIONS[issue.status] || []).map((s) => (
                        <button key={s} className="btn btn-secondary btn-sm" onClick={() => handleStatus(issue, s)}>→ {s}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Report Maintenance Issue"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-danger" form="maint-form" type="submit">Report Issue</button>
          </>
        }
      >
        <form id="maint-form" onSubmit={handleCreate}>
          <FormGroup label="Title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Broken AC unit" required />
          </FormGroup>
          <div className="grid-2">
            <FormGroup label="Room (optional)">
              <select value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
                <option value="">No specific room</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Priority">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </FormGroup>
          </div>
          <FormGroup label="Description">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the issue in detail..." />
          </FormGroup>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
            <input
              type="checkbox"
              id="out-of-order"
              checked={form.mark_room_out_of_order}
              onChange={(e) => setForm({ ...form, mark_room_out_of_order: e.target.checked })}
              style={{ width: 'auto' }}
            />
            <label htmlFor="out-of-order" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 13, fontWeight: 500, color: 'var(--warning)' }}>
              Mark room as OUT OF ORDER
            </label>
          </div>
        </form>
      </Modal>
    </div>
  )
}
