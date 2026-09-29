import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { UserPlus, Shield, Mail, Key, UserX } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getStaff, createStaff, disableStaff } from '../services/api'
import { Badge, Modal, FormGroup, DateTimeDisplay, LoadingOverlay } from '../components/UI'
import Topbar from '../components/Topbar'

const ROLES = [
  'PMS_ADMIN',
  'HOTEL_MANAGER',
  'FRONT_DESK',
  'HOUSEKEEPING',
  'MAINTENANCE',
  'ROOM_SERVICE',
  'AUDIT',
]

export default function Staff() {
  const { hotelId } = useAuth()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'FRONT_DESK',
  })

  const load = async () => {
    const r = await getStaff(hotelId).catch(() => ({ data: [] }))
    setStaff(r.data)
    setLoading(false)
  }

  useEffect(() => {
    if (hotelId) load()
  }, [hotelId])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createStaff(hotelId, form)
      toast.success(`Staff account created for ${form.first_name}`)
      setShowCreate(false)
      setForm({ first_name: '', last_name: '', email: '', password: '', role: 'FRONT_DESK' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create staff account')
    }
  }

  const handleDisable = async (s) => {
    if (!confirm(`Are you sure you want to disable ${s.first_name} ${s.last_name}'s access?`)) return
    try {
      await disableStaff(hotelId, s.id)
      toast.success('Staff credentials deactivated')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to disable staff')
    }
  }

  if (loading) return <LoadingOverlay />

  return (
    <div>
      <Topbar
        title="Staff Directory & RBAC"
        subtitle={`${staff.length} team members with role-based platform access`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <UserPlus size={14} />
            <span>Add Member</span>
          </button>
        }
      />

      <div className="page-container">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Work Email</th>
                <th>Assigned Role</th>
                <th>Status</th>
                <th>Last Active</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}
                  >
                    No staff members configured
                  </td>
                </tr>
              ) : (
                staff.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 'var(--radius-md)',
                            background: 'linear-gradient(135deg, var(--primary), #8b5cf6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#ffffff',
                            flexShrink: 0,
                          }}
                        >
                          {s.first_name[0]}
                        </div>
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {s.first_name} {s.last_name}
                        </strong>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.email}</td>
                    <td>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--primary)',
                          background: 'var(--primary-tint)',
                          padding: '2px 7px',
                          borderRadius: 4,
                          border: '1px solid var(--primary-glow)',
                        }}
                      >
                        {s.role}
                      </span>
                    </td>
                    <td>
                      <Badge status={s.is_active ? 'ACTIVE' : 'DISABLED'} />
                    </td>
                    <td>
                      <DateTimeDisplay date={s.last_login_at} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {s.is_active ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => handleDisable(s)}
                        >
                          <UserX size={13} />
                          <span>Deactivate</span>
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Deactivated</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add Staff Member"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" form="staff-form" type="submit">
              Provision Member
            </button>
          </>
        }
      >
        <form id="staff-form" onSubmit={handleCreate}>
          <div className="grid-2">
            <FormGroup label="First Name">
              <input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
              />
            </FormGroup>
            <FormGroup label="Last Name">
              <input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
              />
            </FormGroup>
          </div>
          <FormGroup label="Corporate Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </FormGroup>
          <FormGroup label="Initial Password">
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
            />
          </FormGroup>
          <FormGroup label="Permission Role">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </FormGroup>
        </form>
      </Modal>
    </div>
  )
}
