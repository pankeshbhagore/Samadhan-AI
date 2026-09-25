import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';
import statesConfig from '../utils/statesConfig';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [demoRole, setDemoRole] = useState(''); // new hierarchical state
  const [demoState, setDemoState] = useState('mh'); // default to MH
  const [demoDept, setDemoDept] = useState('roads'); // default to Roads
  const [demoOfficerId, setDemoOfficerId] = useState('1'); // default to Officer 1

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { user } = await login(form);
      toast.success(`Welcome, ${user.name}!`);
      if (user.role === 'super_admin') navigate('/super-admin-dashboard');
      else if (user.role === 'cm') navigate('/cm-dashboard');
      else if (user.role === 'department_head') navigate('/department-dashboard');
      else if (user.role === 'employee') navigate('/my-complaints');
      else navigate('/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Login failed'));
    } finally { setLoading(false); }
  };

  const quickLogin = (email) => setForm({ email, password: 'password123' });

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f2247 0%, #1a3a6b 50%, #2653a3 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg, #ff6b35, #ffaa00)', borderRadius: 16, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🏛️</div>
          <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Samadhan</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Citizen Grievance Dashboard</p>
        </div>

        <div className="card" style={{ padding: 32, borderRadius: 16 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-control" type="email" placeholder="your@email.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-control" type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? '⏳ Signing in...' : '🔐 Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 24, padding: '16px', background: 'var(--card-hover)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Demo Quick Login (Password: password123)</div>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>1. Select Role:</label>
              <select className="form-control" value={demoRole} onChange={(e) => setDemoRole(e.target.value)} style={{ padding: '6px 10px', fontSize: 13, width: '100%' }}>
                <option value="">-- Choose a Role --</option>
                <option value="superadmin">🌍 All-India Super Admin</option>
                <option value="stateadmin">👑 State Admin</option>
                <option value="depthead">🏢 Department Head</option>
                <option value="officer">👮 Field Officer</option>
                <option value="citizen">👤 Citizen</option>
              </select>
            </div>

            {demoRole === 'superadmin' && (
              <button type="button" onClick={() => quickLogin('admin@samadhan.gov.in')}
                style={{ width: '100%', padding: '8px', fontSize: 13, background: 'var(--primary-dark)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                Login as Super Admin
              </button>
            )}

            {['stateadmin', 'citizen', 'depthead', 'officer'].includes(demoRole) && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>2. Select State:</label>
                <select className="form-control" value={demoState} onChange={(e) => setDemoState(e.target.value)} style={{ padding: '6px 10px', fontSize: 13, width: '100%' }}>
                  {statesConfig.map(s => <option key={s.code} value={s.code.toLowerCase()}>{s.name}</option>)}
                </select>
              </div>
            )}

            {['depthead', 'officer'].includes(demoRole) && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>3. Select Department:</label>
                <select className="form-control" value={demoDept} onChange={(e) => setDemoDept(e.target.value)} style={{ padding: '6px 10px', fontSize: 13, width: '100%' }}>
                  <option value="roads">Roads & Infra</option>
                  <option value="water">Water Board</option>
                  <option value="sanit">Sanitation</option>
                  <option value="elec">Electricity</option>
                  <option value="traffic">Traffic</option>
                  <option value="env">Environment</option>
                  <option value="parks">Parks</option>
                  <option value="build">Building</option>
                  <option value="health">Health</option>
                  <option value="transport">Transport</option>
                </select>
              </div>
            )}

            {demoRole === 'officer' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>4. Select Officer ID:</label>
                <select className="form-control" value={demoOfficerId} onChange={(e) => setDemoOfficerId(e.target.value)} style={{ padding: '6px 10px', fontSize: 13, width: '100%' }}>
                  <option value="1">ID: #1</option>
                  <option value="2">ID: #2</option>
                  <option value="3">ID: #3</option>
                  <option value="4">ID: #4</option>
                  <option value="5">ID: #5</option>
                </select>
              </div>
            )}

            {demoRole === 'stateadmin' && (
              <button type="button" onClick={() => quickLogin(`cm@${demoState}.samadhan.gov.in`)} className="btn btn-outline" style={{ width: '100%', fontSize: 13 }}>👑 Login as State Admin</button>
            )}
            
            {demoRole === 'citizen' && (
              <button type="button" onClick={() => quickLogin(`citizen1@${demoState}.example.com`)} className="btn btn-outline" style={{ width: '100%', fontSize: 13 }}>👤 Login as Citizen</button>
            )}

            {demoRole === 'depthead' && (
              <button type="button" onClick={() => quickLogin(`dh.${demoDept}@${demoState}.samadhan.gov.in`)} className="btn btn-outline" style={{ width: '100%', fontSize: 13 }}>🏢 Login as Dept Head</button>
            )}

            {demoRole === 'officer' && (
              <button type="button" onClick={() => quickLogin(`officer${demoOfficerId}.${demoDept}@${demoState}.samadhan.gov.in`)} className="btn btn-outline" style={{ width: '100%', fontSize: 13 }}>👮 Login as Officer</button>
            )}

          </div>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
            New citizen? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Register here</Link>
          </div>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12 }}>
            <Link to="/track" style={{ color: 'var(--text-muted)' }}>Just want to check a ticket status? Track without logging in →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
