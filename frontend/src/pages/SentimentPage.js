import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getComplaints } from '../services/api';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { BrainCircuit, AlertOctagon, TrendingDown, Users, Activity, MessageSquareWarning } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import statesConfig, { getStateName } from '../utils/statesConfig';
import { format } from 'date-fns';
import { formatCategory } from '../utils/helpers';

const COLORS = ['#ef4444', '#f59e0b', '#10b981']; // Angry, Neutral, Positive

export default function SentimentPage() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState('');
  const navigate = useNavigate();

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

  if (loading) return <div className="page-content" style={{ padding: 32, textAlign: 'center' }}>Loading AI Sentiment Analysis...</div>;

  const sentimentCounts = { Angry: 0, Neutral: 0, Positive: 0 };
  const wardFrustration = {};
  const highlyFrustrated = [];
  const categoryMap = {};

  data.forEach(c => {
    let sentiment = 'Neutral';
    
    // If a complaint is resolved, it shouldn't be counted as Angry in real-time hotspots.
    // We can count it in historical charts, but let's just make it Positive or Neutral if resolved to be safe, 
    // or keep it Angry for charts but exclude from highlyFrustrated.
    
    if (c.status === 'resolved') {
      sentiment = 'Positive'; // If resolved, it's a satisfied outcome regardless of initial anger.
    } else if (c.sentimentLabel === 'highly_frustrated' || c.sentimentLabel === 'frustrated') {
      sentiment = 'Angry';
    } else {
      sentiment = 'Neutral';
    }

    // Counts
    sentimentCounts[sentiment]++;

    // Wards
    if (sentiment === 'Angry') {
      if (c.ward) wardFrustration[c.ward] = (wardFrustration[c.ward] || 0) + 1;
      highlyFrustrated.push(c);
    }

    // Category
    const cat = formatCategory(c.category);
    if (!categoryMap[cat]) categoryMap[cat] = { category: cat, Angry: 0, Neutral: 0, Positive: 0 };
    categoryMap[cat][sentiment]++;
  });

  const pieData = [
    { name: 'Angry', value: sentimentCounts.Angry },
    { name: 'Neutral', value: sentimentCounts.Neutral },
    { name: 'Positive', value: sentimentCounts.Positive }
  ];

  const barData = Object.keys(wardFrustration)
    .map(ward => ({ ward: ward.toLowerCase().includes('ward') ? ward : `Ward ${ward}`, count: wardFrustration[ward], rawWard: ward }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const categoryData = Object.values(categoryMap).sort((a, b) => b.Angry - a.Angry).slice(0, 6);

  // Happiness Score
  const totalComplaints = data.length || 1;
  const happinessScore = Math.round(((sentimentCounts.Positive + sentimentCounts.Neutral * 0.5) / totalComplaints) * 100);
  const scoreColor = happinessScore >= 70 ? 'var(--success)' : happinessScore >= 40 ? 'var(--warning)' : 'var(--danger)';

  // Keywords
  const stopWords = new Set(['the', 'and', 'is', 'in', 'to', 'of', 'for', 'a', 'on', 'with', 'at', 'by', 'an', 'this', 'not', 'no', 'are', 'from', 'it', 'that', 'issue', 'problem', 'very', 'my', 'i', 'we', 'causing', 'near', 'daily', 'whose', 'please', 'critical', 'which', 'what', 'when', 'where', 'who', 'how', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'under', 'over', 'again', 'further', 'then', 'once', 'here', 'there', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so', 'than', 'too', 'can', 'will', 'just', 'should', 'now', 'am', 'was', 'were', 'be', 'been', 'being', 'they', 'their', 'theirs', 'them', 'themselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'you', 'your', 'yours', 'yourself', 'yourselves', 'our', 'ours', 'ourselves', 'us', 'out', 'up', 'down', 'why', 'these', 'those']);
  const words = highlyFrustrated.map(c => c.title).join(' ').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  const keywordCounts = {};
  words.forEach(w => {
    if (w.length > 3 && !stopWords.has(w)) keywordCounts[w] = (keywordCounts[w] || 0) + 1;
  });
  const topKeywords = Object.keys(keywordCounts).sort((a,b) => keywordCounts[b] - keywordCounts[a]).slice(0, 12);

  // Role Header
  const getRoleHeader = () => {
    if (user?.role === 'super_admin') return 'All India (Global View)';
    if (user?.role === 'cm') return `State View: ${getStateName(user?.state)}`;
    if (user?.role === 'department_head') return `Department View: ${user?.department?.name || 'Department'} (${getStateName(user?.state)})`;
    return 'Sentiment View';
  };

  return (
    <div className="page-content" style={{ padding: '32px 40px' }}>
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
            <BrainCircuit size={32} color="var(--primary)" /> Public Sentiment Analytics
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 15 }}>
            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{getRoleHeader()}</span> • AI-driven analysis of citizen frustration levels and geographic hotspots.
          </p>
        </div>
        
        {user?.role === 'super_admin' && (
          <select className="form-control" style={{ width: 220, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 600 }} value={filterState} onChange={(e) => setFilterState(e.target.value)}>
            <option value="">All India (Global View)</option>
            {statesConfig.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ borderColor: scoreColor, background: `rgba(${scoreColor === 'var(--success)' ? '16,185,129' : scoreColor === 'var(--warning)' ? '245,158,11' : '239,68,68'}, 0.05)` }}>
          <div className="stat-icon" style={{ background: scoreColor, color: 'white' }}><Activity size={24} /></div>
          <div><div className="stat-value" style={{ color: scoreColor }}>{happinessScore}/100</div><div className="stat-label">Public Happiness Index</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/complaints?sentiment=Angry')}>
          <div className="stat-icon" style={{ background: 'var(--danger)', color: 'white' }}><AlertOctagon size={24} /></div>
          <div><div className="stat-value" style={{ color: 'var(--danger)' }}>{sentimentCounts.Angry}</div><div className="stat-label">Frustrated Citizens</div></div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/complaints?sentiment=Positive')}>
          <div className="stat-icon" style={{ background: 'var(--success)', color: 'white' }}><Users size={24} /></div>
          <div><div className="stat-value">{sentimentCounts.Positive}</div><div className="stat-label">Satisfied Outcomes</div></div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">Overall Sentiment Breakdown</div></div>
          <div className="card-body" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={pieData} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={70} 
                  outerRadius={110} 
                  paddingAngle={5} 
                  dataKey="value"
                  className="clickable-chart-area"
                  style={{ cursor: 'pointer' }}
                  onClick={(entry) => navigate(`/complaints?sentiment=${entry.name}`)}
                >
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">📊 Frustration by Category</div></div>
          <div className="card-body" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Angry" stackId="a" fill="#ef4444" />
                <Bar dataKey="Neutral" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Positive" stackId="a" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card" style={{ gridColumn: 'span 1' }}>
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MessageSquareWarning size={18} /> Angry Keywords</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 24, alignContent: 'flex-start' }}>
            {topKeywords.length > 0 ? topKeywords.map((word, i) => (
              <span key={i} style={{ 
                background: `rgba(239, 68, 68, ${0.1 + (1 - i/topKeywords.length)*0.2})`, 
                color: '#b91c1c', 
                padding: '6px 12px', 
                borderRadius: 20, 
                fontSize: 14 - (i > 5 ? 2 : 0), 
                fontWeight: 600,
                border: '1px solid rgba(239,68,68,0.2)'
              }}>
                #{word}
              </span>
            )) : <div style={{ color: 'var(--text-muted)' }}>No strong keywords identified.</div>}
          </div>
        </div>
        
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <div className="card-title">🔥 Real-time Urgent Hotspots Feed</div>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/complaints?sentiment=Angry')}>View All Highly Frustrated</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {highlyFrustrated.length > 0 ? (
              <div style={{ maxHeight: 280, overflowY: 'auto' }} className="custom-scroll">
                {highlyFrustrated.slice(0, 15).map((c) => (
                  <div key={c._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }} className="hover-bg" onClick={() => navigate(`/complaints/${c._id}`)}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--danger)', fontSize: 14, marginBottom: 4 }}>{c.title}</div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                        <span>📍 {c.ward?.toLowerCase().includes('ward') ? c.ward : `Ward ${c.ward}`}</span>
                        <span>📁 {c.department?.name || 'Unassigned'}</span>
                        <span>🕒 {format(new Date(c.createdAt), 'dd MMM, hh:mm a')}</span>
                      </div>
                    </div>
                    <div style={{ marginLeft: 16 }}>
                      <span style={{ padding: '6px 10px', background: '#fef2f2', color: '#dc2626', borderRadius: 6, fontWeight: 700, fontSize: 11, border: '1px solid #fca5a5' }}>ANGRY</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No urgent hotspots right now!</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
