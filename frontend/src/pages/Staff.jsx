import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { getStaff, createStaff, disableStaff } from '../services/api'
import { Badge, Modal, FormGroup, DateTimeDisplay, LoadingOverlay } from '../components/UI'

const ROLES = ['PMS_ADMIN', 'HOTEL_MANAGER', 'FRONT_DESK', 'HOUSEKEEPING', 'MAINTENANCE', 'ROOM_SERVICE', 'AUDIT']

export default function Staff() {
  const { hotelId } = useAuth()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', role: 'FRONT_DESK' })

  const load = async () => {
    const r = await getStaff(hotelId).catch(() => ({ data: [] }))
    setStaff(r.data)
    setLoading(false)
  }

  useEffect(() => { if (hotelId) load() }, [hotelId])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createStaff(hotelId, form)
      toast.success(`Staff ${form.first_name} created`)
      setShowCreate(false)
      setForm({ first_name: '', last_name: '', email: '', password: '', role: 'FRONT_DESK' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  const handleDisable = async (s) => {
    if (!confirm(`Disable ${s.first_name} ${s.last_name}?`)) return
    try {
      await disableStaff(hotelId, s.id)
      toast.success('Staff disabled')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    }
  }

  if (loading) return <LoadingOverlay />

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Staff Management</div>
          <div className="topbar-subtitle">{staff.length} staff members</div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Add Staff</button>
        </div>
      </div>

      <div className="page-container">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No staff members</td></tr>
              )}
              {staff.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                        {s.first_name[0]}
                      </div>
                      <strong>{s.first_name} {s.last_name}</strong>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{s.email}</td>
                  <td><span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{s.role}</span></td>
                  <td><Badge status={s.is_active ? 'ACTIVE' : 'DISABLED'} /></td>
                  <td><DateTimeDisplay date={s.last_login_at} /></td>
                  <td>
                    {s.is_active && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleDisable(s)}>Disable</button>
                    )}
                    {!s.is_active && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Disabled</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Staff Member"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" form="staff-form" type="submit">Create Staff</button>
          </>
        }
      >
        <form id="staff-form" onSubmit={handleCreate}>
          <div className="grid-2">
            <FormGroup label="First Name">
              <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            </FormGroup>
            <FormGroup label="Last Name">
              <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
            </FormGroup>
          </div>
          <FormGroup label="Email">
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </FormGroup>
          <FormGroup label="Initial Password">
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
          </FormGroup>
          <FormGroup label="Role">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </FormGroup>
        </form>
      </Modal>
    </div>
  )
}
