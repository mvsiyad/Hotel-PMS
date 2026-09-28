import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAuditLogs } from '../services/api'
import { DateTimeDisplay, LoadingOverlay } from '../components/UI'

export default function AuditLogs() {
  const { hotelId } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const [actorTypeFilter, setActorTypeFilter] = useState('')

  const load = async () => {
    const params = {}
    if (actionFilter) params.action = actionFilter
    if (actorTypeFilter) params.actor_type = actorTypeFilter
    const r = await getAuditLogs(hotelId, { ...params, limit: 200 }).catch(() => ({ data: [] }))
    setLogs(r.data)
    setLoading(false)
  }

  useEffect(() => { if (hotelId) load() }, [hotelId, actionFilter, actorTypeFilter])

  const actions = [...new Set(logs.map((l) => l.action))].sort()

  if (loading) return <LoadingOverlay />

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">Audit Logs</div>
          <div className="topbar-subtitle">{logs.length} entries</div>
        </div>
      </div>

      <div className="page-container">
        <div className="filter-bar">
          <input
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="Filter by action..."
            style={{ width: 240 }}
          />
          <select value={actorTypeFilter} onChange={(e) => setActorTypeFilter(e.target.value)} style={{ width: 160 }}>
            <option value="">All Actor Types</option>
            <option value="STAFF">Staff</option>
            <option value="INTEGRATION">Integration</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => { setActionFilter(''); setActorTypeFilter('') }}>Clear</button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Actor Type</th>
                <th>Resource</th>
                <th>Details</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No audit logs found</td></tr>
              )}
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}><DateTimeDisplay date={log.created_at} /></td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--primary)' }}>{log.action}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>{log.actor_name || `#${log.actor_id}`}</td>
                  <td>
                    <span style={{ fontSize: 11, color: log.actor_type === 'INTEGRATION' ? 'var(--gold)' : 'var(--info)', fontWeight: 600 }}>
                      {log.actor_type}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {log.resource_type} {log.resource_id ? `#${log.resource_id}` : ''}
                  </td>
                  <td>
                    {log.details && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {log.ip_address || '—'}
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
