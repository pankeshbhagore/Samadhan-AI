import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOfficerAnalysis } from '../services/api';
import { ChevronLeft, User, AlertCircle, Clock, ShieldCheck, Mail, Briefcase, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatStatus } from '../utils/helpers';
import { format } from 'date-fns';

export default function OfficerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOfficerAnalysis(id)
      .then(res => setData(res.data))
      .catch(() => navigate('/officers'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>;
  if (!data || !data.officer) return null;

  const { officer, recentComplaints, anomalies } = data;

  // Prepare Chart Data for Officer Resolution Stats
  const pieData = [
    { name: 'Resolved', value: officer.stats?.totalResolved || 0 },
    { name: 'False Closures', value: officer.stats?.falseClosures || 0 },
    { name: 'Active (Current)', value: officer.activeComplaints || 0 }
  ].filter(d => d.value > 0);
  
  const COLORS = ['#10b981', '#ef4444', '#f59e0b'];
  const capacityPercent = officer.bandwidth > 0 ? Math.round((officer.activeComplaints / officer.bandwidth) * 100) : 0;

  return (
    <div className="page-content" style={{ padding: '0 0 32px 0', animation: 'fadeIn 0.4s ease-out' }}>
      <button className="btn btn-outline btn-sm" onClick={() => navigate('/officers')} style={{ marginBottom: 20 }}>
        <ChevronLeft size={16} /> Back to Officers
      </button>

      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', border: 'none' }}>
        <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
          <div style={{ width: 80, height: 80, background: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 32, fontWeight: 700 }}>{officer.name.charAt(0)}</span>
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, fontFamily: 'Outfit' }}>{officer.name}</h1>
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{officer.role.replace('_', ' ').toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Briefcase size={14} /> {officer.designation || 'Officer'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => officer.department?._id && navigate(`/departments/${officer.department._id}`)}><ShieldCheck size={14} /> {officer.department?.name || 'Unknown Department'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={14} /> {officer.email}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}><Activity size={24} /></div>
          <div><div className="stat-value">{officer.stats?.totalAssigned || 0}</div><div className="stat-label">Total Assigned</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}><ShieldCheck size={24} /></div>
          <div><div className="stat-value">{officer.stats?.totalResolved || 0}</div><div className="stat-label">Total Resolved</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}><AlertCircle size={24} /></div>
          <div><div className="stat-value">{officer.stats?.falseClosures || 0}</div><div className="stat-label">False Closures</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}><Clock size={24} /></div>
          <div><div className="stat-value">{officer.stats?.avgResolutionHours || 0}h</div><div className="stat-label">Avg Resolution Time</div></div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">Bandwidth & Capacity</div></div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>Current Workload</span>
              <span style={{ color: capacityPercent > 80 ? 'var(--danger)' : 'var(--text-muted)' }}>{officer.activeComplaints} / {officer.bandwidth} complaints active</span>
            </div>
            <div style={{ height: 12, background: 'var(--skeleton-base)', borderRadius: 6, overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ height: '100%', width: `${Math.min(100, capacityPercent)}%`, background: capacityPercent > 80 ? 'var(--danger)' : 'var(--primary)', transition: 'width 0.5s' }} />
            </div>
            
            {anomalies && anomalies.anomalies?.length > 0 && (
              <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
                <h4 style={{ color: '#991b1b', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={16} /> AI Detected Anomalies</h4>
                <ul style={{ margin: 0, paddingLeft: 20, color: '#7f1d1d', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {anomalies.anomalies.map((an, idx) => (
                    <li key={idx}>{an.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {!anomalies && (
              <div style={{ padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#166534', fontSize: 13 }}>
                <ShieldCheck size={16} /> No behavioral anomalies detected by AI.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Resolution History Breakdown</div></div>
          <div className="card-body" style={{ height: 300 }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={pieData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={100} 
                    paddingAngle={5} 
                    dataKey="value"
                    className="clickable-chart-area"
                    onClick={(data) => navigate(`/complaints?status=${encodeURIComponent(data.name.toLowerCase())}&assignedTo=${encodeURIComponent(id)}`)}
                  >
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No data available</div>}
          </div>
        </div>
      </div>
      
      {recentComplaints.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title">Recent Caseload</div></div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Filed By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentComplaints.map(c => (
                  <tr key={c._id} style={{ cursor: 'pointer' }} className="hover-bg" onClick={() => navigate(`/complaints/${c._id}`)}>
                    <td><span style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--card-hover)', padding: '2px 6px', borderRadius: 4 }}>{c.ticketId}</span></td>
                    <td>
                      <div style={{ fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                    </td>
                    <td><span className={`badge badge-${c.status}`}>{formatStatus(c.status)}</span></td>
                    <td><span style={{ fontSize: 12 }}>{c.citizen?.name || 'Unknown'}</span></td>
                    <td><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{format(new Date(c.createdAt), 'dd MMM yy')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
