import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitComplaint } from '../services/api';
import { CATEGORY_OPTIONS } from '../utils/helpers';
import { getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';
import { MapPin, Upload, AlertTriangle, Lightbulb } from 'lucide-react';

const CRITICAL_PATTERNS = ['collapse', 'fire', 'gas leak', 'electrocution', 'flood', 'emergency', 'danger', 'death', 'injured', 'urgent'];
const CATEGORY_HINTS = [
  { cat: 'roads_potholes', words: ['pothole', 'road', 'broken', 'crater'] },
  { cat: 'water_supply', words: ['water', 'pipe', 'supply', 'tap'] },
  { cat: 'garbage_sanitation', words: ['garbage', 'trash', 'waste', 'litter'] },
  { cat: 'electricity', words: ['electricity', 'power', 'wire', 'transformer'] },
  { cat: 'street_lights', words: ['street light', 'dark', 'lamp'] },
  { cat: 'sewage', words: ['sewage', 'sewer', 'drain', 'manhole'] },
  { cat: 'traffic', words: ['traffic', 'signal', 'jam', 'parking'] },
  { cat: 'pollution', words: ['pollution', 'smoke', 'dust', 'smell'] },
];

export default function SubmitComplaint() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [isCriticalDetected, setIsCriticalDetected] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: '', address: '', ward: '', district: '', pincode: '', landmark: '', lat: '', lng: '' });

  useEffect(() => {
    const urls = images.map(img => URL.createObjectURL(img));
    setImagePreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [images]);

  useEffect(() => {
    const text = `${form.title} ${form.description}`.toLowerCase();
    if (text.trim().length < 5) { setIsCriticalDetected(false); setAiSuggestion(null); return; }

    setIsCriticalDetected(CRITICAL_PATTERNS.some((p) => text.includes(p)));

    if (!form.category) {
      const match = CATEGORY_HINTS.find((s) => s.words.some((w) => text.includes(w)));
      setAiSuggestion(match ? match.cat : null);
    } else {
      setAiSuggestion(null);
    }
  }, [form.title, form.description, form.category]);

  const handleGeolocate = () => {
    if (!navigator.geolocation) return toast.error('Geolocation not supported on this device');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setForm((f) => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })); toast.success('Location detected!'); },
      () => toast.error('Unable to get location — check browser permissions')
    );
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 5) return toast.error('Maximum 5 images allowed');
    const oversize = files.find((f) => f.size > 5 * 1024 * 1024);
    if (oversize) return toast.error(`${oversize.name} exceeds 5MB limit`);
    setImages(files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.category || !form.address.trim()) {
      return toast.error('Please fill all required fields');
    }
    if (form.description.trim().length < 10) return toast.error('Description must be at least 10 characters');

    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v && k !== 'lat' && k !== 'lng') formData.append(k, v); });
      if (form.lat && form.lng) formData.append('coordinates', JSON.stringify([parseFloat(form.lng), parseFloat(form.lat)]));
      images.forEach((img) => formData.append('images', img));

      const { data } = await submitComplaint(formData);
      toast.success(`Complaint submitted! Ticket: ${data.complaint.ticketId}`);
      navigate(`/complaints/${data.complaint._id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Submission failed'));
    } finally { setLoading(false); }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>Submit a Grievance</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Your complaint will be auto-classified and routed to the correct department</p>
      </div>

      {isCriticalDetected && (
        <div className="alert alert-critical" style={{ marginBottom: 20 }}>
          <AlertTriangle size={18} />
          <div>
            <strong>⚠️ Critical situation detected!</strong>
            <div style={{ fontSize: 12, marginTop: 2 }}>This complaint will be flagged as CRITICAL and escalated immediately to the State Admin and department head.</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><div className="card-title">📝 Complaint Details</div></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Title <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-control" placeholder="Brief title of the issue..." value={form.title} onChange={set('title')} maxLength={200} />
            </div>

            <div className="form-group">
              <label className="form-label">Category <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select className="form-control" value={form.category} onChange={set('category')}>
                <option value="">Select category...</option>
                {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {aiSuggestion && !form.category && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setForm((f) => ({ ...f, category: aiSuggestion }))}>
                  <Lightbulb size={12} /> AI suggests: <strong>{CATEGORY_OPTIONS.find((c) => c.value === aiSuggestion)?.label}</strong> — click to apply
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Description <span style={{ color: 'var(--danger)' }}>*</span></label>
              <textarea className="form-control" rows={4} placeholder="Describe the issue in detail — how long it's been there, who is affected, what impact it has..." value={form.description} onChange={set('description')} maxLength={2000} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{form.description.length}/2000 characters. Detailed descriptions get faster resolution.</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title">📍 Location</div>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleGeolocate}><MapPin size={12} /> Use My Location</button>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Full Address <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-control" placeholder="e.g. Near Ram Mandir, Sector 4, Ward 2" value={form.address} onChange={set('address')} />
            </div>
            <div className="grid grid-2">
              <div className="form-group"><label className="form-label">Ward</label><input className="form-control" placeholder="Ward name / number" value={form.ward} onChange={set('ward')} /></div>
              <div className="form-group"><label className="form-label">District</label><input className="form-control" placeholder="District name" value={form.district} onChange={set('district')} /></div>
              <div className="form-group"><label className="form-label">Pincode</label><input className="form-control" placeholder="110001" value={form.pincode} onChange={set('pincode')} maxLength={6} /></div>
              <div className="form-group"><label className="form-label">Landmark</label><input className="form-control" placeholder="Near school, market, etc." value={form.landmark} onChange={set('landmark')} /></div>
            </div>
            {form.lat && form.lng && <div className="alert alert-success" style={{ fontSize: 12 }}>📍 GPS coordinates captured: {form.lat}, {form.lng}</div>}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><div className="card-title">📷 Photo Evidence</div></div>
          <div className="card-body">
            <label style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: 10, padding: 24, textAlign: 'center', cursor: 'pointer' }}>
              <Upload size={28} color="var(--text-muted)" style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Upload Photos (Max 5, 5MB each)</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>JPG, PNG, or WEBP. Evidence photos help in faster verification.</div>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleImageChange} />
            </label>
            {images.length > 0 && (
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                {images.map((img, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={imagePreviews[i]} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--border)' }} />
                    <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--danger)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 11 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {form.category && form.title && (
          <div className="card" style={{ marginBottom: 24, border: '2px solid var(--primary)', background: '#f8faff' }}>
            <div className="card-body">
              <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--primary)' }}>📋 Submission Preview</div>
              <div style={{ fontSize: 13, display: 'grid', gap: 4 }}>
                <div>Department: <strong>{CATEGORY_OPTIONS.find((c) => c.value === form.category)?.dept}</strong></div>
                <div>Auto-priority: <strong style={{ color: isCriticalDetected ? 'var(--danger)' : 'var(--warning)' }}>{isCriticalDetected ? '🚨 CRITICAL' : '🟡 AI will refine on submit'}</strong></div>
                {form.lat && <div>📍 GPS coordinates will be attached</div>}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/complaints')}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ flex: 1 }}>{loading ? '⏳ Submitting...' : '🚀 Submit Grievance'}</button>
        </div>
      </form>
    </div>
  );
}
