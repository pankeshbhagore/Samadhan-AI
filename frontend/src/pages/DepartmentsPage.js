import React, { useState, useEffect } from 'react';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../services/api';
import { getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';
import { Plus, Building2, Edit2, Trash2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const ALL_CATEGORIES = [
  'roads_potholes', 'water_supply', 'garbage_sanitation', 'sewage', 'electricity',
  'street_lights', 'traffic', 'encroachment', 'pollution', 'park_maintenance',
  'building_safety', 'drainage', 'public_transport', 'noise_complaint', 'other'
];

export default function DepartmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '', slaHours: 72, contactEmail: '', contactPhone: '', complaintCategories: [], state: '' });
  const [filterState, setFilterState] = useState('');

  // Verification Challenge State
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeAction, setChallengeAction] = useState(null); // 'edit' or 'delete'
  const [challengeEntity, setChallengeEntity] = useState(null);
  const [challengeForm, setChallengeForm] = useState({ confirmCode: '', password: '', justification: '' });
  const [challengeLoading, setChallengeLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (user?.role === 'super_admin' && filterState) {
      params.state = filterState;
    }
    getDepartments(params).then(({ data }) => setDepartments(data.departments)).finally(() => setLoading(false));
  }, [filterState, user?.role]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return toast.error('Name and code are required');
    setCreating(true);
    try {
      if (editId) {
        const { data } = await updateDepartment(editId, { ...form, verificationPassword: challengeForm.password, actionJustification: challengeForm.justification });
        setDepartments((d) => d.map(x => x._id === editId ? data.department : x));
        toast.success('Department updated!');
      } else {
        const { data } = await createDepartment(form);
        setDepartments((d) => [...d, data.department]);
        toast.success('Department created!');
      }
      setShowCreate(false);
      setEditId(null);
      setForm({ name: '', code: '', description: '', slaHours: 72, contactEmail: '', contactPhone: '', complaintCategories: [], state: '' });
      setChallengeForm({ confirmCode: '', password: '', justification: '' });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save department'));
    } finally { setCreating(false); }
  };

  const openChallenge = (e, action, entity) => {
    e.stopPropagation();
    setChallengeAction(action);
    setChallengeEntity(entity);
    setChallengeForm({ confirmCode: '', password: '', justification: '' });
    setShowChallenge(true);
  };

  const handleChallengeSubmit = async (e) => {
    e.preventDefault();
    if (challengeForm.confirmCode !== challengeEntity.code) {
      return toast.error('Department code does not match');
    }
    if (challengeForm.justification.length < 10) {
      return toast.error('Justification must be at least 10 characters');
    }

    setChallengeLoading(true);
    try {
      if (challengeAction === 'delete') {
        await deleteDepartment(challengeEntity._id, { params: { verificationPassword: challengeForm.password, actionJustification: challengeForm.justification }});
        setDepartments(d => d.filter(x => x._id !== challengeEntity._id));
        toast.success('Department deleted');
        setShowChallenge(false);
      } else if (challengeAction === 'edit') {
        setShowChallenge(false);
        setEditId(challengeEntity._id);
        setForm({ 
          name: challengeEntity.name, code: challengeEntity.code, description: challengeEntity.description || '', 
          slaHours: challengeEntity.slaHours || 72, contactEmail: challengeEntity.contactEmail || '', 
          contactPhone: challengeEntity.contactPhone || '', complaintCategories: challengeEntity.complaintCategories || [], 
          state: challengeEntity.state || '' 
        });
        setShowCreate(true);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Verification failed'));
    } finally {
      setChallengeLoading(false);
    }
  };

  const toggleCategory = (cat) => setForm((f) => ({ ...f, complaintCategories: f.complaintCategories.includes(cat) ? f.complaintCategories.filter((c) => c !== cat) : [...f.complaintCategories, cat] }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>🏛️ Departments</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Manage government departments and their complaint categories</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {user?.role === 'super_admin' && (
            <select className="form-control" value={filterState} onChange={(e) => setFilterState(e.target.value)}>
              <option value="">All India (Global View)</option>
              {require('../utils/statesConfig').default.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          )}
          <button className="btn btn-primary" onClick={() => { setEditId(null); setForm({ name: '', code: '', description: '', slaHours: 72, contactEmail: '', contactPhone: '', complaintCategories: [], state: '' }); setShowCreate(true); }}><Plus size={16} /> Add Department</button>
        </div>
      </div>

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div> : (
        <div className="grid grid-3">
          {departments.map((d) => (
            <div key={d._id} className="card card-clickable" onClick={() => navigate(`/departments/${d._id}`)}>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Building2 size={22} color="white" /></div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{d.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Code: {d.code}</div></div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-icon btn-sm btn-outline" onClick={(e) => openChallenge(e, 'edit', d)}><Edit2 size={12} /></button>
                    <button className="btn btn-icon btn-sm btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={(e) => openChallenge(e, 'delete', d)}><Trash2 size={12} /></button>
                  </div>
                </div>
                {d.description && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{d.description}</p>}
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1, background: 'var(--badge-neutral-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}><div style={{ fontWeight: 700, fontSize: 16, color: 'var(--info)' }}>{d.stats?.totalComplaints || 0}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total</div></div>
                  <div style={{ flex: 1, background: 'var(--badge-low-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}><div style={{ fontWeight: 700, fontSize: 16, color: 'var(--success)' }}>{d.stats?.resolved || 0}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Resolved</div></div>
                  <div style={{ flex: 1, background: 'var(--badge-medium-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}><div style={{ fontWeight: 700, fontSize: 16, color: 'var(--warning)' }}>{d.slaHours}h</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>SLA</div></div>
                </div>
                {d.complaintCategories?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {d.complaintCategories.map((c) => <span key={c} style={{ background: 'var(--badge-assigned-bg)', color: 'var(--badge-assigned-fg)', border: '1px solid var(--badge-assigned-border)', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>{c.replace('_', ' ')}</span>)}
                  </div>
                )}
                {d.head && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>👤 Head: {d.head?.name}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">{editId ? 'Edit Department' : 'Add Department'}</div><button className="btn btn-icon" onClick={() => setShowCreate(false)}>✕</button></div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="grid grid-2">
                  <div className="form-group"><label className="form-label">Name *</label><input className="form-control" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
                  <div className="form-group"><label className="form-label">Code *</label><input className="form-control" placeholder="e.g. ROADS" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} required /></div>
                </div>
                <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-2">
                  <div className="form-group"><label className="form-label">Contact Email</label><input type="email" className="form-control" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">SLA (hours)</label><input type="number" className="form-control" value={form.slaHours} onChange={(e) => setForm((f) => ({ ...f, slaHours: parseInt(e.target.value) || 1 }))} min={1} /></div>
                </div>
                {user?.role === 'super_admin' && (
                  <div className="form-group">
                    <label className="form-label">State *</label>
                    <select className="form-control" value={form.state || ''} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} required>
                      <option value="">Select State</option>
                      {require('../utils/statesConfig').default.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Complaint Categories</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ALL_CATEGORIES.map((cat) => (
                      <span key={cat} onClick={() => toggleCategory(cat)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', background: form.complaintCategories.includes(cat) ? 'var(--primary)' : '#f1f5f9', color: form.complaintCategories.includes(cat) ? 'white' : 'var(--text)', border: '1px solid var(--border)' }}>{cat.replace('_', ' ')}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Saving...' : (editId ? 'Update' : 'Create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChallenge && (
        <div className="modal-overlay" onClick={() => setShowChallenge(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
                <ShieldAlert size={20} /> Secure Action Verification
              </div>
              <button className="btn btn-icon" onClick={() => setShowChallenge(false)}>✕</button>
            </div>
            <form onSubmit={handleChallengeSubmit}>
              <div className="modal-body">
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 12, borderRadius: 8, color: '#991b1b', fontSize: 13, marginBottom: 16 }}>
                  You are attempting to <strong>{challengeAction.toUpperCase()}</strong> a government record. This action will be logged in the immutable audit trail.
                </div>
                <div className="form-group">
                  <label className="form-label">Type the exact code <strong>{challengeEntity?.code}</strong> to confirm:</label>
                  <input className="form-control" value={challengeForm.confirmCode} onChange={(e) => setChallengeForm(f => ({ ...f, confirmCode: e.target.value.toUpperCase() }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Your Admin Password *</label>
                  <input type="password" className="form-control" value={challengeForm.password} onChange={(e) => setChallengeForm(f => ({ ...f, password: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Justification (min 10 chars) *</label>
                  <textarea className="form-control" rows={3} placeholder="Why is this action necessary?" value={challengeForm.justification} onChange={(e) => setChallengeForm(f => ({ ...f, justification: e.target.value }))} minLength={10} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowChallenge(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} disabled={challengeLoading}>{challengeLoading ? 'Verifying...' : 'Verify & Proceed'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
