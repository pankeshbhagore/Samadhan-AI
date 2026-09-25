import React, { useState, useEffect } from 'react';
import { getComments, addComment } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { Send, Lock, MessageSquare } from 'lucide-react';

const AVATAR_COLORS = ['#1a3a6b', '#ff6b35', '#16a34a', '#7c3aed', '#0891b2', '#db2777'];
const colorFor = (id) => AVATAR_COLORS[Math.abs(String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];

export default function CommentsThread({ complaintId }) {
  const { user, isCitizen } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);

  const isStaff = ['employee', 'department_head', 'cm', 'super_admin'].includes(user?.role);

  const fetchComments = () => {
    setLoading(true);
    getComments(complaintId).then(({ data }) => setComments(data.comments)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchComments(); }, [complaintId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      const { data } = await addComment(complaintId, { message, isInternal: isStaff && isInternal });
      setComments((c) => [...c, data.comment]);
      setMessage('');
      setIsInternal(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to post comment'));
    } finally { setSending(false); }
  };

  return (
    <div className="card">
      <div className="card-header"><div className="card-title"><MessageSquare size={16} style={{ marginRight: 6, verticalAlign: -3 }} />Discussion {comments.length > 0 && `(${comments.length})`}</div></div>
      <div className="card-body">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="spinner" style={{ width: 22, height: 22 }} /></div>
        ) : comments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>No comments yet. Start the conversation below.</div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {comments.map((c) => (
              <div key={c._id} className={`comment-item${c.isInternal ? ' comment-internal' : ''}`}>
                <div className="comment-avatar" style={{ background: colorFor(c.author?._id) }}>{c.author?.name?.charAt(0) || '?'}</div>
                <div className="comment-bubble">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{c.author?.name || 'Unknown'}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                  </div>
                  {c.isInternal && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--warning)', fontWeight: 600, marginBottom: 4 }}>
                      <Lock size={10} /> INTERNAL NOTE — not visible to citizen
                    </div>
                  )}
                  <div style={{ fontSize: 13 }}>{c.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSend}>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <textarea
              className="form-control"
              rows={2}
              placeholder={isCitizen() ? 'Ask a question or add details...' : 'Add an update or internal note...'}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {isStaff ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                <Lock size={12} /> Internal note (staff only)
              </label>
            ) : <span />}
            <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !message.trim()}>
              <Send size={13} /> {sending ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
