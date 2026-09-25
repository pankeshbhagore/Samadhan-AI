import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getComplaints, getNearbyComplaints } from '../services/api';
import { formatStatus, formatCategory } from '../utils/helpers';
import useLeaflet from '../hooks/useLeaflet';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getStateByCode, getStateName } from '../utils/statesConfig';
import { Navigation, MapPin, Map as MapIcon, Moon, Satellite, Mountain } from 'lucide-react';

const PRIORITY_COLORS_MAP = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a' };

// 4 free, no-API-key tile providers. Each has a distinct visual identity.
const MAP_THEMES = {
  streets: {
    label: 'Streets', icon: MapIcon,
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  },
  dark: {
    label: 'Dark', icon: Moon,
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 20
  },
  satellite: {
    label: 'Satellite', icon: Satellite,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19
  },
  terrain: {
    label: 'Terrain', icon: Mountain,
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)',
    maxZoom: 17
  }
};

const MAP_THEME_STORAGE_KEY = 'cm_grievance_map_theme';

export default function MapView() {
  const { user } = useAuth();
  const { ready: leafletReady, error: leafletError } = useLeaflet();
  const { isDark } = useTheme();
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markersRef = useRef([]);
  const tileLayerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleNav = (e) => navigate(e.detail);
    window.addEventListener('navTo', handleNav);
    return () => window.removeEventListener('navTo', handleNav);
  }, [navigate]);

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterState, setFilterState] = useState(''); // New State Filter
  const [nearbyCount, setNearbyCount] = useState(0);
  const [showSentiment, setShowSentiment] = useState(false);

  // Default map theme follows the app's light/dark mode on first visit, but a saved choice always wins
  const [mapTheme, setMapTheme] = useState(() => {
    const saved = localStorage.getItem(MAP_THEME_STORAGE_KEY);
    if (saved && MAP_THEMES[saved]) return saved;
    return isDark ? 'dark' : 'streets';
  });

  useEffect(() => {
    localStorage.setItem(MAP_THEME_STORAGE_KEY, mapTheme);
  }, [mapTheme]);

  useEffect(() => {
    setLoading(true);
    const params = { limit: 200 };
    if (user?.role === 'super_admin' && filterState) {
      params.state = filterState;
    }
    getComplaints(params).then(({ data }) => {
      setComplaints(data.complaints.filter((c) => c.location?.coordinates?.length === 2));
    }).finally(() => setLoading(false));
  }, [filterState, user?.role]);

  const filtered = complaints.filter((c) => {
    if (filterPriority && c.priority !== filterPriority) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    return true;
  });

  // Initialize the map once
  useEffect(() => {
    if (!leafletReady || !mapRef.current || leafletMap.current) return;
    const L = window.L;
    let center = [20.5937, 78.9629]; // India center
    let zoom = 5;
    
    const relevantState = (user?.role === 'super_admin' && filterState) ? filterState : user?.state;
    if (relevantState) {
      const stateObj = getStateByCode(relevantState);
      if (stateObj) {
        center = stateObj.coords;
        zoom = 7;
      }
    }
    leafletMap.current = L.map(mapRef.current, { zoomControl: true }).setView(center, zoom);

    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div');
      div.innerHTML = `
        <div style="background:var(--card);padding:10px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.25);font-family:sans-serif;font-size:11px;color:var(--text);border:1px solid var(--border)">
          <div style="font-weight:700;margin-bottom:6px">Priority</div>
          ${Object.entries(PRIORITY_COLORS_MAP).map(([p, c]) => `
            <div style="display:flex;align-items:center;gap:6px;margin:3px 0">
              <div style="width:10px;height:10px;border-radius:50%;background:${c}"></div>
              <span style="text-transform:capitalize">${p}</span>
            </div>`).join('')}
        </div>`;
      return div;
    };
    legend.addTo(leafletMap.current);
  }, [leafletReady, loading]);

  // Swap tile layer whenever the chosen map theme changes
  useEffect(() => {
    if (!leafletMap.current) return;
    const L = window.L;
    const theme = MAP_THEMES[mapTheme];

    if (tileLayerRef.current) {
      leafletMap.current.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = L.tileLayer(theme.url, { attribution: theme.attribution, maxZoom: theme.maxZoom }).addTo(leafletMap.current);
  }, [mapTheme, leafletReady, loading]);

  // Redraw markers whenever filtered data changes
  useEffect(() => {
    if (!leafletMap.current) return;
    const L = window.L;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    filtered.forEach((c) => {
      const [lng, lat] = c.location.coordinates;
      let color = PRIORITY_COLORS_MAP[c.priority] || '#666';
      let isAngry = c.sentimentLabel === 'highly_frustrated' || c.sentimentLabel === 'frustrated';
      let html = '';
      
      if (showSentiment) {
        const score = c.sentimentScore !== undefined ? c.sentimentScore : 0.5;
        const hue = Math.max(0, Math.min(120, score * 120));
        color = `hsl(${hue}, 80%, 50%)`;
        const pulse = isAngry ? 'animation:pulse 1.5s infinite;' : '';
        html = `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 10px ${color};${pulse}"></div>`;
      } else {
        html = `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);${c.isCritical ? 'animation:pulse 1.5s infinite;' : ''}"></div>`;
      }

      const icon = L.divIcon({
        html,
        className: '', iconSize: showSentiment ? [20, 20] : [16, 16], iconAnchor: showSentiment ? [10, 10] : [8, 8]
      });

      const marker = L.marker([lat, lng], { icon }).addTo(leafletMap.current).bindPopup(`
        <div style="min-width:200px;font-family:sans-serif">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px">${c.isCritical ? '🚨 ' : ''}${c.title}</div>
          <div style="font-size:11px;color:#666;margin-bottom:4px">${c.address}</div>
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
            <span style="background:${color};color:white;padding:2px 6px;border-radius:10px;font-size:10px;text-transform:uppercase">${c.priority}</span>
            <span style="background:var(--card-hover);padding:2px 6px;border-radius:10px;font-size:10px">${formatStatus(c.status)}</span>
          </div>
          <div style="font-size:11px;color:#888">${formatCategory(c.category)}</div>
          <a href="/complaints/${c._id}" onclick="event.preventDefault(); window.dispatchEvent(new CustomEvent('navTo', {detail: '/complaints/${c._id}'}))" style="display:block;margin-top:8px;font-size:12px;color:var(--primary);font-weight:600">View Details →</a>
        </div>
      `);
      markersRef.current.push(marker);
    });
  }, [filtered, showSentiment]);

  useEffect(() => () => { leafletMap.current?.remove(); leafletMap.current = null; tileLayerRef.current = null; }, []);

  const locateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      leafletMap.current?.setView([lat, lng], 14);
      getNearbyComplaints({ lat, lng, radius: 1000 }).then(({ data }) => setNearbyCount(data.total));

      const L = window.L;
      if (L && leafletMap.current) {
        if (userMarkerRef.current) userMarkerRef.current.remove();
        const icon = L.divIcon({ html: `<div style="width:20px;height:20px;border-radius:50%;background:#1a3a6b;border:3px solid white;box-shadow:0 0 0 3px rgba(26,58,107,0.3)"></div>`, className: '', iconSize: [20, 20], iconAnchor: [10, 10] });
        userMarkerRef.current = L.marker([lat, lng], { icon }).addTo(leafletMap.current).bindPopup('📍 Your Location').openPopup();
      }
    }, () => {});
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>🗺️ Grievance Map</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{filtered.length} complaints mapped across {getStateName(user?.state)}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={locateMe} disabled={!leafletReady}><Navigation size={14} /> Locate Me</button>
      </div>

      {nearbyCount > 0 && <div className="alert alert-warning" style={{ marginBottom: 12 }}><MapPin size={14} /> Found <strong>{nearbyCount} complaints</strong> within 1km of your location</div>}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ padding: '12px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: '1 1 280px' }}>
            {user?.role === 'super_admin' && (
              <select className="form-control" style={{ flex: '1 1 140px' }} value={filterState} onChange={(e) => {
                setFilterState(e.target.value);
                if (leafletMap.current) {
                  const stateObj = getStateByCode(e.target.value);
                  if (stateObj) leafletMap.current.setView(stateObj.coords, 7);
                  else leafletMap.current.setView([20.5937, 78.9629], 5);
                }
              }}>
                <option value="">All India (Global View)</option>
                {require('../utils/statesConfig').default.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            )}
            <select className="form-control" style={{ flex: '1 1 140px' }} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
              <option value="">All Priorities</option>
              <option value="critical">🚨 Critical</option>
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
            <select className="form-control" style={{ flex: '1 1 140px' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '0 12px', background: showSentiment ? '#fef2f2' : 'var(--background)', color: showSentiment ? '#dc2626' : 'var(--text)', borderRadius: 8, border: `1px solid ${showSentiment ? '#fca5a5' : 'var(--border)'}` }}>
              <input type="checkbox" checked={showSentiment} onChange={(e) => setShowSentiment(e.target.checked)} style={{ cursor: 'pointer' }} />
              😡 Anger Heatmap
            </label>
          </div>

          <div className="map-theme-switcher">
            {Object.entries(MAP_THEMES).map(([key, t]) => {
              const Icon = t.icon;
              return (
                <button key={key} className={`map-theme-btn${mapTheme === key ? ' active' : ''}`} onClick={() => setMapTheme(key)} title={t.label}>
                  <Icon size={13} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {leafletError ? (
        <div className="alert alert-critical">⚠️ Failed to load map library. Check your internet connection and reload.</div>
      ) : !leafletReady || loading ? (
        <div style={{ height: 520, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div ref={mapRef} style={{ height: 520, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }} />
      )}
    </div>
  );
}
