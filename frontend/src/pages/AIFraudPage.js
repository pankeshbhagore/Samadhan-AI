import React, { useState, useEffect } from 'react';
import { getComplaints } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Fingerprint, MapPin, Database, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import statesConfig, { getStateName } from '../utils/statesConfig';

export default function AIFraudPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = { limit: 500 };
        if (user?.role === 'super_admin' && filterState) {
          params.state = filterState;
        }
        const res = await getComplaints(params);
        setData(res.data.complaints || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filterState, user?.role]);

  if (loading) return <div className="page-content" style={{ padding: 32, textAlign: 'center' }}>Loading Fraud Detection Data...</div>;

  const duplicates = data.filter(c => c.duplicateCount > 0);
  const totalDuplicates = duplicates.reduce((acc, c) => acc + c.duplicateCount, 0);
  
  const highConfidenceAI = data.filter(c => c.aiConfidence > 0.90).length;
  const potentialSpam = data.filter(c => c.duplicateCount > 5).length;

  return (
    <div className="page-content" style={{ padding: '32px 40px' }}>
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShieldAlert size={32} color="var(--danger)" /> AI Fraud & Anomaly Detection
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Systematic detection of spam, duplicates, and coordinated complaint attacks.
            {user?.role !== 'super_admin' && ` Showing data for ${getStateName(user?.state)}.`}
          </p>
        </div>
        
        {user?.role === 'super_admin' && (
          <select className="form-control" style={{ width: 200 }} value={filterState} onChange={(e) => setFilterState(e.target.value)}>
            <option value="">All India (Global View)</option>
            {statesConfig.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ borderColor: 'var(--danger)', background: 'rgba(239,68,68,0.05)', cursor: 'pointer' }} onClick={() => navigate('/complaints?hasDuplicates=true')}>
          <div className="stat-icon" style={{ background: 'var(--danger)', color: 'white' }}><Database size={24} /></div>
          <div><div className="stat-value" style={{ color: 'var(--danger)' }}>{totalDuplicates}</div><div className="stat-label">Total Duplicate Attempts</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/complaints?hasDuplicates=true')}>
          <div className="stat-icon" style={{ background: 'var(--warning)', color: 'white' }}><Fingerprint size={24} /></div>
          <div><div className="stat-value">{potentialSpam}</div><div className="stat-label">Coordinated Spam Attacks</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/complaints')}>
          <div className="stat-icon" style={{ background: 'var(--primary)', color: 'white' }}><Activity size={24} /></div>
          <div><div className="stat-value">{highConfidenceAI}</div><div className="stat-label">High Confidence AI Predictions</div></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><div className="card-title">Recent Flagged Anomalies</div></div>
        <div className="card-body">
          {duplicates.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No anomalies detected in this region.</p>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {duplicates.slice(0, 10).map((d) => (
                <div key={d._id} style={{ display: 'flex', gap: 16, padding: 16, background: 'var(--card-hover)', borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate(`/complaints/${d._id}`)}>
                  <div style={{ background: 'var(--danger)', color: 'white', width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>{d.title}</h3>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                      Attempted <strong>{d.duplicateCount} times</strong> near {d.ward}. Flagged and merged into Ticket {d.ticketId}.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
