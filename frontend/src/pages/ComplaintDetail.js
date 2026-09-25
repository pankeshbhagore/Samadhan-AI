import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getComplaint, assignComplaint, updateComplaintStatus, citizenVerify, getOfficers, remindDeptHead, updateSubTaskStatus } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage, formatStatus, formatCategory } from '../utils/helpers';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { MapPin, User, AlertTriangle, CheckCircle, Share2 } from 'lucide-react';
import CommentsThread from '../components/shared/CommentsThread';

export default function ComplaintDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isEmployee, isCitizen } = useAuth();
  const [complaint, setComplaint] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [showAssign, setShowAssign] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showVerify, setShowVerify] = useState(false);

  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [verifyConfirm, setVerifyConfirm] = useState(null);
  const [verifyReason, setVerifyReason] = useState('');
  const [rating, setRating] = useState(0);
  const [proofImages, setProofImages] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getComplaint(id).then(({ data }) => {
      if (cancelled) return;
      setComplaint(data.complaint);
      if (isAdmin() || user?.role === 'department_head') {
        getOfficers({ department: data.complaint.department?._id }).then((r) => !cancelled && setOfficers(r.data.officers));
      }
    }).catch((err) => {
      toast.error(getErrorMessage(err, 'Could not load complaint'));
      navigate('/complaints');
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id]);

  const refreshComplaint = async () => {
    const { data } = await getComplaint(id);
    setComplaint(data.complaint);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/track/${complaint.ticketId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Tracking link copied to clipboard!');
    } catch {
      toast(url, { duration: 8000 });
    }
  };

  const resetVerifyModal = () => { setShowVerify(false); setVerifyConfirm(null); setVerifyReason(''); setRating(0); };

  const handleAssign = async () => {
    if (!selectedOfficer) return toast.error('Select an officer');
    setActionLoading(true);
    try {
      await assignComplaint(id, { officerId: selectedOfficer, note: assignNote });
      toast.success('Complaint assigned successfully');
      setShowAssign(false);
      setAssignNote('');
      setSelectedOfficer('');
      refreshComplaint();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Assignment failed'));
    } finally { setActionLoading(false); }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return toast.error('Select a status');
    setActionLoading(true);

    let latitude = null;
    let longitude = null;

    // Geo-fence SLA tracking
    if (newStatus === 'pending_verification') {
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (err) {
          toast.warning('Could not capture location. Geo-fence SLA tracking will flag this.');
        }
      }
    }

    try {
      let payload;
      if (proofImages && proofImages.length > 0) {
        payload = new FormData();
        payload.append('status', newStatus);
        payload.append('note', statusNote);
        if (latitude) payload.append('latitude', latitude);
        if (longitude) payload.append('longitude', longitude);
        Array.from(proofImages).forEach(f => payload.append('images', f));
      } else {
        payload = { status: newStatus, note: statusNote, latitude, longitude };
      }
      
      await updateComplaintStatus(id, payload);
      toast.success('Status updated');
      setShowStatus(false);
      setNewStatus('');
      setStatusNote('');
      setProofImages(null);
      refreshComplaint();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Update failed'));
    } finally { setActionLoading(false); }
  };

  const fastUpdateStatus = async (status) => {
    setActionLoading(true);
    let latitude = null;
    let longitude = null;

    if (status === 'pending_verification') {
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (err) {
          toast.warning('Could not capture location. Geo-fence SLA tracking will flag this.');
        }
      }
    }

    try {
      await updateComplaintStatus(id, { status, latitude, longitude });
      toast.success('Status advanced successfully');
      refreshComplaint();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update status'));
    } finally { setActionLoading(false); }
  };

  const handleVerify = async (confirmed) => {
    if (confirmed && rating === 0) return toast.error('Please rate the resolution (1-5 stars)');
    if (!confirmed && !verifyReason.trim()) return toast.error("Please explain why you're rejecting");
    setActionLoading(true);
    try {
      const payload = { confirmed, feedback: verifyReason, rejectionReason: verifyReason };
      if (confirmed) {
        payload.rating = rating;
      }
      const { data } = await citizenVerify(id, payload);
      toast.success(data.message);
      resetVerifyModal();
      refreshComplaint();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Verification failed'));
    } finally { setActionLoading(false); }
  };

  const handleSubTaskUpdate = async (taskId, newStatus) => {
    setActionLoading(true);
    try {
      await updateSubTaskStatus(id, { taskId, status: newStatus });
      toast.success('Task status updated');
      refreshComplaint();
    } catch(err) {
      toast.error(getErrorMessage(err, 'Task update failed'));
    } finally { setActionLoading(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>;
  if (!complaint) return null;

  const isOwner = (complaint.citizen?._id || complaint.citizen) === user?._id;
  const isAssigned = (complaint.assignedTo?._id || complaint.assignedTo) === user?._id;
  const canVerify = isCitizen() && isOwner && complaint.status === 'pending_verification';
  const canAssign = user?.role === 'department_head';
  const canNotifyDeptHead = isAdmin() && !complaint.assignedTo && complaint.status !== 'resolved';
  const canUpdateStatus = isAssigned && isEmployee();

  const getValidNextStatuses = (current) => {
    const flow = {
      assigned: ['under_review', 'in_progress', 'rejected'],
      under_review: ['in_progress', 'escalated', 'rejected'],
      in_progress: ['pending_verification', 'escalated'],
      reopened: ['under_review', 'in_progress', 'escalated', 'rejected'],
      escalated: ['under_review', 'in_progress']
    };
    return flow[current] || [];
  };
  const availableStatuses = getValidNextStatuses(complaint.status);
  
  // Disable standard update status if CM somehow bypassed auth check
  const canActuallyUpdateStatus = canUpdateStatus && user?.role !== 'cm';

  const renderStepper = () => {
    const steps = [
      { id: 'submitted', label: 'Submitted' },
      { id: 'assigned', label: 'Assigned' },
      { id: 'under_review', label: 'Under Review' },
      { id: 'in_progress', label: 'In Progress' },
      { id: 'pending_verification', label: 'Verification' },
      { id: 'resolved', label: 'Resolved' }
    ];

    const getResolvedIdx = (status) => {
      if (status === 'resolved') return 5;
      if (status === 'pending_verification') return 4;
      if (status === 'in_progress') return 3;
      if (status === 'under_review' || status === 'reopened' || status === 'escalated') return 2;
      if (status === 'assigned') return 1;
      return 0; // submitted
    };
    const resolvedIdx = getResolvedIdx(complaint.status);

    return (
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <div className="card-body" style={{ background: 'var(--bg)', padding: '24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 14, left: 20, right: 20, height: 2, background: '#e2e8f0', zIndex: 1 }} />
            <div style={{ position: 'absolute', top: 14, left: 20, width: resolvedIdx >= 0 ? `${(Math.max(0, resolvedIdx) / 5) * 100}%` : '0%', height: 2, background: '#10b981', zIndex: 1, transition: 'width 0.4s ease' }} />
            
            {steps.map((step, idx) => {
              const isPast = idx < resolvedIdx || complaint.status === 'resolved';
              const isCurrent = idx === resolvedIdx;
              
              return (
                <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 2, position: 'relative', width: 80 }}>
                  <div style={{ 
                    width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isPast ? '#10b981' : isCurrent ? '#3b82f6' : '#fff',
                    border: `2px solid ${isPast ? '#10b981' : isCurrent ? '#3b82f6' : '#cbd5e1'}`,
                    color: (isPast || isCurrent) ? '#fff' : '#94a3b8',
                    fontWeight: 600, fontSize: 13, transition: 'all 0.3s ease'
                  }}>
                    {isPast ? '✓' : idx + 1}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#0f172a' : '#64748b', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>

            {canActuallyUpdateStatus && availableStatuses.length > 0 && complaint.status !== 'pending_verification' && (
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', gap: 12 }}>
                {(complaint.status === 'assigned' || complaint.status === 'reopened' || complaint.status === 'escalated') && <button className="btn btn-primary" onClick={() => fastUpdateStatus('under_review')} disabled={actionLoading}>Start Review &rarr;</button>}
                {(complaint.status === 'under_review' || complaint.status === 'reopened' || complaint.status === 'escalated') && <button className="btn btn-primary" onClick={() => fastUpdateStatus('in_progress')} disabled={actionLoading}>Begin Work &rarr;</button>}
                {complaint.status === 'in_progress' && <button className="btn btn-success" onClick={() => { setNewStatus('pending_verification'); setShowStatus(true); }} disabled={actionLoading}>Request Citizen Verification ✅</button>}
              </div>
            )}
        </div>
      </div>
    );
  };

  const PRIORITY_STYLES = { critical: { bg: '#fef2f2', color: '#991b1b' }, high: { bg: '#fff7ed', color: '#c2410c' }, medium: { bg: '#fffbeb', color: '#92400e' }, low: { bg: '#f0fdf4', color: '#166534' } };
  const ps = PRIORITY_STYLES[complaint.priority] || { bg: 'var(--bg)', color: 'var(--text)' };

  return (
    <div style={{ maxWidth: 900 }}>
      <button onClick={() => navigate(-1)} className="btn btn-outline btn-sm" style={{ marginBottom: 16 }}>← Back</button>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13, background: complaint.adminReminder ? '#ffe4e6' : '#f1f5f9', color: complaint.adminReminder ? '#be123c' : 'inherit', padding: '3px 8px', borderRadius: 4 }}>{complaint.ticketId}</span>
                <span className={`badge badge-${complaint.status}`}>{formatStatus(complaint.status)}</span>
                <span className="badge" style={{ background: ps.bg, color: ps.color }}>{complaint.isCritical && '🚨 '}{complaint.priority?.toUpperCase()}</span>
                {complaint.isDuplicate && <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Duplicate</span>}
              </div>
              
              {complaint.adminReminder && (
                <div className="alert" style={{ background: '#fff1f2', border: '1px solid #fecaca', color: '#be123c', padding: '8px 12px', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                  <AlertTriangle size={16} /> 
                  {user?.role === 'super_admin' || user?.role === 'cm' || user?.role === 'state_admin' 
                    ? "URGENT: An administrative reminder has been issued to the Department Head to assign an officer immediately."
                    : "URGENT: Administrator has sent a reminder to assign an officer to this complaint immediately."}
                </div>
              )}

              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>{complaint.title}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{complaint.description}</p>
              {complaint.criticalReason && (
                <div className="alert alert-critical" style={{ marginTop: 10 }}><AlertTriangle size={14} /> Critical: {complaint.criticalReason}</div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              {canAssign && complaint.status !== 'resolved' && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowAssign(true)}><User size={14} /> {complaint.assignedTo ? 'Reassign' : 'Assign Officer'}</button>
              )}
              {canNotifyDeptHead && (
                <button className="btn btn-warning btn-sm" onClick={async () => {
                  try {
                    await remindDeptHead(id);
                    toast.success('Department Head notified successfully');
                    refreshComplaint();
                  } catch (err) {
                    toast.error('Failed to notify Department Head');
                  }
                }}><AlertTriangle size={14} /> Remind Dept Head</button>
              )}
              {canVerify && <button className="btn btn-success btn-sm" onClick={() => setShowVerify(true)}><CheckCircle size={14} /> Verify Resolution</button>}
              <button className="btn btn-outline btn-sm" onClick={handleShare}><Share2 size={14} /> Share Tracking Link</button>
            </div>
          </div>
        </div>
      </div>

      {renderStepper()}


      {canVerify && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <CheckCircle size={20} style={{ marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 15 }}>Please verify if your complaint has been resolved</strong>
              <div style={{ fontSize: 13, marginTop: 4, marginBottom: 8 }}>Our officer marked this as resolved and provided the following proof. Please confirm whether the issue is actually fixed.</div>
              
              {complaint.resolutionNote && (
                <div style={{ background: '#fffbeb', borderLeft: '3px solid #d97706', padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
                  <strong>Officer's Note:</strong> {complaint.resolutionNote}
                </div>
              )}
              
              {complaint.resolutionImages?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Proof of Resolution:</strong>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {complaint.resolutionImages.map((img, i) => (
                      <a key={i} href={img} target="_blank" rel="noreferrer">
                        <img src={img} alt="Resolution Proof" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <button className="btn btn-success" onClick={() => setShowVerify(true)}>Verify Now</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">📋 Details</div></div>
            <div className="card-body">
              <div style={{ display: 'grid', gap: 12 }}>
                {[
                  ['Category', formatCategory(complaint.category)],
                  ['Department', complaint.department?.name || 'Not assigned'],
                  ['Source', complaint.source],
                  ['AI Confidence', complaint.aiConfidence ? `${(complaint.aiConfidence * 100).toFixed(0)}%` : 'N/A'],
                  complaint.sentimentScore != null && ['Sentiment', `${complaint.sentimentLabel?.replace(/_/g, ' ')} (${(complaint.sentimentScore * 100).toFixed(0)}%)`],
                  complaint.estimatedResolutionHours && ['Est. Resolution', `${complaint.estimatedResolutionHours}h`],
                  ['Upvotes', complaint.upvoteCount || 0],
                  ['Submitted', format(new Date(complaint.createdAt), 'dd MMM yyyy HH:mm')],
                  ['Due Date', complaint.dueDate ? format(new Date(complaint.dueDate), 'dd MMM yyyy') : 'N/A'],
                  complaint.resolvedAt && ['Resolved', format(new Date(complaint.resolvedAt), 'dd MMM yyyy HH:mm')],
                  complaint.resolutionTimeHours && ['Resolution Time', `${complaint.resolutionTimeHours}h`],
                ].filter(Boolean).map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right', textTransform: 'capitalize' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">📍 Location</div></div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 8 }}>
                <MapPin size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 500 }}>{complaint.address}</div>
                  {complaint.ward && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ward: {complaint.ward}</div>}
                  {complaint.district && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>District: {complaint.district}</div>}
                  {complaint.landmark && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Landmark: {complaint.landmark}</div>}
                </div>
              </div>
            </div>
          </div>

          {complaint.assignedTo && (
            <div className="card">
              <div className="card-header"><div className="card-title">👤 Assigned Officer</div></div>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>{complaint.assignedTo?.name?.charAt(0)}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{complaint.assignedTo?.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{complaint.assignedTo?.designation}</div>
                    {complaint.assignedTo?.phone && <div style={{ fontSize: 12, color: 'var(--primary)' }}>📞 {complaint.assignedTo?.phone}</div>}
                  </div>
                </div>
                {complaint.assignedAt && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>Assigned: {format(new Date(complaint.assignedAt), 'dd MMM yyyy HH:mm')}</div>}
              </div>
            </div>
          )}

          {complaint.verification?.respondedAt && (
            <div className="card">
              <div className="card-header"><div className="card-title">✅ Citizen Verification</div></div>
              <div className="card-body">
                <div className={`alert ${complaint.verification.citizenConfirmed ? 'alert-success' : 'alert-critical'}`}>
                  {complaint.verification.citizenConfirmed ? '✅ Citizen confirmed resolution' : '❌ Citizen REJECTED — False closure detected'}
                </div>
                {complaint.verification.satisfactionRating && <div style={{ marginTop: 8 }}>Rating: {'⭐'.repeat(complaint.verification.satisfactionRating)}</div>}
                {complaint.verification.rejectionReason && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--danger)' }}>Reason: {complaint.verification.rejectionReason}</div>}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">📅 Activity Timeline</div></div>
          <div className="card-body">
            <div className="timeline">
              {[...complaint.timeline].reverse().map((t, i) => (
                <div key={i} className="timeline-item">
                  <div className={`timeline-dot ${t.status === 'resolved' ? 'success' : t.status === 'reopened' ? 'danger' : ''}`}>{t.status === 'resolved' ? '✓' : i + 1}</div>
                  <div className="timeline-content">
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{formatStatus(t.status)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t.message}</div>
                    {t.updatedBy?.name && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>by {t.updatedBy.name}</div>}
                    <div className="timeline-time">{t.timestamp ? format(new Date(t.timestamp), 'dd MMM yyyy HH:mm') : ''}</div>
                    {t.proofImages?.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        {t.proofImages.map((img, j) => <img key={j} src={img} alt="proof" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {complaint.isComplex && complaint.agenticPlan && complaint.agenticPlan.length > 0 && (
        <div className="card" style={{ marginTop: 24, border: '1px solid #c7d2fe', boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.1)' }}>
          <div className="card-header" style={{ background: '#e0e7ff' }}>
            <div className="card-title" style={{ color: '#3730a3', display: 'flex', alignItems: 'center', gap: 8 }}>
              🤖 Agentic AI Resolution Plan
            </div>
            {complaint.humanInterventionRequired && (
              <span className="badge badge-danger">Human Intervention Required</span>
            )}
          </div>
          <div className="card-body">
            <p style={{ fontSize: 14, color: '#4338ca', marginBottom: 16 }}>
              <strong>AI Reasoning:</strong> {complaint.agenticReasoning}
            </p>
            {complaint.escalationReason && (
              <div className="alert alert-critical" style={{ marginBottom: 16 }}>
                <strong>Escalation Reason:</strong> {complaint.escalationReason}
              </div>
            )}
            
            <div style={{ display: 'grid', gap: 12 }}>
              {complaint.agenticPlan.map((task, idx) => (
                <div key={task.taskId} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: task.status === 'completed' ? '#f0fdf4' : task.status === 'blocked' ? '#fef2f2' : '#fff' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span className={`badge ${task.status === 'completed' ? 'badge-success' : task.status === 'in_progress' ? 'badge-primary' : task.status === 'blocked' ? 'badge-danger' : ''}`}>{task.status.replace('_', ' ').toUpperCase()}</span>
                      <strong style={{ fontSize: 15 }}>Task {idx + 1}: {task.department?.name || 'Unassigned Dept'}</strong>
                      {task.dependency && <span style={{ fontSize: 12, color: '#64748b' }}>(Depends on: {task.dependency})</span>}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 4 }}>{task.taskDescription}</div>
                    {task.assignedTo && <div style={{ fontSize: 12, color: '#4338ca' }}>👤 Claimed by: {task.assignedTo?.name}</div>}
                  </div>
                  {(canUpdateStatus || isAdmin() || user?.role === 'department_head') && task.status !== 'completed' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm btn-outline" disabled={actionLoading} onClick={() => handleSubTaskUpdate(task.taskId, 'in_progress')}>Start</button>
                      <button className="btn btn-sm btn-success" disabled={actionLoading} onClick={() => handleSubTaskUpdate(task.taskId, 'completed')}>Done</button>
                      <button className="btn btn-sm btn-danger" disabled={actionLoading} onClick={() => handleSubTaskUpdate(task.taskId, 'blocked')}>Block</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <CommentsThread complaintId={complaint._id} />
      </div>

      {showAssign && (
        <div className="modal-overlay" onClick={() => setShowAssign(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">Assign Officer</div><button className="btn btn-icon" onClick={() => setShowAssign(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Select Officer</label>
                <select className="form-control" value={selectedOfficer} onChange={(e) => setSelectedOfficer(e.target.value)}>
                  <option value="">Choose officer...</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.id} disabled={o.isFull}>
                      {o.name} — {o.department?.name || o.department} ({o.activeComplaints}/{o.bandwidth} complaints){o.isFull ? ' FULL' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {selectedOfficer && (() => {
                const o = officers.find((x) => x.id === selectedOfficer);
                return o ? <div className={`alert ${o.capacityPercent > 80 ? 'alert-warning' : 'alert-info'}`} style={{ marginBottom: 12 }}>Workload: {o.capacityPercent}% ({o.activeComplaints}/{o.bandwidth})</div> : null;
              })()}
              <div className="form-group">
                <label className="form-label">Assignment Note (optional)</label>
                <textarea className="form-control" rows={3} value={assignNote} onChange={(e) => setAssignNote(e.target.value)} placeholder="Instructions for the officer..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAssign(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAssign} disabled={actionLoading}>{actionLoading ? 'Assigning...' : 'Assign'}</button>
            </div>
          </div>
        </div>
      )}

      {showStatus && (
        <div className="modal-overlay" onClick={() => setShowStatus(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">Request Verification</div><button className="btn btn-icon" onClick={() => setShowStatus(false)}>✕</button></div>
            <div className="modal-body">
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                You are about to mark this complaint as completed. Please upload photo evidence of the resolution. The AI will verify this proof, and it will be sent to the citizen for final approval.
              </div>
              <div className="form-group">
                <label className="form-label">Resolution Note</label>
                <textarea className="form-control" rows={3} value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Describe exactly what work was done..." />
              </div>
              <div className="form-group">
                <label className="form-label">Proof of Work (Images) <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="file" multiple accept="image/*" className="form-control" onChange={(e) => setProofImages(e.target.files)} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Please upload clear images showing the resolved issue. Location metadata will be extracted for SLA checking.</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowStatus(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handleStatusUpdate} disabled={actionLoading || !proofImages?.length}>
                {actionLoading ? 'Submitting...' : 'Send for Verification ✅'}
              </button>
            </div>
          </div>
        </div>
      )}


      {showVerify && (
        <div className="modal-overlay" onClick={resetVerifyModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><div className="modal-title">✅ Verify Resolution</div></div>
            <div className="modal-body">
              <div className="alert alert-info" style={{ marginBottom: 16 }}>The officer has marked your complaint as resolved. Has your issue actually been fixed?</div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <button className={`btn ${verifyConfirm === true ? 'btn-success' : 'btn-outline'}`} style={{ flex: 1 }} onClick={() => setVerifyConfirm(true)}>✅ Yes, it's resolved</button>
                <button className={`btn ${verifyConfirm === false ? 'btn-danger' : 'btn-outline'}`} style={{ flex: 1 }} onClick={() => setVerifyConfirm(false)}>❌ No, still not fixed</button>
              </div>
              {verifyConfirm === true && (
                <div className="form-group">
                  <label className="form-label">Rate the resolution (1-5 ⭐)</label>
                  <div style={{ display: 'flex', gap: 8, fontSize: 28 }}>
                    {[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ cursor: 'pointer', opacity: rating >= n ? 1 : 0.3 }} onClick={() => setRating(n)}>⭐</span>)}
                  </div>
                </div>
              )}
              {verifyConfirm === false && (
                <div className="form-group">
                  <label className="form-label">Why is it not resolved? <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <textarea className="form-control" rows={3} value={verifyReason} onChange={(e) => setVerifyReason(e.target.value)} placeholder="Describe the issue still present..." />
                  <div className="alert alert-warning" style={{ marginTop: 8 }}>⚠️ This will be flagged as a false closure and the officer will be held accountable.</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={resetVerifyModal}>Cancel</button>
              {verifyConfirm !== null && (
                <button className={`btn ${verifyConfirm ? 'btn-success' : 'btn-danger'}`} onClick={() => handleVerify(verifyConfirm)} disabled={actionLoading}>
                  {actionLoading ? 'Submitting...' : 'Submit Verification'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
