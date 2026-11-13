import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare,
  Plus,
  ThumbsUp,
  CheckCircle2,
  Search,
  RefreshCw,
  Send,
  CornerDownRight,
  Award,
  Trash2,
  ArrowLeft,
  X
} from 'lucide-react';

export default function ForumView() {
  const { user, token } = useAuth();
  const isFacultyOrAdmin = user?.role === 'faculty' || user?.role === 'admin';

  const [threads, setThreads] = useState([]);
  const [mySubjects, setMySubjects] = useState([]);
  const [scopeFilter, setScopeFilter] = useState('all'); // 'all', 'general', 'subject', 'society'
  const [subjectFilter, setSubjectFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [threadDetail, setThreadDetail] = useState(null); // { thread, posts }
  const [replyBody, setReplyBody] = useState('');
  const [replyToPostId, setReplyToPostId] = useState(null);

  // Ask a Doubt Modal
  const [showAskModal, setShowAskModal] = useState(false);
  const [newThread, setNewThread] = useState({ scope: 'general', subjectId: '', title: '', body: '' });
  const [loading, setLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (scopeFilter !== 'all') params.set('scope', scopeFilter);
      if (subjectFilter) params.set('subjectId', subjectFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/forum/threads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setThreads(await res.json());
      }
    } catch (err) {
      console.error('Forum load error:', err);
    } finally {
      setLoading(false);
    }
  }, [token, scopeFilter, subjectFilter, searchQuery]);

  const fetchThreadDetail = useCallback(async (threadId) => {
    if (!token || !threadId) return;
    try {
      const res = await fetch(`/api/forum/threads/${threadId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setThreadDetail(await res.json());
      }
    } catch (err) {
      console.error('Thread detail error:', err);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/forum/my-subjects', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        setMySubjects(data);
        if (data.length > 0 && !newThread.subjectId) {
          setNewThread(prev => ({ ...prev, subjectId: data[0].id }));
        }
      })
      .catch(() => {});
  }, [token, user?.role]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    if (selectedThreadId) {
      fetchThreadDetail(selectedThreadId);
    } else {
      setThreadDetail(null);
    }
  }, [selectedThreadId, fetchThreadDetail]);

  // Lightweight polling every 8 seconds for live Q&A updates
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      fetchThreads();
      if (selectedThreadId) fetchThreadDetail(selectedThreadId);
    }, 8000);
    return () => clearInterval(interval);
  }, [token, selectedThreadId, fetchThreads, fetchThreadDetail]);

  const handleCreateThread = async (e) => {
    e.preventDefault();
    const payload = {
      title: newThread.title,
      body: newThread.body,
      scope: newThread.scope,
      subjectId: newThread.scope === 'subject' ? Number(newThread.subjectId) : null
    };
    const res = await fetch('/api/forum/threads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      setShowAskModal(false);
      setNewThread(prev => ({ ...prev, title: '', body: '' }));
      await fetchThreads();
      setSelectedThreadId(data.threadId);
    } else {
      alert(data.error || 'Could not post thread');
    }
  };

  const handlePostReply = async (e) => {
    e.preventDefault();
    if (!selectedThreadId || !replyBody.trim()) return;
    const res = await fetch(`/api/forum/threads/${selectedThreadId}/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: replyBody, parentPostId: replyToPostId })
    });
    if (res.ok) {
      setReplyBody('');
      setReplyToPostId(null);
      fetchThreadDetail(selectedThreadId);
      fetchThreads();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to reply');
    }
  };

  const handleToggleLike = async (postId) => {
    const res = await fetch(`/api/forum/posts/${postId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      fetchThreadDetail(selectedThreadId);
    }
  };

  const handleToggleVerify = async (postId) => {
    const res = await fetch(`/api/forum/posts/${postId}/verify`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      fetchThreadDetail(selectedThreadId);
      fetchThreads();
    } else {
      const err = await res.json();
      alert(err.error || 'Verification failed');
    }
  };

  const handleDeleteThread = async (threadId) => {
    if (!window.confirm('Delete this thread permanently?')) return;
    const res = await fetch(`/api/forum/threads/${threadId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      setSelectedThreadId(null);
      fetchThreads();
    }
  };

  // Organize posts into top-level + nested replies
  const renderPosts = (posts) => {
    if (!posts || posts.length === 0) return null;
    const byParent = {};
    const topLevel = [];
    for (const p of posts) {
      if (p.parent_post_id) {
        if (!byParent[p.parent_post_id]) byParent[p.parent_post_id] = [];
        byParent[p.parent_post_id].push(p);
      } else {
        topLevel.push(p);
      }
    }

    const renderPostCard = (post, depth = 0) => (
      <div key={post.id} style={{ marginLeft: depth > 0 ? `${Math.min(depth, 3) * 1.5}rem` : 0, marginTop: '0.65rem' }}>
        <div style={{
          padding: '1rem 1.15rem',
          borderRadius: 'var(--radius-md)',
          background: post.is_faculty_answer ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-surface-subtle)',
          border: post.is_faculty_answer ? '1.5px solid var(--success-border)' : '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {depth > 0 && <CornerDownRight size={14} color="var(--text-muted)" />}
              <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>{post.author_name}</span>
              <span className={`badge badge-${post.author_role === 'faculty' ? 'success' : post.author_role === 'admin' ? 'primary' : 'info'}`} style={{ fontSize: '0.66rem', textTransform: 'uppercase' }}>
                {post.author_role === 'faculty' ? 'Faculty' : post.author_role}
              </span>
              {post.is_faculty_answer === 1 && (
                <span className="badge badge-success" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <CheckCircle2 size={12} /> Verified Answer
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {new Date(post.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <p style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {post.body}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', paddingTop: '0.25rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleToggleLike(post.id)}
              className={`btn btn-sm ${post.user_has_liked ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.2rem 0.55rem', fontSize: '0.74rem' }}
            >
              <ThumbsUp size={12} /> {post.like_count || 0}
            </button>

            <button
              onClick={() => setReplyToPostId(post.id)}
              className="btn btn-outline btn-sm"
              style={{ padding: '0.2rem 0.55rem', fontSize: '0.74rem' }}
            >
              Reply
            </button>

            {isFacultyOrAdmin && (
              <button
                onClick={() => handleToggleVerify(post.id)}
                className={`btn btn-sm ${post.is_faculty_answer ? 'btn-success' : 'btn-secondary'}`}
                style={{ padding: '0.2rem 0.55rem', fontSize: '0.74rem' }}
              >
                <Award size={12} /> {post.is_faculty_answer ? 'Unmark Verified' : 'Mark Verified Answer'}
              </button>
            )}
          </div>
        </div>

        {(byParent[post.id] || []).map(child => renderPostCard(child, depth + 1))}
      </div>
    );

    return topLevel.map(p => renderPostCard(p, 0));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(13, 148, 136, 0.08) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        borderLeft: '5px solid var(--role-accent)'
      }}>
        <div>
          <div className="badge badge-info" style={{ marginBottom: '0.4rem' }}>
            Class & Campus Q&A • Auto-Polling (8s)
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Student–Teacher Discussion Forum</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Ask subject doubts, collaborate with classmates, get verified faculty answers, and message society coordinators.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button onClick={() => { fetchThreads(); if (selectedThreadId) fetchThreadDetail(selectedThreadId); }} className="btn btn-secondary btn-sm">
            <RefreshCw size={15} /> Refresh
          </button>
          <button onClick={() => setShowAskModal(true)} className="btn btn-primary btn-sm">
            <Plus size={16} /> Ask a Doubt
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Threads' },
            { id: 'general', label: 'General Campus' },
            { id: 'subject', label: 'My Subjects' },
            { id: 'society', label: 'Society Messages' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setScopeFilter(tab.id); if (tab.id !== 'subject') setSubjectFilter(''); }}
              className={`btn btn-sm ${scopeFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="form-select"
            style={{ width: '210px', padding: '0.4rem 0.65rem' }}
            value={subjectFilter}
            onChange={(e) => {
              setSubjectFilter(e.target.value);
              if (e.target.value) setScopeFilter('subject');
            }}
          >
            <option value="">Filter by Subject...</option>
            {mySubjects.map(s => (
              <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
            ))}
          </select>

          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2rem', paddingTop: '0.4rem', paddingBottom: '0.4rem' }}
              placeholder="Search doubts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Main Split / Detail Layout */}
      {!selectedThreadId ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {threads.length === 0 ? (
            <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              {loading ? 'Loading discussions...' : 'No threads match your filter. Start a new discussion!'}
            </div>
          ) : (
            threads.map(t => (
              <div
                key={t.id}
                onClick={() => setSelectedThreadId(t.id)}
                className="glass-panel"
                style={{ padding: '1.25rem 1.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{t.title}</h3>
                    {t.scope === 'subject' && t.subject_code && (
                      <span className="badge badge-info">{t.subject_code}</span>
                    )}
                    {t.scope === 'general' && (
                      <span className="badge badge-primary">Campus-Wide</span>
                    )}
                    {t.scope === 'society' && (
                      <span className="badge badge-warning">{t.society_name || 'Society'}</span>
                    )}
                    {t.is_resolved === 1 && (
                      <span className="badge badge-success">✓ Verified Answer</span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {t.post_count} {t.post_count === 1 ? 'post' : 'posts'}
                  </span>
                </div>

                {t.opening_body && (
                  <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.opening_body}
                  </p>
                )}

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Started by <strong>{t.author_name}</strong> ({t.author_role})</span>
                  <span>Last activity: {new Date(t.last_activity_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <button onClick={() => setSelectedThreadId(null)} className="btn btn-secondary btn-sm">
              <ArrowLeft size={15} /> Back to Threads
            </button>

            {threadDetail?.thread && (user?.role === 'admin' || threadDetail.thread.author_id === user?.id) && (
              <button onClick={() => handleDeleteThread(threadDetail.thread.id)} className="btn btn-danger btn-sm">
                <Trash2 size={14} /> Delete Thread
              </button>
            )}
          </div>

          {threadDetail?.thread && (
            <>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                  {threadDetail.thread.subject_code && (
                    <span className="badge badge-info">{threadDetail.thread.subject_code} - {threadDetail.thread.subject_name}</span>
                  )}
                  {threadDetail.thread.scope === 'general' && <span className="badge badge-primary">General Campus</span>}
                  {threadDetail.thread.scope === 'society' && <span className="badge badge-warning">{threadDetail.thread.society_name}</span>}
                  {threadDetail.thread.is_resolved === 1 && <span className="badge badge-success">✓ Resolved</span>}
                </div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{threadDetail.thread.title}</h2>
              </div>

              <div>{renderPosts(threadDetail.posts)}</div>

              {/* Reply Box */}
              <form onSubmit={handlePostReply} style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                {replyToPostId && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>Replying to post #{replyToPostId}</span>
                    <button type="button" onClick={() => setReplyToPostId(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>
                      Cancel nested reply
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-end' }}>
                  <textarea
                    className="form-textarea"
                    style={{ flex: 1, minHeight: '72px' }}
                    placeholder={isFacultyOrAdmin ? 'Write a faculty explanation or reply...' : 'Write your reply or helpful insight...'}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-primary">
                    <Send size={15} /> Post Reply
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {/* ASK A DOUBT MODAL */}
      {showAskModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Ask a Doubt / Start Discussion</h3>
              <button onClick={() => setShowAskModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateThread}>
              <div className="form-group">
                <label className="form-label">Visibility Scope</label>
                <select className="form-select" value={newThread.scope} onChange={(e) => setNewThread({ ...newThread, scope: e.target.value })}>
                  <option value="general">General Campus-Wide (All Students & Faculty)</option>
                  <option value="subject">Subject-Specific (Enrolled Students & Subject Faculty)</option>
                </select>
              </div>
              {newThread.scope === 'subject' && (
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <select className="form-select" value={newThread.subjectId} onChange={(e) => setNewThread({ ...newThread, subjectId: e.target.value })}>
                    {mySubjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Question / Topic Title *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Time complexity of Dijkstra with Fibonacci Heap"
                  value={newThread.title}
                  onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Details *</label>
                <textarea
                  required
                  className="form-textarea"
                  placeholder="Describe your doubt clearly..."
                  value={newThread.body}
                  onChange={(e) => setNewThread({ ...newThread, body: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAskModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Publish Thread</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

