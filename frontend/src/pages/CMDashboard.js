import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getDashboardStats, getComplaints, getAiAnomalies } from '../services/api';
import { formatCategory, formatStatus, DATE_RANGE_PRESETS } from '../utils/helpers';
import statesConfig, { getStateName } from '../utils/statesConfig';
import { useAuth } from '../contexts/AuthContext';
import { SkeletonStatsGrid } from '../components/shared/Skeletons';
import { AlertTriangle, FileText, CheckCircle, X, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const COLORS = ['#1a3a6b', '#ff6b35', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

export default function CMDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [criticalComplaints, setCriticalComplaints] = useState([]);
  const [anomalies, setAnomalies] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(null); // null = all time
  const [selectedState, setSelectedState] = useState(''); // empty = all states (for super admin)
  const navigate = useNavigate();

  const fetchStats = useCallback(() => {
    setLoading(true);
    const params = {};
    if (rangeDays !== null) params.days = rangeDays;
    if (user?.role === 'super_admin' && selectedState) params.state = selectedState;

    Promise.all([
      getDashboardStats(params),
      getComplaints({ priority: 'critical', status: 'submitted,under_review,assigned,in_progress', limit: 5, ...(user?.role === 'super_admin' && selectedState ? { state: selectedState } : {}) }),
      getAiAnomalies(params)
    ]).then(([statsRes, critRes, anomalyRes]) => {
      setStats(statsRes.data.stats);
      setCriticalComplaints(critRes.data.complaints);
      setAnomalies(anomalyRes.data);
    }).finally(() => setLoading(false));
  }, [rangeDays, selectedState, user?.role]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const [prLoading, setPrLoading] = useState(false);
  const [prReport, setPrReport] = useState(null);
  const handleGeneratePR = async () => {
    setPrLoading(true);
    try {
      const { generatePressRelease } = require('../services/api');
      const { data } = await generatePressRelease();
      if (data.success) {
        setPrReport(data.report);
      } else {
        toast.error(data.report || 'Failed to generate PR');
      }
    } catch (err) {
      toast.error('Error connecting to OpenAI');
    } finally {
      setPrLoading(false);
    }
  };

  const [exportLoading, setExportLoading] = useState(false);
  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = new URL(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/complaints/export`);
      if (user?.role === 'super_admin' && selectedState) {
        url.searchParams.append('state', selectedState);
      }
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `complaints_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Export downloaded successfully');
    } catch (err) {
      toast.error('Failed to export CSV');
    } finally {
      setExportLoading(false);
    }
  };

  if (loading && !stats) return (
    <div>
      <div style={{ marginBottom: 24 }}><div className="skeleton skeleton-text" style={{ width: 280, height: 28 }} /></div>
      <SkeletonStatsGrid count={4} />
    </div>
  );

  const categoryData = stats?.categoryCounts?.map((c) => ({ name: formatCategory(c._id), value: c.count })) || [];
  const trendData = stats?.trend?.map((t) => ({ date: t._id?.slice(5), complaints: t.count })) || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {user?.role === 'super_admin' ? 'All India Admin Dashboard' : 'State Admin Grievance Dashboard'}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            {user?.role === 'super_admin' && !selectedState ? 'All India' : getStateName(user?.role === 'super_admin' ? selectedState : user?.state)} Grievance Intelligence System • {format(new Date(), 'EEEE, d MMMM yyyy')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {user?.role === 'super_admin' && (
            <select className="form-control" value={selectedState} onChange={(e) => setSelectedState(e.target.value)} style={{ minWidth: 200 }}>
              <option value="">All India (Global View)</option>
              {statesConfig.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          )}
          <div className="date-range-pills">
          <button className="btn btn-outline btn-sm" onClick={handleExportCSV} disabled={exportLoading}>
            {exportLoading ? 'Exporting...' : <><Download size={14} style={{ marginRight: 6 }} /> Export CSV</>}
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleGeneratePR} disabled={prLoading}>
            {prLoading ? 'Generating...' : <><FileText size={14} style={{ marginRight: 6 }} /> Auto PR Report</>}
          </button>
          {DATE_RANGE_PRESETS.map((p) => (
            <button key={p.label} className={`date-pill${rangeDays === p.days ? ' active' : ''}`} onClick={() => setRangeDays(p.days)} disabled={loading}>
              {p.label}
            </button>
          ))}
          </div>
        </div>
      </div>

      {criticalComplaints.length > 0 && (
        <div className="alert alert-critical" style={{ marginBottom: 20, cursor: 'pointer' }} onClick={() => navigate('/complaints?priority=critical')}>
          <AlertTriangle size={18} />
          <strong>🚨 {criticalComplaints.length} CRITICAL complaint{criticalComplaints.length > 1 ? 's' : ''} require immediate attention</strong>
          <span style={{ marginLeft: 'auto', fontSize: 12 }}>Click to view →</span>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/complaints')}>
          <div className="stat-icon" style={{ background: '#eff6ff' }}>📋</div>
          <div><div className="stat-value" style={{ color: 'var(--primary)' }}>{stats?.total || 0}</div><div className="stat-label">Total Complaints</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/complaints?status=submitted')}>
          <div className="stat-icon" style={{ background: '#fff7ed' }}>⏳</div>
          <div><div className="stat-value" style={{ color: 'var(--warning)' }}>{stats?.pending || 0}</div><div className="stat-label">Pending Action</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/complaints?status=resolved')}>
          <div className="stat-icon" style={{ background: '#f0fdf4' }}>✅</div>
          <div><div className="stat-value" style={{ color: 'var(--success)' }}>{stats?.resolved || 0}</div><div className="stat-label">Resolved</div><div className="stat-change" style={{ color: 'var(--success)' }}>{stats?.resolutionRate}% rate</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/complaints?priority=critical')}>
          <div className="stat-icon" style={{ background: '#fef2f2' }}>🚨</div>
          <div><div className="stat-value" style={{ color: 'var(--danger)' }}>{stats?.critical || 0}</div><div className="stat-label">Critical Alerts</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/audit')}>
          <div className="stat-icon" style={{ background: '#fef2f2' }}>⚠️</div>
          <div><div className="stat-value" style={{ color: 'var(--danger)' }}>{stats?.falseClosures || 0}</div><div className="stat-label">False Closures Caught</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/complaints')}>
          <div className="stat-icon" style={{ background: '#fefce8' }}>📅</div>
          <div><div className="stat-value" style={{ color: 'var(--warning)' }}>{stats?.overdueCount || 0}</div><div className="stat-label">Overdue Complaints</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer', gridColumn: 'span 2' }} onClick={() => navigate('/map')}>
          <div className="stat-icon" style={{ background: '#f0fdf4' }}>🗺️</div>
          <div><div className="stat-value" style={{ color: 'var(--primary)', fontSize: 20 }}>View Grievance Map</div><div className="stat-label">See all complaints on map with hotspots</div></div>
        </div>
      </div>

      {anomalies && (anomalies.officerAnomalies?.length > 0 || anomalies.departmentBottlenecks?.length > 0) && (
        <div className="card" style={{ marginBottom: 24, border: '1px solid rgba(124, 58, 237, 0.3)' }}>
          <div className="card-header" style={{ background: 'linear-gradient(135deg, rgba(26, 58, 107, 0.05), rgba(124, 58, 237, 0.05))', borderRadius: '12px 12px 0 0' }}>
            <div className="card-title">🤖 AI Insights & Anomalies</div>
          </div>
          <div className="card-body">
            <div className="grid grid-2">
              {anomalies.departmentBottlenecks?.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>DEPARTMENT BOTTLENECKS</div>
                  {anomalies.departmentBottlenecks.slice(0, 3).map((b, i) => (
                    <div key={i} className="anomaly-alert hover-bg" style={{ marginBottom: 8, padding: '10px 14px', cursor: 'pointer', transition: 'background 0.2s', borderRadius: 8 }} onClick={() => b.departmentId && navigate(`/departments/${b.departmentId}`)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--danger)' }}>{b.department}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', background: '#fecaca', color: '#991b1b', borderRadius: 4 }}>{b.severity.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: 12 }}>{b.overdue} overdue complaints • Avg age: {b.avgAgeHours}h</div>
                    </div>
                  ))}
                </div>
              )}
              {anomalies.officerAnomalies?.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>OFFICER BEHAVIOR</div>
                  {anomalies.officerAnomalies.slice(0, 3).map((a, i) => (
                    <div key={i} className="anomaly-alert hover-bg" style={{ marginBottom: 8, padding: '10px 14px', cursor: 'pointer', transition: 'background 0.2s', borderRadius: 8 }} onClick={() => a.officer?._id && navigate(`/officers/${a.officer._id}`)}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--danger)' }}>{a.officer.name}</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        {a.anomalies.map((an, j) => <div key={j}>⚠️ {an.message}</div>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">📈 {rangeDays === 0 ? "Today's" : rangeDays ? `${Math.min(rangeDays, 90)}-Day` : '7-Day'} Complaint Trend</div></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="complaints" stroke="var(--primary)" strokeWidth={2.5} dot={{ fill: 'var(--primary)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">🏷️ Complaints by Category</div></div>
          <div className="card-body">
            {categoryData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie 
                    data={categoryData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={80} 
                    dataKey="value" 
                    paddingAngle={2}
                    className="clickable-chart-area"
                    onClick={(data) => navigate(`/complaints?category=${encodeURIComponent(data.name)}`)}
                  >
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">🏛️ Department Performance</div>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/officers')}>View All</button>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats?.topDepts?.map((d) => ({ dept: d.dept?.[0]?.name?.split(' ')?.[0] || 'Unknown', deptId: d._id, total: d.total, resolved: d.resolved })) || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dept" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar 
                  dataKey="total" 
                  fill="#1a3a6b" 
                  name="Total" 
                  radius={[4, 4, 0, 0]} 
                  className="clickable-chart-area"
                  onClick={(data) => navigate(data.deptId ? `/departments/${data.deptId}` : '/departments')}
                />
                <Bar 
                  dataKey="resolved" 
                  fill="#16a34a" 
                  name="Resolved" 
                  radius={[4, 4, 0, 0]} 
                  className="clickable-chart-area"
                  onClick={(data) => navigate(data.deptId ? `/departments/${data.deptId}` : '/departments')}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">🚨 Critical Complaints</div>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/complaints?priority=critical')}>View All</button>
          </div>
          <div className="card-body" style={{ padding: '16px 20px' }}>
            {criticalComplaints.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <div>No critical complaints pending</div>
              </div>
            ) : criticalComplaints.map((c) => (
              <div key={c._id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate(`/complaints/${c._id}`)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🚨</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--danger)' }}>{c.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.address}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.criticalReason}</div>
                  </div>
                  <span className="badge badge-critical">CRITICAL</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">📊 Status Distribution</div></div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {stats?.statusCounts?.map((s) => (
              <div key={s._id} style={{ flex: '1 1 120px', background: 'var(--card-hover)', borderRadius: 10, padding: '14px 18px', cursor: 'pointer', border: '1px solid var(--border)' }} onClick={() => navigate(`/complaints?status=${s._id}`)}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>{s.count}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{formatStatus(s._id)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {prReport && (
        <div className="modal-overlay" onClick={() => setPrReport(null)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">AI Generated Press Release</div>
              <button className="btn btn-icon" onClick={() => setPrReport(null)}><X size={20} /></button>
            </div>
            <div className="modal-body markdown-body" style={{ lineHeight: 1.6, maxHeight: '60vh', overflowY: 'auto' }}>
              <ReactMarkdown>{prReport}</ReactMarkdown>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => { navigator.clipboard.writeText(prReport); toast.success('Copied to clipboard!'); }}>Copy Markdown</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
