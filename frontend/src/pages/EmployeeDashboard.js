import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getComplaints, getMyStats, getDashboardStats, getOfficerPerformance } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PRIORITY_COLORS, formatStatus, formatCategory } from '../utils/helpers';
import { format } from 'date-fns';
import { Clock, CheckCircle, AlertTriangle, List, TrendingUp, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#1a3a6b', '#ff6b35', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myComplaints, setMyComplaints] = useState([]);
  const [myStats, setMyStats] = useState({ total: 0, pending: 0, resolved: 0, critical: 0 });
  const [deptStats, setDeptStats] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    const promises = [
      getComplaints({ limit: 100 }),
      getMyStats()
    ];

    if (user?.role === 'department_head') {
      promises.push(getDashboardStats());
      promises.push(getOfficerPerformance());
    }

    Promise.all(promises)
      .then(([complaintsRes, statsRes, deptStatsRes, officersRes]) => {
        setMyComplaints(complaintsRes.data.complaints);
        setMyStats(statsRes.data.stats);
        if (deptStatsRes) setDeptStats(deptStatsRes.data.stats);
        if (officersRes) setOfficers(officersRes.data.officers || []);
      })
      .catch(() => toast.error('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, [user]);

  const total = myStats.total;
  const pending = myStats.pending;
  const resolved = myStats.resolved;
  const critical = myStats.critical;

  const filtered = myComplaints.filter((c) => (activeTab === 'active' ? !['resolved', 'rejected'].includes(c.status) : c.status === 'resolved'));
  const remindersCount = myComplaints.filter(c => c.adminReminder).length;

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>👷 My Work Dashboard</h1>
        <p style={{ color: 'var(--text-muted)' }}>Welcome, {user?.name} — {user?.designation}</p>
      </div>

      {user?.role === 'department_head' && remindersCount > 0 && (
        <div className="alert" style={{ background: '#fff1f2', border: '1px solid #fecaca', color: '#be123c', padding: '16px 20px', borderRadius: 8, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(190, 18, 60, 0.1)' }} onClick={() => navigate('/complaints')}>
          <AlertTriangle size={24} />
          <span>URGENT: You have {remindersCount} {remindersCount === 1 ? 'complaint' : 'complaints'} flagged by the State Admin for immediate assignment! Click here to view.</span>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/my-complaints')}><div className="stat-icon" style={{ background: '#eff6ff' }}><List size={22} color="var(--primary)" /></div><div><div className="stat-value" style={{ color: 'var(--primary)' }}>{total}</div><div className="stat-label">{user?.role === 'department_head' ? 'Department Total' : 'Total Assigned'}</div></div></div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/complaints?status=submitted,assigned,in_progress')}><div className="stat-icon" style={{ background: '#fff7ed' }}><Clock size={22} color="var(--warning)" /></div><div><div className="stat-value" style={{ color: 'var(--warning)' }}>{pending}</div><div className="stat-label">Pending</div></div></div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/complaints?status=resolved')}><div className="stat-icon" style={{ background: '#f0fdf4' }}><CheckCircle size={22} color="var(--success)" /></div><div><div className="stat-value" style={{ color: 'var(--success)' }}>{resolved}</div><div className="stat-label">Resolved</div></div></div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/complaints?priority=critical')}><div className="stat-icon" style={{ background: '#fef2f2' }}><AlertTriangle size={22} color="var(--danger)" /></div><div><div className="stat-value" style={{ color: 'var(--danger)' }}>{critical}</div><div className="stat-label">Critical</div></div></div>
      </div>

      {user?.role === 'employee' && (
        <div className="grid grid-2" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="card-body" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Workload Capacity</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0 0' }}>Your current active assignments versus bandwidth.</p>
                </div>
                <div style={{ padding: '6px 12px', background: 'var(--bg)', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {pending || 0} / {user?.bandwidth || 10}
                </div>
              </div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={[
                        { name: 'Active', value: pending || 0 }, 
                        { name: 'Free Capacity', value: Math.max(0, (user?.bandwidth || 10) - (pending || 0)) }
                      ]}
                      innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none"
                    >
                      <Cell fill="var(--primary)" />
                      <Cell fill="var(--border)" />
                    </Pie>
                    <Tooltip formatter={(val) => [val, 'Complaints']} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="card" style={{ background: 'linear-gradient(135deg, #1a3a6b 0%, #1e40af 100%)', color: 'white' }}>
            <div className="card-body" style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 12px 0' }}>Keep up the great work!</h2>
              <p style={{ margin: 0, opacity: 0.9, lineHeight: 1.5 }}>You have resolved {resolved} complaints total.<br/>Your prompt action keeps the city moving smoothly.</p>
              <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: 8, flex: 1 }}>
                  <div style={{ fontSize: 12, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1 }}>Pending</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{pending}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: 8, flex: 1 }}>
                  <div style={{ fontSize: 12, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1 }}>Critical</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{critical}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {user?.role === 'department_head' && deptStats && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>📊 Department Overview</h2>
          <div className="grid grid-2">
            <div className="card">
              <div className="card-body" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Complaints by Category</h3>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(deptStats.categoryCounts || []).map((c) => ({ name: formatCategory(c._id), Total: c.count, Resolved: c.resolved || 0 }))} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip cursor={{ fill: 'var(--card-hover)' }} contentStyle={{ borderRadius: 8 }} />
                      <Legend />
                      <Bar dataKey="Total" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={12} />
                      <Bar dataKey="Resolved" fill="var(--success)" radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-body" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Officer Performance Leaderboard</h3>
                <div style={{ maxHeight: 260, overflowY: 'auto', paddingRight: 8 }} className="custom-scroll">
                  {officers.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No officers found.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {officers.slice(0, 5).map((off, idx) => (
                        <div key={off._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 14, background: idx === 0 ? '#fef08a' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#fed7aa' : 'var(--border)', color: idx < 3 ? '#000' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                            #{idx + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{off.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{off.designation}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: 'var(--success)' }}>{off.stats?.totalResolved || 0} Resolved</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg: {off.stats?.avgResolutionHours ? Math.round(off.stats.avgResolutionHours) : '--'}h</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {myComplaints.filter((c) => c.isCritical && c.status !== 'resolved').map((c) => (
        <div key={c._id} className="alert alert-critical" style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => navigate(`/complaints/${c._id}`)}>
          <AlertTriangle size={16} />
          <div style={{ flex: 1 }}><strong>🚨 CRITICAL: {c.title}</strong><div style={{ fontSize: 11 }}>{c.address} • {c.criticalReason}</div></div>
          <span style={{ fontSize: 12 }}>View →</span>
        </div>
      ))}

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn btn-sm ${activeTab === 'active' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('active')}>Active ({myComplaints.filter((c) => !['resolved', 'rejected'].includes(c.status)).length})</button>
            <button className={`btn btn-sm ${activeTab === 'resolved' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('resolved')}>Resolved ({resolved})</button>
          </div>
        </div>
        <div className="card-body">
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}><div style={{ fontSize: 36, marginBottom: 8 }}>{activeTab === 'active' ? '✅' : '📭'}</div><div>{activeTab === 'active' ? 'No active complaints!' : 'No resolved complaints yet'}</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map((c) => (
                <div key={c._id} onClick={() => navigate(`/complaints/${c._id}`)}
                  style={{ border: `1px solid ${c.isCritical ? '#fecaca' : 'var(--border)'}`, borderLeft: `4px solid ${PRIORITY_COLORS[c.priority] || '#ccc'}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', background: c.isCritical ? 'var(--badge-critical-bg, #fff5f5)' : 'var(--card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{c.ticketId}</span>
                    <span className={`badge badge-${c.status}`}>{formatStatus(c.status)}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{c.isCritical && '🚨 '}{c.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📍 {c.address}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>📂 {formatCategory(c.category)}</span>
                    <span>📅 {format(new Date(c.createdAt), 'dd MMM')}</span>
                    {c.dueDate && <span style={{ color: new Date(c.dueDate) < new Date() ? 'var(--danger)' : 'inherit' }}>⏰ Due: {format(new Date(c.dueDate), 'dd MMM')}</span>}
                  </div>
                  {c.status === 'pending_verification' && <div style={{ marginTop: 8, fontSize: 12, background: '#fefce8', color: '#854d0e', padding: '4px 8px', borderRadius: 6 }}>⏳ Awaiting citizen verification</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
