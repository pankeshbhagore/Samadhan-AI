import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getComplaints } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORY_OPTIONS, PRIORITY_COLORS, formatStatus, formatCategory, exportToCSV } from '../utils/helpers';
import { getDepartments, getOfficers } from '../services/api';
import { SkeletonTableRows } from '../components/shared/Skeletons';
import { format } from 'date-fns';
import { Search, Plus, ChevronLeft, ChevronRight, Download, AlertTriangle } from 'lucide-react';

export default function ComplaintsPage() {
  const { isCitizen, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    category: searchParams.get('category') || '',
    state: searchParams.get('state') || '',
    sentiment: searchParams.get('sentiment') || '',
    hasDuplicates: searchParams.get('hasDuplicates') || '',
    isCritical: searchParams.get('isCritical') || '',
    department: '',
    assignedTo: '',
    search: '',
    limit: 5,
    page: 1
  });
  
  const [departments, setDepartments] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const searchTimeout = useRef(null);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      // Prevent standard users from passing arbitrary state filter
      if (user?.role !== 'super_admin') delete params.state;
      const { data } = await getComplaints(params);
      setComplaints(data.complaints);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [filters, user?.role]);

  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  // Fetch departments when state changes (or globally if admin)
  useEffect(() => {
    const params = {};
    if (user?.role === 'super_admin' && filters.state) params.state = filters.state;
    getDepartments(params).then(res => setDepartments(res.data.departments)).catch(() => {});
  }, [filters.state, user?.role]);

  // Fetch officers when department changes
  useEffect(() => {
    if (!filters.department) {
      setOfficers([]);
      return;
    }
    const params = { department: filters.department };
    if (user?.role === 'super_admin' && filters.state) params.state = filters.state;
    getOfficers(params).then(res => setOfficers(res.data.officers)).catch(() => {});
  }, [filters.department, filters.state, user?.role]);

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val, ...(key !== 'page' && { page: 1 }) }));

  const handleSearchChange = (value) => {
    setSearchInput(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setFilter('search', value), 400);
  };

  const handleExportCSV = async () => {
    try {
      const params = { ...filters, limit: 10000, page: 1 };
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      if (user?.role !== 'super_admin') delete params.state;
      const { data } = await getComplaints(params);
      const allComplaints = data.complaints;
      if (allComplaints.length === 0) return toast.error('No complaints to export');
    exportToCSV(
      allComplaints,
      [
        { label: 'Ticket ID', value: 'ticketId' },
        { label: 'Title', value: 'title' },
        { label: 'Category', value: 'category' },
        { label: 'Priority', value: 'priority' },
        { label: 'Status', value: 'status' },
        { label: 'Ward', value: 'ward' },
        { label: 'District', value: 'district' },
        { label: 'Address', value: 'address' },
        { label: 'Citizen', value: (r) => r.citizen?.name || '' },
        { label: 'Assigned Officer', value: (r) => r.assignedTo?.name || '' },
        { label: 'Submitted', value: (r) => format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm') },
        { label: 'Critical', value: (r) => (r.isCritical ? 'Yes' : 'No') },
      ],
      `complaints-export-${format(new Date(), 'yyyy-MM-dd')}.csv`
      );
      toast.success(`Exported ${allComplaints.length} complaints`);
    } catch (err) {
      toast.error('Failed to export complaints');
    }
  };

  const priorityDot = (p) => <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLORS[p] || '#ccc', display: 'inline-block', marginRight: 4 }} />;

  const getPageTitle = () => {
    if (isCitizen()) return 'My Complaints';
    if (filters.sentiment === 'Angry') return '🚨 Frustrated Citizens (Unresolved)';
    if (filters.sentiment === 'Positive') return '✅ Satisfied Outcomes (Resolved)';
    if (filters.sentiment === 'Neutral') return 'Neutral Complaints';
    if (filters.isCritical === 'true') return '🚨 Critical Complaints';
    if (filters.hasDuplicates === 'true') return 'Duplicate Complaints';
    return 'All Complaints';
  };

  const handleSentimentToggle = (newSentiment) => {
    setFilters(f => ({ ...f, sentiment: newSentiment, page: 1 }));
    searchParams.set('sentiment', newSentiment);
    navigate(`/complaints?${searchParams.toString()}`, { replace: true });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>{getPageTitle()}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{pagination.total || 0} total complaints</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {filters.sentiment && (
            <>
              {filters.sentiment !== 'Angry' && (
                <button className="btn btn-outline" onClick={() => handleSentimentToggle('Angry')} style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                  Frustrated (Unresolved)
                </button>
              )}
              {filters.sentiment !== 'Positive' && (
                <button className="btn btn-outline" onClick={() => handleSentimentToggle('Positive')} style={{ borderColor: 'var(--success)', color: 'var(--success)' }}>
                  Satisfied (Resolved)
                </button>
              )}
              {filters.sentiment !== 'Neutral' && (
                <button className="btn btn-outline" onClick={() => handleSentimentToggle('Neutral')} style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}>
                  Neutral
                </button>
              )}
              <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
              <button className="btn btn-outline" onClick={() => navigate('/sentiment')} style={{ background: '#f8fafc' }}>
                <ChevronLeft size={16} /> Back
              </button>
            </>
          )}
          <button className="btn btn-outline" onClick={handleExportCSV} disabled={complaints.length === 0}><Download size={16} /> Export CSV</button>
          {isCitizen() && <button className="btn btn-primary" onClick={() => navigate('/complaints/new')}><Plus size={16} /> Submit Complaint</button>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-control" placeholder="Search complaints..." style={{ paddingLeft: 32 }} value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
            </div>
            {user?.role === 'super_admin' && (
              <select className="form-control" style={{ flex: '1 1 140px' }} value={filters.state} onChange={(e) => {
                setFilters(f => ({ ...f, state: e.target.value, department: '', assignedTo: '', page: 1 }));
              }}>
                <option value="">All India</option>
                {require('../utils/statesConfig').default.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            )}
            {!['department_head', 'employee'].includes(user?.role) && (
              <select className="form-control" style={{ flex: '1 1 140px' }} value={filters.department} onChange={(e) => {
                setFilters(f => ({ ...f, department: e.target.value, assignedTo: '', page: 1 }));
              }}>
                <option value="">All Departments</option>
                {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            )}
            {['super_admin', 'cm', 'department_head'].includes(user?.role) && (
              <select className="form-control" style={{ flex: '1 1 140px' }} value={filters.assignedTo} onChange={(e) => setFilter('assignedTo', e.target.value)} disabled={!filters.department}>
                <option value="">All Officers</option>
                {officers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
            <select className="form-control" style={{ flex: '1 1 140px' }} value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
              <option value="">All Status</option>
              {['submitted', 'under_review', 'assigned', 'in_progress', 'pending_verification', 'resolved', 'reopened', 'escalated', 'rejected'].map((s) => (
                <option key={s} value={s}>{formatStatus(s)}</option>
              ))}
            </select>
            <select className="form-control" style={{ flex: '1 1 140px' }} value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>
              <option value="">All Priorities</option>
              <option value="critical">🚨 Critical</option>
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
            <select className="form-control" style={{ flex: '1 1 160px' }} value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {(filters.status || filters.priority || filters.category || filters.department || filters.assignedTo) && (
              <button className="btn btn-outline btn-sm" onClick={() => setFilters({ status: '', priority: '', category: '', search: '', department: '', assignedTo: '', page: 1 })}>Clear</button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          {loading ? (
            <table>
              <thead>
                <tr>
                  <th>Ticket ID</th><th>Title</th><th>Category</th><th>Priority</th><th>Status</th><th>Location</th><th>Date</th>
                  {!isCitizen() && <th>Citizen</th>}
                </tr>
              </thead>
              <tbody><SkeletonTableRows rows={6} cols={isCitizen() ? 7 : 8} /></tbody>
            </table>
          ) : complaints.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontWeight: 600 }}>No complaints found</div>
              {isCitizen() && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/complaints/new')}>Submit a Complaint</button>}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Ticket ID</th><th>Title</th><th>Category</th><th>Priority</th><th>Status</th><th>Location</th><th>Date</th>
                  {!isCitizen() && <th>Citizen</th>}
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c._id} style={{ cursor: 'pointer', background: c.adminReminder ? '#fff1f2' : 'transparent' }} onClick={() => navigate(`/complaints/${c._id}`)}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, background: c.adminReminder ? '#ffe4e6' : 'var(--card-hover)', padding: '2px 6px', borderRadius: 4, color: c.adminReminder ? '#be123c' : 'inherit', fontWeight: c.adminReminder ? 600 : 'normal' }}>{c.ticketId}</span>
                          {c.isCritical && <span style={{ marginLeft: 4 }}>🚨</span>}
                        </div>
                        {c.adminReminder && (
                          <div style={{ fontSize: 10, color: '#be123c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <AlertTriangle size={10} /> State Admin Reminder
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                      {c.isDuplicate && <span style={{ fontSize: 10, color: 'var(--warning)' }}>Duplicate</span>}
                    </td>
                    <td><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatCategory(c.category)}</span></td>
                    <td>{priorityDot(c.priority)}<span style={{ fontSize: 12, textTransform: 'capitalize', color: PRIORITY_COLORS[c.priority] }}>{c.priority}</span></td>
                    <td><span className={`badge badge-${c.status}`}>{formatStatus(c.status)}</span></td>
                    <td><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.ward || c.district || '—'}</span></td>
                    <td><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{format(new Date(c.createdAt), 'dd MMM yy')}</span></td>
                    {!isCitizen() && <td><span style={{ fontSize: 12 }}>{c.citizen?.name || '—'}</span></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pagination.pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span>
              <select 
                className="form-control" 
                style={{ width: 'auto', padding: '4px 8px', fontSize: 13, height: 30 }}
                value={filters.limit || 5} 
                onChange={(e) => setFilters(f => ({ ...f, limit: e.target.value, page: 1 }))}
              >
                <option value="5">5 per page</option>
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" disabled={pagination.page <= 1} onClick={() => setFilter('page', pagination.page - 1)}><ChevronLeft size={14} /> Prev</button>
              <button className="btn btn-outline btn-sm" disabled={pagination.page >= pagination.pages} onClick={() => setFilter('page', pagination.page + 1)}>Next <ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
