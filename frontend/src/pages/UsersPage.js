import React, { useState, useEffect, useCallback } from 'react';
import { getAllUsers, createUser, toggleUserActive, getDepartments, deleteUser, updateUser } from '../services/api';
import { getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, UserX, UserCheck, Edit2, Trash2, ShieldAlert } from 'lucide-react';

const ROLES = ['citizen', 'employee', 'department_head', 'cm', 'super_admin'];

const getDefaultRole = (userRole) => {
  if (userRole === 'super_admin') return 'cm';
  if (userRole === 'cm') return 'department_head';
  return 'employee';
};

const getRolesForUser = (userRole, deptFilter) => {
  let allowed = [];
  if (userRole === 'super_admin') allowed = ['cm', 'department_head', 'super_admin'];
  else if (userRole === 'cm') allowed = ['citizen', 'employee', 'department_head', 'cm'];
  else if (userRole === 'department_head') allowed = ['employee'];
  
  if (deptFilter) {
    allowed = allowed.filter(r => ['employee', 'department_head'].includes(r));
  }
  return allowed;
};

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee', department: '', designation: '', bandwidth: 10, state: '' });

  // Verification Challenge State
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeAction, setChallengeAction] = useState(null); // 'edit' or 'delete'
  const [challengeEntity, setChallengeEntity] = useState(null);
  const [challengeForm, setChallengeForm] = useState({ confirmName: '', password: '', justification: '' });
  const [challengeLoading, setChallengeLoading] = useState(false);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    getAllUsers({ role: roleFilter || undefined, search: search || undefined, state: stateFilter || undefined, department: deptFilter || undefined, limit: 100 })
      .then(({ data }) => setUsers(data.users))
      .finally(() => setLoading(false));
  }, [roleFilter, search, stateFilter, deptFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  
  useEffect(() => { 
    getDepartments(stateFilter ? { state: stateFilter } : undefined)
      .then(({ data }) => setDepartments(data.departments)); 
  }, [stateFilter]);

  useEffect(() => {
    if (showCreate && !editId) {
      const targetRole = form.role;
      const targetState = form.state || user?.state || 'MH';
      const targetDeptId = form.department || user?.department?._id;
      
      let nextNum = 1;
      
      if (targetRole === 'cm' && targetState) {
        const stateObj = require('../utils/statesConfig').default.find(s => s.code === targetState);
        if (stateObj) {
          const stateCMs = users.filter(u => u.role === 'cm' && u.state === targetState);
          stateCMs.forEach(u => {
            const match = u.email.match(/^cm(\d+)@/);
            if (match) nextNum = Math.max(nextNum, parseInt(match[1]) + 1);
          });
          // Only overwrite if it matches pattern or is empty
          setForm(f => {
            if (f.email && !/^cm\d+@/.test(f.email)) return f;
            return {
              ...f,
              name: `State Admin ${nextNum} ${targetState}`,
              email: `cm${nextNum}@${targetState.toLowerCase()}.samadhan.gov.in`,
              password: f.password || 'Password123!',
            };
          });
        }
      } else if (targetRole === 'department_head' && targetDeptId) {
        const deptObj = departments.find(d => d._id === targetDeptId);
        if (deptObj) {
          const deptHeads = users.filter(u => u.role === 'department_head' && (u.department?._id === targetDeptId || u.department === targetDeptId));
          deptHeads.forEach(u => {
            const match = u.email.match(/^head(\d+)\./);
            if (match) nextNum = Math.max(nextNum, parseInt(match[1]) + 1);
          });
          const deptSlug = deptObj.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          setForm(f => {
            if (f.email && !/^head\d+\./.test(f.email)) return f;
            return {
              ...f,
              name: `Head ${deptObj.name} ${nextNum} ${targetState}`,
              email: `head${nextNum}.${deptSlug}@${targetState.toLowerCase()}.samadhan.gov.in`,
              password: f.password || 'Password123!',
            };
          });
        }
      } else if (targetRole === 'employee' && targetDeptId) {
        const deptObj = departments.find(d => d._id === targetDeptId) || (user?.department?._id === targetDeptId ? user.department : null);
        if (deptObj) {
          const emps = users.filter(u => u.role === 'employee' && (u.department?._id === targetDeptId || u.department === targetDeptId));
          emps.forEach(u => {
            const match = u.email.match(/^officer(\d+)\./);
            if (match) nextNum = Math.max(nextNum, parseInt(match[1]) + 1);
          });
          const deptSlug = (deptObj.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          setForm(f => {
            if (f.email && !/^officer\d+\./.test(f.email)) return f;
            return {
              ...f,
              name: `Officer ${deptObj.name} ${nextNum} ${targetState}`,
              email: `officer${nextNum}.${deptSlug}@${targetState.toLowerCase()}.samadhan.gov.in`,
              designation: `Officer - ${deptObj.name}`,
              password: f.password || 'Password123!',
            };
          });
        }
      }
    }
  }, [showCreate, editId, form.role, form.department, form.state, users, departments, user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      if (editId) {
        // Edit requires challenge modal first if doing it from scratch, but since we are submitting the form:
        // Wait, if it's an edit, we pass the challenge password and justification from the form.
        // Actually, let's inject it.
        await updateUser(editId, { ...form, verificationPassword: challengeForm.password, actionJustification: challengeForm.justification });
        toast.success('User updated successfully');
      } else {
        await createUser(form);
        toast.success('User created successfully');
      }
      setShowCreate(false);
      setEditId(null);
      setForm({ name: '', email: '', password: '', role: 'employee', department: '', designation: '', bandwidth: 10, state: '' });
      setChallengeForm({ confirmName: '', password: '', justification: '' });
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save user'));
    } finally { setCreating(false); }
  };

  const openChallenge = (action, entity) => {
    setChallengeAction(action);
    setChallengeEntity(entity);
    setChallengeForm({ confirmName: '', password: '', justification: '' });
    setShowChallenge(true);
  };

  const handleChallengeSubmit = async (e) => {
    e.preventDefault();
    if (challengeForm.confirmName !== challengeEntity.name) {
      return toast.error('Entity name does not match');
    }
    if (challengeForm.justification.length < 10) {
      return toast.error('Justification must be at least 10 characters');
    }

    setChallengeLoading(true);
    try {
      if (challengeAction === 'delete') {
        // We pass the auth to the query / body
        await deleteUser(challengeEntity._id, { params: { verificationPassword: challengeForm.password, actionJustification: challengeForm.justification }});
        toast.success('User deleted successfully');
        setShowChallenge(false);
        fetchUsers();
      } else if (challengeAction === 'edit') {
        // Unlock edit form
        setShowChallenge(false);
        setEditId(challengeEntity._id);
        setForm({ 
          name: challengeEntity.name, email: challengeEntity.email, password: '', 
          role: challengeEntity.role, department: challengeEntity.department?._id || '', 
          designation: challengeEntity.designation || '', bandwidth: challengeEntity.bandwidth || 10, 
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

  const handleToggle = async (u) => {
    try {
      const { data } = await toggleUserActive(u._id);
      setUsers((list) => list.map((x) => (x._id === u._id ? data.user : x)));
      toast.success(data.user.isActive ? `${u.name} reactivated` : `${u.name} deactivated`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed'));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>👥 User Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{users.length} total users</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditId(null); setForm({ name: '', email: '', password: '', role: getDefaultRole(user?.role), department: '', designation: '', bandwidth: 10, state: '' }); setShowCreate(true); }}><Plus size={16} /> Add User</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '14px 20px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="form-control" placeholder="Search by name or email..." style={{ paddingLeft: 32 }} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {user?.role === 'super_admin' && (
            <select className="form-control" style={{ flex: '1 1 140px' }} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <option value="">All States</option>
              {require('../utils/statesConfig').default.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          )}
          {['super_admin', 'cm'].includes(user?.role) && !['super_admin', 'cm', 'citizen'].includes(roleFilter) && (
            <select className="form-control" style={{ flex: '1 1 140px' }} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          )}
          {['super_admin', 'cm'].includes(user?.role) && (
            <select className="form-control" style={{ flex: '1 1 120px' }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All Roles</option>
              {getRolesForUser(user?.role, deptFilter).map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>No users found</div>
          ) : (
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</td>
                    <td><span className="badge" style={{ background: '#eff6ff', color: 'var(--primary)', textTransform: 'capitalize' }}>{u.role?.replace('_', ' ')}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.department?.name || '—'}</td>
                    <td>
                      <span className="badge" style={{ background: u.isActive ? '#f0fdf4' : '#fef2f2', color: u.isActive ? '#166534' : '#991b1b' }}>
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className={`btn btn-sm btn-icon ${u.isActive ? 'btn-outline' : 'btn-success'}`} title={u.isActive ? "Deactivate" : "Reactivate"} onClick={() => handleToggle(u)}>
                          {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button className="btn btn-sm btn-icon btn-outline" title="Edit" onClick={() => openChallenge('edit', u)}><Edit2 size={14} /></button>
                        <button className="btn btn-sm btn-icon" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} title="Delete" onClick={() => openChallenge('delete', u)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editId ? 'Edit User' : 'Add New User'}</div>
              <button className="btn btn-icon" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="grid grid-2">
                  <div className="form-group">
                    <label className="form-label">Name *</label>
                    <input className="form-control" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input type="email" className="form-control" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
                  </div>
                </div>
                {!editId && (
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input type="password" className="form-control" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} minLength={6} required />
                  </div>
                )}
                
                {form.role === 'cm' && (
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <select className="form-control" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}>
                      <option value="">None (All India)</option>
                      {require('../utils/statesConfig').default.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                    </select>
                  </div>
                )}

                {form.role === 'department_head' && (
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <select className="form-control" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
                      <option value="">None</option>
                      {departments.filter(d => !user?.state || d.state === user?.state).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                  </div>
                )}

                {form.role === 'employee' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Designation</label>
                      <input className="form-control" value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Bandwidth (max complaints)</label>
                      <input type="number" className="form-control" min={1} value={form.bandwidth} onChange={(e) => setForm((f) => ({ ...f, bandwidth: parseInt(e.target.value) || 1 }))} />
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Saving...' : (editId ? 'Update User' : 'Create User')}</button>
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
                  <label className="form-label">Type the exact name <strong>{challengeEntity?.name}</strong> to confirm:</label>
                  <input className="form-control" value={challengeForm.confirmName} onChange={(e) => setChallengeForm(f => ({ ...f, confirmName: e.target.value }))} required />
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
