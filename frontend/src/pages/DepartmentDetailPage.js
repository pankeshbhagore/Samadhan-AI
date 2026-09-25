import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDepartmentAnalysis } from '../services/api';
import { ChevronLeft, Building2, Users, AlertCircle, Clock, ShieldCheck, Mail } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatStatus } from '../utils/helpers';
import { format } from 'date-fns';

export default function DepartmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDepartmentAnalysis(id)
      .then(res => setData(res.data))
      .catch(() => navigate('/departments'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>;
  if (!data || !data.department) return null;

  const { department: dept, officers, complaintStats, recentComplaints } = data;

  // Prepare Chart Data
  const pieData = complaintStats.map(s => ({ name: formatStatus(s._id), value: s.count, rawStatus: s._id }));
  const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#64748b'];

  const totalComplaints = complaintStats.reduce((acc, curr) => acc + curr.count, 0);
  const totalBreaches = complaintStats.reduce((acc, curr) => acc + curr.slaBreaches, 0);
  const avgResTime = complaintStats.filter(s => s.avgResolutionTime).length > 0
    ? (complaintStats.reduce((acc, curr) => acc + (curr.avgResolutionTime || 0), 0) / complaintStats.length).toFixed(1)
    : 0;

  return (
    <div className="page-content" style={{ padding: '0 0 32px 0', animation: 'fadeIn 0.4s ease-out' }}>
      <button className="btn btn-outline btn-sm" onClick={() => navigate('/departments')} style={{ marginBottom: 20 }}>
        <ChevronLeft size={16} /> Back to Departments
      </button>

      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, var(--primary) 0%, #1e1b4b 100%)', color: 'white', border: 'none' }}>
        <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
          <div style={{ width: 80, height: 80, background: 'rgba(255,255,255,0.1)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={40} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, fontFamily: 'Outfit' }}>{dept.name}</h1>
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{dept.code}</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 12 }}>{dept.description || 'No description provided'}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
              {dept.head && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={14} /> Head: {dept.head.name}</span>}
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} /> SLA: {dept.slaHours} hours</span>
              {dept.contactEmail && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={14} /> {dept.contactEmail}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}><AlertCircle size={24} /></div>
          <div><div className="stat-value">{totalComplaints}</div><div className="stat-label">Total Complaints</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}><ShieldCheck size={24} /></div>
          <div><div className="stat-value">{officers.length}</div><div className="stat-label">Active Officers</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}><Clock size={24} /></div>
          <div><div className="stat-value">{totalBreaches}</div><div className="stat-label">SLA Breaches</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}><Users size={24} /></div>
          <div><div className="stat-value">{avgResTime}h</div><div className="stat-label">Avg Resolution Time</div></div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">Complaint Status Distribution</div></div>
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
                    onClick={(data) => navigate(`/complaints?status=${encodeURIComponent(data.name.toLowerCase())}&department=${encodeURIComponent(id)}`)}
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

        <div className="card">
          <div className="card-header"><div className="card-title">Officer Workload & Capacity</div></div>
          <div className="card-body" style={{ height: 300, overflowY: 'auto', padding: '16px 20px' }}>
            {officers.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {officers.map(o => (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '6px', borderRadius: 8, transition: 'background 0.2s' }} className="hover-bg" onClick={() => navigate(`/officers/${o.id}`)}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-light)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{o.name.charAt(0)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{o.name}</span>
                        <span style={{ color: o.capacityPercent > 80 ? 'var(--danger)' : 'var(--text-muted)' }}>{o.activeComplaints} / {o.bandwidth} active</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--skeleton-base)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, o.capacityPercent)}%`, background: o.capacityPercent > 80 ? 'var(--danger)' : 'var(--primary)', transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No officers assigned</div>}
          </div>
        </div>
      </div>
      
      {recentComplaints.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title">Recent Activity</div></div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentComplaints.map(c => (
                  <tr key={c._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/complaints/${c._id}`)}>
                    <td><span style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--card-hover)', padding: '2px 6px', borderRadius: 4 }}>{c.ticketId}</span></td>
                    <td>
                      <div style={{ fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                    </td>
                    <td><span className={`badge badge-${c.status}`}>{formatStatus(c.status)}</span></td>
                    <td><span style={{ fontSize: 12 }}>{c.assignedTo?.name || 'Unassigned'}</span></td>
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
