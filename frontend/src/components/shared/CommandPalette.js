import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  LayoutDashboard, FileText, MapPin, Users, Building2, ClipboardList,
  ShieldAlert, Car, User as UserIcon, Plus, Sun, Moon, Search
} from 'lucide-react';

function buildCommands({ navigate, user, isAdmin, isCM, isEmployee, isCitizen, toggleTheme, isDark }) {
  const commands = [];
  const add = (label, icon, action, keywords = '') => commands.push({ label, icon, action, keywords: keywords.toLowerCase() });

  if (isCM()) add('Go to State Admin Dashboard', LayoutDashboard, () => navigate('/cm-dashboard'), 'home overview stats');
  if (user?.role === 'super_admin') add('Go to All India Dashboard', LayoutDashboard, () => navigate('/super-admin-dashboard'), 'home overview stats');
  if (isCitizen()) add('Go to My Dashboard', LayoutDashboard, () => navigate('/dashboard'), 'home overview');
  if (isEmployee()) add('Go to My Tasks', ClipboardList, () => navigate('/my-complaints'), 'tasks assigned');

  add('View All Complaints', FileText, () => navigate('/complaints'), 'grievances list');
  if (isCitizen()) add('Submit New Complaint', Plus, () => navigate('/complaints/new'), 'new create file report');
  add('Open Grievance Map', MapPin, () => navigate('/map'), 'geo location heatmap');

  if (isAdmin() || user?.role === 'department_head') add('Officer Performance', Users, () => navigate('/officers'), 'staff bandwidth workload');
  if (user?.role === 'super_admin') {
    add('User Management', UserIcon, () => navigate('/users'), 'admin accounts staff');
    add('Departments', Building2, () => navigate('/departments'), 'depts categories');
  }
  if (isAdmin()) {
    add('Visit Logs', Car, () => navigate('/visits'), 'field cm tour');
    add('Audit & Integrity', ShieldAlert, () => navigate('/audit'), 'logs suspicious corruption');
  }

  add('My Profile', UserIcon, () => navigate('/profile'), 'account settings password');
  add(isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode', isDark ? Sun : Moon, toggleTheme, 'theme appearance dark light');

  return commands;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { user, isAdmin, isCM, isEmployee, isCitizen } = useAuth();
  const { toggleTheme, isDark } = useTheme();

  const commands = useMemo(
    () => buildCommands({ navigate, user, isAdmin, isCM, isEmployee, isCitizen, toggleTheme, isDark }),
    [user, isDark]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.keywords.includes(q));
  }, [commands, query]);

  useEffect(() => {
    const handler = (e) => {
      const isK = e.key === 'k' || e.key === 'K';
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    const customOpenHandler = () => setOpen(true);
    document.addEventListener('keydown', handler);
    window.addEventListener('open-command-palette', customOpenHandler);
    return () => {
      document.removeEventListener('keydown', handler);
      window.removeEventListener('open-command-palette', customOpenHandler);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  const runCommand = (cmd) => {
    cmd.action();
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && filtered[activeIndex]) { runCommand(filtered[activeIndex]); }
  };

  if (!open) return null;

  return (
    <div className="cmdk-overlay" onClick={() => setOpen(false)}>
      <div className="cmdk-box" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input-wrap">
          <Search size={16} color="var(--text-muted)" />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Search pages, actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="kbd-chip" style={{ cursor: 'default' }}>Esc</span>
        </div>
        <div className="cmdk-list">
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No matching commands</div>
          ) : filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <div key={cmd.label} className={`cmdk-item${i === activeIndex ? ' active' : ''}`} onMouseEnter={() => setActiveIndex(i)} onClick={() => runCommand(cmd)}>
                <Icon size={16} color="var(--text-muted)" />
                <span style={{ fontSize: 13 }}>{cmd.label}</span>
              </div>
            );
          })}
        </div>
        <div className="cmdk-hint">
          <span><span className="cmdk-kbd">↑↓</span> navigate</span>
          <span><span className="cmdk-kbd">↵</span> select</span>
          <span><span className="cmdk-kbd">esc</span> close</span>
        </div>
      </div>
    </div>
  );
}
