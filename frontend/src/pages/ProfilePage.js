import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile, changePassword } from '../services/api';
import { getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, updateLocalUser } = useAuth();
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '', phone: user?.phone || '', ward: user?.ward || '', district: user?.district || ''
  });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await updateProfile(profileForm);
      updateLocalUser(data.user);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Update failed'));
    } finally { setSavingProfile(false); }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) return toast.error('New passwords do not match');
    if (pwForm.newPassword.length < 6) return toast.error('New password must be at least 6 characters');

    setSavingPw(true);
    try {
      await changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password changed successfully');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Password change failed'));
    } finally { setSavingPw(false); }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>👤 My Profile</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Manage your account details and security</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 26 }}>
            {user?.name?.charAt(0)}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{user?.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user?.email}</div>
            <span className="badge" style={{ background: '#eff6ff', color: 'var(--primary)', marginTop: 4, textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><div className="card-title">Edit Profile</div></div>
        <form onSubmit={handleProfileSubmit}>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-control" value={profileForm.name} onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-control" value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} maxLength={10} />
            </div>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Ward</label>
                <input className="form-control" value={profileForm.ward} onChange={(e) => setProfileForm((f) => ({ ...f, ward: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">District</label>
                <input className="form-control" value={profileForm.district} onChange={(e) => setProfileForm((f) => ({ ...f, district: e.target.value }))} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">🔒 Change Password</div></div>
        <form onSubmit={handlePasswordSubmit}>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input type="password" className="form-control" value={pwForm.currentPassword} onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input type="password" className="form-control" value={pwForm.newPassword} onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))} minLength={6} required />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input type="password" className="form-control" value={pwForm.confirmPassword} onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))} minLength={6} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingPw}>{savingPw ? 'Updating...' : 'Change Password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
