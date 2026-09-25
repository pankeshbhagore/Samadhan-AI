import React, { useState, useEffect } from 'react';
import { getVisits, createVisit, updateVisit, deleteVisit } from '../services/api';
import { getErrorMessage } from '../utils/helpers';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Plus, MapPin, Calendar, Edit2, Trash2 } from 'lucide-react';

const STATUS_STYLES = {
  scheduled: { bg: '#eff6ff', color: '#1d4ed8' },
  in_progress: { bg: '#faf5ff', color: '#7e22ce' },
  completed: { bg: '#f0fdf4', color: '#16a34a' },
  cancelled: { bg: 'var(--card-hover)', color: '#64748b' }
};

export default function VisitsPage() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', ward: '', district: '', scheduledDate: '' });

  useEffect(() => {
    getVisits().then(({ data }) => setVisits(data.visits)).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Enter visit title');
    setCreating(true);
    try {
      if (editId) {
        const { data } = await updateVisit(editId, form);
        setVisits((v) => v.map(x => x._id === editId ? data.visit : x));
        toast.success('Visit updated!');
      } else {
        const { data } = await createVisit(form);
        setVisits((v) => [data.visit, ...v]);
        toast.success('Visit created!');
      }
      setShowCreate(false);
      setEditId(null);
      setForm({ title: '', description: '', ward: '', district: '', scheduledDate: '' });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save visit'));
    } finally { setCreating(false); }
  };

  const openEdit = (v) => {
    setEditId(v._id);
    setForm({ title: v.title, description: v.description || '', ward: v.ward || '', district: v.district || '', scheduledDate: v.scheduledDate ? new Date(v.scheduledDate).toISOString().slice(0, 16) : '' });
    setShowCreate(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this visit?')) return;
    try {
      await deleteVisit(id);
      setVisits(v => v.filter(x => x._id !== id));
      toast.success('Visit deleted');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete visit'));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>🚗 State Admin Visit Logs</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Track field visits, nearby complaints, and follow-up actions</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditId(null); setForm({ title: '', description: '', ward: '', district: '', scheduledDate: '' }); setShowCreate(true); }}><Plus size={16} /> Plan Visit</button>
      </div>

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div> :
      visits.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚗</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>No visits logged yet</div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Plan First Visit</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {visits.map((v) => {
            const ss = STATUS_STYLES[v.status] || STATUS_STYLES.scheduled;
            return (
              <div key={v._id} className="card">
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{v.title}</h3>
                        <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: ss.bg, color: ss.color, textTransform: 'capitalize' }}>{v.status?.replace('_', ' ')}</span>
                      </div>
                      {v.description && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{v.description}</p>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'right' }}>
                      {v.scheduledDate && <div><Calendar size={12} style={{ marginRight: 4 }} />{format(new Date(v.scheduledDate), 'dd MMM yyyy')}</div>}
                      {(v.ward || v.district) && <div style={{ marginBottom: 6 }}><MapPin size={12} style={{ marginRight: 4 }} />{[v.ward, v.district].filter(Boolean).join(', ')}</div>}
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 8 }}>
                        <button className="btn btn-icon btn-sm btn-outline" title="Edit" onClick={() => openEdit(v)}><Edit2 size={12} /></button>
                        <button className="btn btn-icon btn-sm btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} title="Delete" onClick={() => handleDelete(v._id)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 20, fontSize: 13, flexWrap: 'wrap' }}>
                    <div style={{ color: 'var(--text-muted)' }}>📍 <strong>{v.logs?.length || 0}</strong> location logs</div>
                    <div style={{ color: 'var(--text-muted)' }}>📋 <strong>{v.nearbyComplaints?.length || 0}</strong> nearby complaints found</div>
                    <div style={{ color: 'var(--text-muted)' }}>🏷️ <strong>{v.complaintsIdentified?.length || 0}</strong> complaints identified</div>
                  </div>

                  {v.logs?.length > 0 && (
                    <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--card-hover)', borderRadius: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Visit Log Summary:</div>
                      {v.logs.slice(0, 2).map((log, i) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>📍 {log.address || `Location ${i + 1}`}{log.notes && <span> — {log.notes.slice(0, 80)}</span>}</div>
                      ))}
                      {v.logs.length > 2 && <div style={{ fontSize: 11, color: 'var(--primary)' }}>+{v.logs.length - 2} more logs</div>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">{editId ? '📍 Edit Visit' : '📍 Plan New Visit'}</div><button className="btn btn-icon" onClick={() => setShowCreate(false)}>✕</button></div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Visit Title *</label><input className="form-control" placeholder="e.g. Dwarka Sector 12 Field Visit" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={2} placeholder="Purpose of the visit..." value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-2">
                  <div className="form-group"><label className="form-label">Ward</label><input className="form-control" placeholder="Ward name" value={form.ward} onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">District</label><input className="form-control" placeholder="District" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} /></div>
                </div>
                <div className="form-group"><label className="form-label">Scheduled Date</label><input type="datetime-local" className="form-control" value={form.scheduledDate} onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Saving...' : (editId ? 'Update Visit' : 'Create Visit')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
