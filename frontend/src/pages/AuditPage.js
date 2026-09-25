import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../services/api';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, AlertTriangle, Filter } from 'lucide-react';

const ACTION_LABELS = {
  ASSIGN: { label: 'Complaint Assigned', icon: '📋', color: 'var(--primary)' },
  FALSE_CLOSURE_DETECTED: { label: 'FALSE CLOSURE DETECTED', icon: '🚨', color: 'var(--danger)' },
  SUSPICIOUS_CLOSURE: { label: 'Suspicious Closure', icon: '⚠️', color: 'var(--warning)' },
  USER_DEACTIVATED: { label: 'User Deactivated', icon: '🔒', color: 'var(--text-muted)' },
  USER_REACTIVATED: { label: 'User Reactivated', icon: '🔓', color: 'var(--success)' },
};

export default function AuditPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSuspicious, setShowSuspicious] = useState(false);

  useEffect(() => {
    setLoading(true);
    getAuditLogs({ suspicious: showSuspicious ? 'true' : '', limit: 100 }).then(({ data }) => {
      setLogs(data.logs);
      setTotal(data.total);
    }).finally(() => setLoading(false));
  }, [showSuspicious]);

  const suspiciousCount = logs.filter((l) => l.suspicious).length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 10 }}><ShieldAlert size={24} /> Audit & Integrity System</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>All system actions are logged. False closures and suspicious activity are auto-flagged.</p>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-icon" style={{ background: 'var(--card-hover)' }}>📝</div><div><div className="stat-value" style={{ color: 'var(--primary)' }}>{total}</div><div className="stat-label">Total Audit Events</div></div></div>
        <div className="stat-card" style={{ cursor: 'pointer', border: suspiciousCount > 0 ? '2px solid #fecaca' : undefined }} onClick={() => setShowSuspicious(true)}>
          <div className="stat-icon" style={{ background: '#fef2f2' }}>⚠️</div>
          <div><div className="stat-value" style={{ color: 'var(--danger)' }}>{suspiciousCount}</div><div className="stat-label">Suspicious Actions</div>{suspiciousCount > 0 && <div style={{ fontSize: 10, color: 'var(--danger)' }}>Click to filter</div>}</div>
        </div>
        <div className="stat-card"><div className="stat-icon" style={{ background: '#fef2f2' }}>🚨</div><div><div className="stat-value" style={{ color: 'var(--danger)' }}>{logs.filter((l) => l.action === 'FALSE_CLOSURE_DETECTED').length}</div><div className="stat-label">False Closures Caught</div></div></div>
      </div>

      {suspiciousCount > 0 && (
        <div className="alert alert-critical" style={{ marginBottom: 20 }}><AlertTriangle size={16} /><strong>{suspiciousCount} suspicious activities detected.</strong> Review these immediately to prevent data manipulation.</div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title">Audit Log</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn btn-sm ${!showSuspicious ? 'btn-primary' : 'btn-outline'}`} onClick={() => setShowSuspicious(false)}>All Events</button>
            <button className={`btn btn-sm ${showSuspicious ? 'btn-danger' : 'btn-outline'}`} onClick={() => setShowSuspicious(true)}><Filter size={12} /> Suspicious Only ({suspiciousCount})</button>
          </div>
        </div>
        <div className="table-container">
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div> :
          logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}><div style={{ fontSize: 36, marginBottom: 8 }}>✅</div><div>No {showSuspicious ? 'suspicious' : ''} events found</div></div>
          ) : (
            <table>
              <thead><tr><th>Time</th><th>Action</th><th>Performed By</th><th>Entity</th><th>Details</th><th>Flag</th></tr></thead>
              <tbody>
                {logs.map((log) => {
                  const meta = ACTION_LABELS[log.action] || { label: log.action, icon: '📌', color: 'var(--text)' };
                  return (
                    <tr 
                      key={log._id} 
                      style={{ background: log.suspicious ? '#fff5f5' : undefined, cursor: log.entityId ? 'pointer' : 'default' }}
                      className={log.entityId ? "hover-bg" : ""}
                      onClick={() => {
                        if (log.entityId) {
                          if (log.entityType === 'Complaint') navigate(`/complaints/${log.entityId}`);
                          else if (log.entityType === 'User') navigate(`/officers/${log.entityId}`);
                        }
                      }}
                    >
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{format(new Date(log.createdAt), 'dd MMM HH:mm')}</td>
                      <td><span style={{ color: meta.color, fontWeight: 600, fontSize: 12 }}>{meta.icon} {meta.label}</span></td>
                      <td><div style={{ fontSize: 13 }}>{log.performedBy?.name || 'System'}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{log.performedBy?.role?.replace('_', ' ')}</div></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{log.entityType}</td>
                      <td style={{ fontSize: 12, maxWidth: 200 }}>
                        {log.suspicionReason && <span style={{ color: 'var(--danger)' }}>{log.suspicionReason}</span>}
                        {log.details && !log.suspicionReason && <span style={{ color: 'var(--text-muted)' }}>{JSON.stringify(log.details).slice(0, 60)}</span>}
                      </td>
                      <td>{log.suspicious ? <span className="badge badge-critical">⚠️ Suspicious</span> : <span className="badge" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>✓ Normal</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
