import React, { useEffect, useState } from 'react';
import { getAuditLog } from '../api';
import toast from 'react-hot-toast';

const EVENT_COLORS = {
  RESUME_UPLOADED: 'primary',
  RESUME_SCORED: 'success',
  RESUME_DELETED: 'danger',
  JD_UPLOADED: 'info',
  JD_DELETED: 'danger',
  BULK_SCORE_STARTED: 'warning',
  CHAT_QUERY: 'neutral',
};

const EVENT_ICONS = {
  RESUME_UPLOADED: '📤',
  RESUME_SCORED: '🎯',
  RESUME_DELETED: '🗑️',
  JD_UPLOADED: '💼',
  JD_DELETED: '🗑️',
  BULK_SCORE_STARTED: '🚀',
  CHAT_QUERY: '💬',
};

function AuditLog() {
  const [logs, setLogs]   = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage]   = useState(0);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 30;

  const load = async (p = 0) => {
    setLoading(true);
    try {
      const res = await getAuditLog({ skip: p * PAGE_SIZE, limit: PAGE_SIZE });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
      setPage(p);
    } catch (e) {
      toast.error('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">🔍 Audit Log</h1>
          <p className="page-subtitle">Complete immutable record of all scoring decisions and system events</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="badge badge-neutral">{total} total events</span>
          <button id="refresh-audit-btn" className="btn btn-secondary btn-sm" onClick={() => load(0)}>🔄 Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /><span>Loading audit log...</span></div>
      ) : logs.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No audit entries yet</div>
          <div className="empty-state-desc">Events are logged automatically when you upload resumes, score candidates, or perform any system action.</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: 0 }}>
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 180 }}>Timestamp</th>
                    <th style={{ width: 200 }}>Event</th>
                    <th>Details</th>
                    <th style={{ width: 120 }}>Data Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => {
                    const color = EVENT_COLORS[log.event_type] || 'neutral';
                    const icon = EVENT_ICONS[log.event_type] || '📌';
                    return (
                      <tr key={log.id || i}>
                        <td>
                          <div style={{ fontSize: '0.78rem' }}>
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                          </div>
                        </td>
                        <td>
                          <span className={`badge badge-${color}`}>
                            {icon} {log.event_type?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {Object.entries(log.data || {}).map(([k, v]) => (
                              <span key={k} style={{ marginRight: 12 }}>
                                <span style={{ color: 'var(--text-muted)' }}>{k}:</span>{' '}
                                <span className="font-mono" style={{ fontSize: '0.72rem' }}>
                                  {typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v).slice(0, 40)}
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <code style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                            {log.data_hash?.slice(0, 10)}…
                          </code>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            <button
              id="audit-prev-btn"
              className="btn btn-secondary btn-sm"
              onClick={() => load(page - 1)}
              disabled={page === 0}
            >
              ← Prev
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '8px 16px' }}>
              Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
            </span>
            <button
              id="audit-next-btn"
              className="btn btn-secondary btn-sm"
              onClick={() => load(page + 1)}
              disabled={(page + 1) * PAGE_SIZE >= total}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default AuditLog;
