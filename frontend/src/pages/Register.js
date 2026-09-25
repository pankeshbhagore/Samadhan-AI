import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';
import statesConfig from '../utils/statesConfig';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', ward: '', district: '', state: '' });
  const [loading, setLoading] = useState(false);

  const selectedStateObj = statesConfig.find(s => s.code === form.state);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (form.phone && !/^[0-9]{10}$/.test(form.phone)) return toast.error('Phone must be exactly 10 digits');

    setLoading(true);
    try {
      await register(form);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Registration failed'));
    } finally { setLoading(false); }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f2247 0%, #1a3a6b 50%, #2653a3 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #ff6b35, #ffaa00)', borderRadius: 14, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🏛️</div>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 800 }}>Citizen Registration</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Register to submit and track grievances</p>
        </div>

        <div className="card" style={{ padding: 28, borderRadius: 16 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-control" placeholder="Your full name" value={form.name} onChange={set('name')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-control" type="email" placeholder="you@email.com" value={form.email} onChange={set('email')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input className="form-control" type="password" placeholder="Min. 6 characters" value={form.password} onChange={set('password')} required minLength={6} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-control" type="tel" placeholder="10-digit mobile number" value={form.phone} onChange={set('phone')} maxLength={10} />
            </div>
            <div className="form-group">
              <label className="form-label">State *</label>
              <select className="form-control" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value, district: '' }))} required>
                <option value="">Select your state</option>
                {statesConfig.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">District</label>
                <select className="form-control" value={form.district} onChange={set('district')} disabled={!form.state}>
                  <option value="">Select district</option>
                  {selectedStateObj?.districts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Ward / Area</label>
                <input className="form-control" placeholder="Ward name" value={form.ward} onChange={set('ward')} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? '⏳ Creating Account...' : '✅ Create Account'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
            Already registered? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Login here</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
