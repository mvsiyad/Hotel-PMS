import { useState, useEffect } from 'react'
import { ScrollText, Search, Filter, Shield, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getAuditLogs } from '../services/api'
import { DateTimeDisplay, LoadingOverlay } from '../components/UI'
import Topbar from '../components/Topbar'

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

  useEffect(() => {
    if (hotelId) load()
  }, [hotelId, actionFilter, actorTypeFilter])

  if (loading) return <LoadingOverlay />

  return (
    <div>
      <Topbar
        title="Audit Logs & Compliance"
        subtitle={`Immutable trail of ${logs.length} logged actions across all system actors`}
      />

      <div className="page-container">
        {/* Filters */}
        <div className="filter-bar">
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              width: 260,
            }}
          >
            <Search
              size={14}
              style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }}
            />
            <input
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="Search action keyword..."
              style={{ paddingLeft: 32 }}
            />
          </div>

          <select
            value={actorTypeFilter}
            onChange={(e) => setActorTypeFilter(e.target.value)}
            style={{ width: 170 }}
          >
            <option value="">All Actor Types</option>
            <option value="STAFF">Human Staff</option>
            <option value="INTEGRATION">Machine Integration</option>
          </select>

          {(actionFilter || actorTypeFilter) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setActionFilter('')
                setActorTypeFilter('')
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <X size={12} />
              <span>Clear</span>
            </button>
          )}

          <span
            style={{
              marginLeft: 'auto',
              color: 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {logs.length} events logged
          </span>
        </div>

        {/* Table */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action Event</th>
                <th>Actor Identity</th>
                <th>Actor Type</th>
                <th>Resource Target</th>
                <th>Payload Digest</th>
                <th>Origin IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}
                  >
                    No audit records match the query
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <DateTimeDisplay date={log.created_at} />
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          color: 'var(--primary)',
                          background: 'var(--primary-tint)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          border: '1px solid var(--primary-glow)',
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, fontWeight: 500 }}>
                      {log.actor_name || `#${log.actor_id}`}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          color: log.actor_type === 'INTEGRATION' ? 'var(--gold)' : 'var(--info)',
                          fontWeight: 600,
                          background:
                            log.actor_type === 'INTEGRATION' ? 'var(--gold-glow)' : 'var(--info-bg)',
                          padding: '2px 7px',
                          borderRadius: 'var(--radius-full)',
                          border: `1px solid ${
                            log.actor_type === 'INTEGRATION'
                              ? 'rgba(245, 158, 11, 0.3)'
                              : 'var(--info-border)'
                          }`,
                        }}
                      >
                        {log.actor_type}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {log.resource_type} {log.resource_id ? `#${log.resource_id}` : ''}
                    </td>
                    <td>
                      {log.details && (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10.5,
                            color: 'var(--text-muted)',
                            maxWidth: 220,
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={
                            typeof log.details === 'string'
                              ? log.details
                              : JSON.stringify(log.details)
                          }
                        >
                          {typeof log.details === 'string'
                            ? log.details
                            : JSON.stringify(log.details)}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {log.ip_address || '—'}
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
