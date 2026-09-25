import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { trackPublic } from '../services/api';
import { formatStatus, formatCategory, getErrorMessage } from '../utils/helpers';
import { format } from 'date-fns';
import { Search, MapPin, CheckCircle, Clock } from 'lucide-react';

export default function TrackComplaint() {
  const { ticketId: ticketIdParam } = useParams();
  const navigate = useNavigate();
  const [ticketId, setTicketId] = useState(ticketIdParam || '');
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runLookup = (id) => {
    if (!id?.trim()) return;
    setLoading(true);
    setError('');
    trackPublic(id.trim())
      .then(({ data }) => setComplaint(data.complaint))
      .catch((err) => { setError(getErrorMessage(err, 'Ticket not found')); setComplaint(null); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (ticketIdParam) runLookup(ticketIdParam); }, [ticketIdParam]);

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate(`/track/${ticketId.trim()}`);
    runLookup(ticketId);
  };

  const PRIORITY_STYLES = { critical: { bg: '#fef2f2', color: '#991b1b' }, high: { bg: '#fff7ed', color: '#c2410c' }, medium: { bg: '#fffbeb', color: '#92400e' }, low: { bg: '#f0fdf4', color: '#166534' } };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #ff6b35, #ffaa00)', borderRadius: 14, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🏛️</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>Track Your Grievance</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No login required — enter your ticket ID to check status</p>
        </div>

        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10 }}>
            <input className="form-control" placeholder="e.g. GRV-2026-000123" value={ticketId} onChange={(e) => setTicketId(e.target.value)} style={{ fontFamily: 'monospace' }} />
            <button type="submit" className="btn btn-primary" disabled={loading}><Search size={15} /> {loading ? 'Searching...' : 'Track'}</button>
          </div>
        </form>

        {error && <div className="alert alert-critical" style={{ marginBottom: 20 }}>{error}</div>}

        {complaint && (
          <div className="card">
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13, background: 'var(--card-hover)', padding: '3px 8px', borderRadius: 4 }}>{complaint.ticketId}</span>
                <span className={`badge badge-${complaint.status}`}>{formatStatus(complaint.status)}</span>
                <span className="badge" style={{ background: PRIORITY_STYLES[complaint.priority]?.bg, color: PRIORITY_STYLES[complaint.priority]?.color }}>
                  {complaint.isCritical && '🚨 '}{complaint.priority?.toUpperCase()}
                </span>
              </div>

              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{complaint.title}</h2>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16, color: 'var(--text-muted)', fontSize: 13 }}>
                <MapPin size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{complaint.address}{complaint.ward ? ` • ${complaint.ward}` : ''}{complaint.district ? `, ${complaint.district}` : ''}</span>
              </div>

              <div className="grid grid-2" style={{ gap: 12, marginBottom: 20 }}>
                <div style={{ background: 'var(--card-hover)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Category</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{formatCategory(complaint.category)}</div>
                </div>
                <div style={{ background: 'var(--card-hover)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Department</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{complaint.department || 'Pending assignment'}</div>
                </div>
                <div style={{ background: 'var(--card-hover)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Submitted</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{format(new Date(complaint.createdAt), 'dd MMM yyyy')}</div>
                </div>
                <div style={{ background: 'var(--card-hover)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{complaint.resolvedAt ? 'Resolved' : 'Expected By'}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {(complaint.resolvedAt || complaint.dueDate) ? format(new Date(complaint.resolvedAt || complaint.dueDate), 'dd MMM yyyy') : '—'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Status History</div>
              <div className="timeline">
                {[...complaint.timeline].reverse().map((t, i) => (
                  <div key={i} className="timeline-item">
                    <div className={`timeline-dot ${t.status === 'resolved' ? 'success' : ''}`}>{t.status === 'resolved' ? <CheckCircle size={14} /> : <Clock size={12} />}</div>
                    <div className="timeline-content">
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{formatStatus(t.status)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.message}</div>
                      <div className="timeline-time">{format(new Date(t.timestamp), 'dd MMM yyyy HH:mm')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13 }}>
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>← Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
