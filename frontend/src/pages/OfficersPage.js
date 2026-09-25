import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOfficerPerformance, getDepartments } from '../services/api';
import { Trophy, MapPin, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function OfficersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [officers, setOfficers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('');
  const [filterState, setFilterState] = useState('');
  const [sortBy, setSortBy] = useState('totalResolved');

  const viewLevel = useMemo(() => {
    if (user?.role === 'super_admin' && !filterState) return 'states';
    if (user?.role === 'super_admin' && filterState && !filterDept) return 'departments';
    if (user?.role === 'cm' && !filterDept) return 'departments';
    return 'employees';
  }, [user?.role, filterState, filterDept]);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (user?.role === 'super_admin' && filterState) {
      params.state = filterState;
    }
    
    Promise.all([getOfficerPerformance(params), getDepartments(params)]).then(([oRes, dRes]) => {
      setOfficers(oRes.data.officers);
      setDepartments(dRes.data.departments);
    }).finally(() => setLoading(false));
  }, [filterState, user?.role]);

  // Top performers leaderboard — ranked by resolved count, with a minimum
  // bar so officers with 0 resolved complaints never appear "ranked"
  const leaderboard = useMemo(
    () => [...officers].filter((o) => o.stats?.totalResolved > 0).sort((a, b) => b.stats.totalResolved - a.stats.totalResolved).slice(0, 3),
    [officers]
  );

  const filtered = officers
    .filter((o) => !filterDept || o.department === departments.find((d) => d._id === filterDept)?.name)
    .sort((a, b) => {
      if (sortBy === 'totalResolved') return b.stats.totalResolved - a.stats.totalResolved;
      if (sortBy === 'falseClosures') return b.stats.falseClosures - a.stats.falseClosures;
      if (sortBy === 'capacity') return b.capacityPercent - a.capacityPercent;
      return 0;
    });

  const stateCards = useMemo(() => {
    if (viewLevel !== 'states') return [];
    const statsMap = {};
    departments.forEach(d => {
      if (!statsMap[d.state]) statsMap[d.state] = { total: 0, resolved: 0, depts: 0 };
      statsMap[d.state].total += (d.stats?.totalComplaints || 0);
      statsMap[d.state].resolved += (d.stats?.resolved || 0);
      statsMap[d.state].depts += 1;
    });
    const stateConfig = require('../utils/statesConfig').default;
    return Object.entries(statsMap).map(([code, stats]) => {
      const sObj = stateConfig.find(s => s.code === code);
      return { code, name: sObj ? sObj.name : code, ...stats };
    }).sort((a,b) => b.resolved - a.resolved);
  }, [viewLevel, departments]);

  const deptCards = useMemo(() => {
    if (viewLevel !== 'departments') return [];
    return [...departments].sort((a,b) => (b.stats?.resolved || 0) - (a.stats?.resolved || 0));
  }, [viewLevel, departments]);

  const getCapacityColor = (pct) => (pct >= 100 ? 'var(--danger)' : pct >= 70 ? 'var(--warning)' : 'var(--success)');

  if (loading && officers.length === 0) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>Officer Performance & Bandwidth</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Track officer workload, performance, and integrity</p>
      </div>

      {viewLevel !== 'states' && (
        <div style={{ marginBottom: 16 }}>
          <button className="btn btn-outline btn-sm" onClick={() => {
             if (viewLevel === 'employees' && user?.role === 'super_admin') {
               setFilterDept('');
             } else if (viewLevel === 'employees' && user?.role === 'cm') {
               setFilterDept('');
             } else if (viewLevel === 'departments' && user?.role === 'super_admin') {
               setFilterState('');
             }
          }}>← Go Back</button>
        </div>
      )}

      {viewLevel === 'employees' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ padding: '14px 20px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <select className="form-control" style={{ flex: '1 1 180px' }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="totalResolved">🏆 Top Performers (Most Resolved)</option>
              <option value="falseClosures">⚠️ Sort by: False Closures</option>
              <option value="capacity">Sort by: Workload</option>
            </select>
          </div>
        </div>
      )}

      {viewLevel === 'states' && (
        <div className="grid grid-3">
          {stateCards.map((s, i) => (
          <div key={s.code} className="card card-clickable" onClick={() => setFilterState(s.code)} style={{ position: 'relative', overflow: 'hidden' }}>
            {i === 0 && <div style={{ position: 'absolute', top: 0, right: 0, background: '#d97706', color: 'white', padding: '4px 12px', borderBottomLeftRadius: 10, fontSize: 11, fontWeight: 700 }}>🏆 #1 STATE</div>}
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: i === 0 ? 'var(--warning)' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MapPin size={22} color="white" /></div>
                <div><div style={{ fontWeight: 700, fontSize: 16 }}>{s.name}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.depts} Departments</div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'var(--card-hover)', borderRadius: 8, padding: '10px 12px' }}><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{s.total}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Assigned</div></div>
                <div style={{ background: 'var(--card-hover)', borderRadius: 8, padding: '10px 12px' }}><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{s.resolved}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Resolved</div></div>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}

      {viewLevel === 'departments' && (
        <div className="grid grid-3">
          {deptCards.map((d, i) => (
          <div key={d._id} className="card card-clickable" onClick={() => setFilterDept(d._id)} style={{ position: 'relative', overflow: 'hidden' }}>
            {i === 0 && <div style={{ position: 'absolute', top: 0, right: 0, background: '#059669', color: 'white', padding: '4px 12px', borderBottomLeftRadius: 10, fontSize: 11, fontWeight: 700 }}>🏆 #1 DEPARTMENT</div>}
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: i === 0 ? 'var(--success)' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Building2 size={22} color="white" /></div>
                <div><div style={{ fontWeight: 700, fontSize: 16 }}>{d.name}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Code: {d.code}</div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'var(--card-hover)', borderRadius: 8, padding: '10px 12px' }}><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{d.stats?.totalComplaints || 0}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Assigned</div></div>
                <div style={{ background: 'var(--card-hover)', borderRadius: 8, padding: '10px 12px' }}><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{d.stats?.resolved || 0}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Resolved</div></div>
              </div>
            </div>
          </div>
          ))}
        </div>
      )}

      {viewLevel === 'employees' && (() => {
        const deptHead = filtered.find(o => o.role === 'department_head');
        const regEmployees = filtered.filter(o => o.role !== 'department_head');
        
        const renderOfficerCard = (o) => (
          <div key={o.id} className="card card-clickable" onClick={() => navigate(`/officers/${o.id}`)} style={o.role === 'department_head' ? { borderLeft: '4px solid var(--primary)' } : {}}>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: o.role === 'department_head' ? 'var(--primary)' : 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>{o.name?.charAt(0)}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{o.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.designation}</div>
                  <div style={{ fontSize: 11, color: 'var(--primary)' }}>{o.department}</div>
                </div>
              </div>

              {o.role === 'employee' && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Workload</span>
                    <span style={{ fontWeight: 600, color: getCapacityColor(o.capacityPercent) }}>{o.capacityPercent}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--card-hover)', borderRadius: 3 }}>
                    <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, o.capacityPercent)}%`, background: getCapacityColor(o.capacityPercent), transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{o.activeComplaints}/{o.bandwidth} active complaints</div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                {[
                  ['Assigned', o.stats?.totalAssigned || 0, 'var(--primary)'],
                  ['Resolved', o.stats?.totalResolved || 0, 'var(--success)'],
                  ['Avg Time', `${o.stats?.avgResolutionHours || 0}h`, 'var(--info)'],
                  ['Satisfaction', o.stats?.avgSatisfactionScore ? `${o.stats.avgSatisfactionScore}/5 ⭐` : 'N/A', 'var(--warning)'],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ background: 'var(--card-hover)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color }}>{val}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
                  </div>
                ))}
              </div>

              {o.stats?.falseClosures > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>⚠️ {o.stats.falseClosures} false closure{o.stats.falseClosures > 1 ? 's' : ''} flagged</span>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>Rate: {o.falseClosureRate}%</div>
                </div>
              )}
            </div>
          </div>
        );

        return (
          <div>
            {deptHead && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Department Head</h3>
                <div className="grid grid-3">
                  {renderOfficerCard(deptHead)}
                </div>
              </div>
            )}
            {regEmployees.length > 0 && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Department Officers ({regEmployees.length})</h3>
                <div className="grid grid-3">
                  {regEmployees.map(renderOfficerCard)}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}><div style={{ fontSize: 40, marginBottom: 12 }}>👥</div><div>No officers found</div></div>}
    </div>
  );
}
