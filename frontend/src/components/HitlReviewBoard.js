import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

export default function HitlReviewBoard({ hitlRequest, onResolved }) {
  const [loading, setLoading] = useState(false);
  const [adminComments, setAdminComments] = useState('');
  const [departments, setDepartments] = useState({});
  
  // For CREATE_PLAN, allow modifying the proposed plan
  const [modifiedPlan, setModifiedPlan] = useState(
    hitlRequest.type === 'CREATE_PLAN' ? hitlRequest.proposedAction : null
  );

  useEffect(() => {
    if (hitlRequest.type === 'CREATE_PLAN') {
      api.get('/departments').then(res => {
        const deptMap = {};
        res.data.departments.forEach(d => { deptMap[d._id] = d.name; });
        setDepartments(deptMap);
      }).catch(err => console.error("Failed to load departments:", err));
    }
  }, [hitlRequest.type]);

  const handleTaskChange = (index, field, value) => {
    const newPlan = [...modifiedPlan];
    newPlan[index] = { ...newPlan[index], [field]: value };
    setModifiedPlan(newPlan);
  };

  const handleResolve = async (action) => {
    if (action === 'reject' && !adminComments.trim()) {
      return toast.error('Please provide a reason for rejecting.');
    }
    
    setLoading(true);
    try {
      await api.put(`/hitl/${hitlRequest._id}/resolve`, {
        action,
        adminComments,
        modifiedState: hitlRequest.type === 'CREATE_PLAN' ? modifiedPlan : undefined
      });
      toast.success(`Request ${action}d successfully`);
      onResolved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resolve HITL request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: 8, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 24 }}>🛑</span>
        <div>
          <h3 style={{ margin: 0, color: '#b45309' }}>Human-in-the-Loop (HITL) Review Required</h3>
          <div style={{ fontSize: 13, color: '#92400e' }}>
            The AI Agent has paused execution and is requesting administrative approval to proceed.
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', padding: 16, borderRadius: 6, border: '1px solid #fcd34d', marginBottom: 16 }}>
        <strong>Action Type:</strong> {hitlRequest.type.replace('_', ' ')}
        <br/>
        <strong>AI Reasoning:</strong> {hitlRequest.contextData?.reason || JSON.stringify(hitlRequest.contextData)}
      </div>

      {hitlRequest.type === 'CREATE_PLAN' && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Review & Modify Proposed Agentic Plan</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {modifiedPlan.map((task, idx) => (
              <div key={idx} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Task {idx + 1}</div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Description</label>
                  <textarea 
                    className="form-control" 
                    rows={2} 
                    value={task.taskDescription}
                    onChange={(e) => handleTaskChange(idx, 'taskDescription', e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                   <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                     <label className="form-label" style={{ fontSize: 12 }}>
                       Department: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{departments[task.department] || 'Unknown Dept'}</span>
                     </label>
                     <input 
                       className="form-control" 
                       value={task.department || ''}
                       placeholder="Department ID"
                       onChange={(e) => handleTaskChange(idx, 'department', e.target.value)}
                     />
                   </div>
                   <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                     <label className="form-label" style={{ fontSize: 12 }}>Dependency (Task ID)</label>
                     <input 
                       className="form-control" 
                       value={task.dependency || ''}
                       onChange={(e) => handleTaskChange(idx, 'dependency', e.target.value)}
                     />
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hitlRequest.type === 'MASS_EMAIL' && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Review Emails to be Sent</h4>
          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
            {hitlRequest.proposedAction.map((email, idx) => (
              <div key={idx} style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>
                <strong>To:</strong> {email.to} <br/>
                <strong>Subject:</strong> {email.subject}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Reviewer Comments (Required if rejecting)</label>
        <input 
          className="form-control" 
          placeholder="e.g., Department assignment is incorrect, please fix..."
          value={adminComments}
          onChange={(e) => setAdminComments(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button 
          className="btn btn-success" 
          disabled={loading} 
          onClick={() => handleResolve('approve')}
        >
          {loading ? 'Processing...' : 'Approve & Resume'}
        </button>
        <button 
          className="btn btn-danger" 
          disabled={loading} 
          onClick={() => handleResolve('reject')}
        >
          Reject & Halt
        </button>
      </div>
    </div>
  );
}
