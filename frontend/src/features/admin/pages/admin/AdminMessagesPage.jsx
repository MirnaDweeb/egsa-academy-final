import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useRealTimeSocket, getActiveToken } from '../../../../shared/socket/socketClient';

const API_BASE = '/admin-api/messages';

function authHeaders() {
  const token = getActiveToken();
  return {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
  };
}

export default function AdminMessagesPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filterType, setFilterType] = useState('ALL'); // ALL | student_admin | instructor_admin | direct
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL | open | in_progress | resolved
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const messagesEndRef = useRef(null);
  const feedContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  // Real-time socket hook
  const {
    socket,
    connected,
    connectionState,
    joinConversation,
    leaveConversation,
    sendMessage: socketSendMessage,
    markRead: socketMarkRead,
  } = useRealTimeSocket();

  const handleUpdateStatus = async (newStatus) => {
    if (!conversationId || updatingStatus) return;
    try {
      setUpdatingStatus(true);
      await axios.patch(`${API_BASE}/conversations/${conversationId}/status`, { status: newStatus }, authHeaders());
      setActiveConversation((prev) => (prev ? { ...prev, supportStatus: newStatus } : prev));
      fetchConversations(true);
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update ticket status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Load conversations
  const fetchConversations = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingConversations(true);
      const res = await axios.get(`${API_BASE}/conversations`, authHeaders());
      const list = res.data?.data || [];
      setConversations(list);
      return list;
    } catch (err) {
      console.error('Failed to load admin conversations:', err);
      return [];
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load active conversation & message history
  useEffect(() => {
    if (!conversationId) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }

    let active = true;

    const loadChat = async () => {
      setLoadingMessages(true);
      setSendError(null);
      try {
        const [convoRes, msgsRes] = await Promise.all([
          axios.get(`${API_BASE}/conversations/${conversationId}`, authHeaders()),
          axios.get(`${API_BASE}/conversations/${conversationId}/messages`, authHeaders()),
        ]);

        if (!active) return;

        const convo = convoRes.data?.data || convoRes.data;
        setActiveConversation(convo);

        const msgList = msgsRes.data?.data || [];
        setMessages(msgList);
        shouldAutoScrollRef.current = true;

        // Mark as read
        axios.patch(`${API_BASE}/conversations/${conversationId}/read`, {}, authHeaders()).catch(() => {});
        socketMarkRead(conversationId);
        setConversations((prev) =>
          prev.map((c) =>
            c._id === conversationId ? { ...c, unreadCountAdmin: 0 } : c
          )
        );
      } catch (err) {
        if (active) {
          console.error('Failed to load conversation thread for admin:', err);
          setActiveConversation(null);
        }
      } finally {
        if (active) setLoadingMessages(false);
      }
    };

    loadChat();

    return () => {
      active = false;
    };
  }, [conversationId, socketMarkRead]);

  // Real-Time Socket.IO Subscription
  useEffect(() => {
    if (!socket || !conversationId) return;

    joinConversation(conversationId, (ack) => {
      if (!ack?.success) {
        console.warn('[Socket.IO] Admin join conversation rejected:', ack?.error);
      }
    });

    const handleNewMessage = (payload) => {
      const { conversationId: msgConvId, message } = payload || {};
      if (msgConvId === conversationId && message) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          if (feedContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = feedContainerRef.current;
            shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 150;
          }
          return [...prev, message];
        });
        socketMarkRead(conversationId);
      }
      fetchConversations(true);
    };

    const handleMessageRead = (payload) => {
      if (payload?.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m.read ? m : { ...m, read: true, readAt: payload.readAt }))
        );
      }
    };

    const handleStatusChanged = (payload) => {
      if (payload?.conversationId === conversationId) {
        setActiveConversation((prev) => (prev ? { ...prev, supportStatus: payload.supportStatus } : prev));
      }
      fetchConversations(true);
    };

    const handleConversationUpdate = () => {
      fetchConversations(true);
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:read', handleMessageRead);
    socket.on('conversation:status_changed', handleStatusChanged);
    socket.on('conversation:update', handleConversationUpdate);

    return () => {
      leaveConversation(conversationId);
      socket.off('message:new', handleNewMessage);
      socket.off('message:read', handleMessageRead);
      socket.off('conversation:status_changed', handleStatusChanged);
      socket.off('conversation:update', handleConversationUpdate);
    };
  }, [socket, conversationId, joinConversation, leaveConversation, socketMarkRead, fetchConversations]);

  // Autoscroll
  useEffect(() => {
    if (shouldAutoScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Send message as Admin
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const content = draft.trim();
    if (!content || sending || !conversationId) return;

    setSending(true);
    setSendError(null);

    if (socket && connected) {
      socketSendMessage({ conversationId, body: content }, (ack) => {
        setSending(false);
        if (ack?.success && ack?.data) {
          const created = ack.data;
          setMessages((prev) => (prev.some((m) => m._id === created._id) ? prev : [...prev, created]));
          setDraft('');
          shouldAutoScrollRef.current = true;
          fetchConversations(true);
          if (textareaRef.current) textareaRef.current.focus();
        } else {
          setSendError(ack?.error || 'Failed to dispatch message');
        }
      });
    } else {
      try {
        const res = await axios.post(
          `${API_BASE}/conversations/${conversationId}/messages`,
          { body: content },
          authHeaders()
        );
        const created = res.data?.data;
        if (created && created._id) {
          setMessages((prev) => (prev.some((m) => m._id === created._id) ? prev : [...prev, created]));
        }
        setDraft('');
        shouldAutoScrollRef.current = true;
        fetchConversations(true);
        if (textareaRef.current) textareaRef.current.focus();
      } catch (err) {
        console.error('Failed to send admin message via REST:', err);
        setSendError(err.response?.data?.message || err.message || 'Failed to send message');
      } finally {
        setSending(false);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const CATEGORY_MAP = {
    general: { label: 'General', badgeClass: 'bg-primary-subtle text-primary border-primary-subtle' },
    technical: { label: 'Technical', badgeClass: 'bg-warning-subtle text-dark border-warning-subtle' },
    academic: { label: 'Academic', badgeClass: 'bg-info-subtle text-info border-info-subtle' },
    complaint: { label: 'Complaint', badgeClass: 'bg-danger-subtle text-danger border-danger-subtle' },
  };

  const getStatusBadge = (status) => {
    const s = status || 'open';
    if (s === 'resolved') {
      return <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle small px-2 py-0">Resolved</span>;
    }
    if (s === 'in_progress') {
      return <span className="badge bg-primary-subtle text-primary border border-primary-subtle small px-2 py-0">In Progress</span>;
    }
    return <span className="badge bg-success-subtle text-success border border-success-subtle small px-2 py-0">Open</span>;
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (filterType !== 'ALL' && c.type !== filterType) {
      return false;
    }
    if (filterStatus !== 'ALL' && (c.supportStatus || 'open') !== filterStatus) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const sName = (c.student?.name || '').toLowerCase();
    const sEmail = (c.student?.email || '').toLowerCase();
    const iName = (c.instructor?.name || '').toLowerCase();
    const iEmail = (c.instructor?.email || '').toLowerCase();
    const subj = (c.subject || '').toLowerCase();
    return sName.includes(q) || sEmail.includes(q) || iName.includes(q) || iEmail.includes(q) || subj.includes(q);
  });

  const hasActiveChat = Boolean(conversationId && activeConversation);

  const getRecipientLabel = (c) => {
    if (c.type === 'student_admin') {
      return `Cadet: ${c.student?.name || 'Student'}`;
    }
    if (c.type === 'instructor_admin') {
      return `Faculty: ${c.instructor?.name || 'Instructor'}`;
    }
    return `${c.student?.name || 'Student'} ↔ ${c.instructor?.name || 'Instructor'}`;
  };

  const getTypeBadge = (type) => {
    if (type === 'student_admin') {
      return <span className="badge bg-primary-subtle text-primary border border-primary-subtle small px-2 py-0">Cadet Support</span>;
    }
    if (type === 'instructor_admin') {
      return <span className="badge bg-warning-subtle text-dark border border-warning-subtle small px-2 py-0">Faculty Inquiry</span>;
    }
    return <span className="badge bg-info-subtle text-info border border-info-subtle small px-2 py-0">Direct Chat</span>;
  };

  return (
    <div className="container-fluid py-3 px-4">
      {/* Top Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: '#0f172a' }}>
            <i className="fa-solid fa-headset text-primary me-2" />
            Academy Support & Communications Desk
          </h2>
          <p className="text-muted small mb-0">
            Real-time administrative support and direct communications with Cadets and Faculty Instructors
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          {connected ? (
            <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 d-flex align-items-center gap-2">
              <i className="fa-solid fa-bolt" />
              <span>Real-Time Gateway Connected</span>
            </span>
          ) : (
            <span className="badge bg-warning-subtle text-warning border border-warning-subtle px-3 py-2 d-flex align-items-center gap-2">
              <i className="fa-solid fa-circle-notch fa-spin" />
              <span>Connecting to Socket Gateway...</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div
        className="d-flex bg-white rounded-3 border shadow-sm overflow-hidden"
        style={{ height: 'calc(100vh - 150px)', minHeight: '600px' }}
      >
        {/* Sidebar */}
        <aside
          className="d-flex flex-column border-end bg-light"
          style={{ width: '380px', minWidth: '320px', maxWidth: '420px' }}
        >
          {/* Filters & Search */}
          <div className="p-3 border-bottom bg-white">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-bold small text-uppercase text-muted">Support Threads</span>
              <span className="badge bg-light text-dark border mono small">
                {filteredConversations.length}
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="btn-group btn-group-sm w-100 mb-2">
              <button
                type="button"
                className={`btn py-1 ${filterType === 'ALL' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: '0.78rem' }}
                onClick={() => setFilterType('ALL')}
              >
                All
              </button>
              <button
                type="button"
                className={`btn py-1 ${filterType === 'student_admin' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: '0.78rem' }}
                onClick={() => setFilterType('student_admin')}
              >
                Cadets
              </button>
              <button
                type="button"
                className={`btn py-1 ${filterType === 'instructor_admin' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: '0.78rem' }}
                onClick={() => setFilterType('instructor_admin')}
              >
                Faculty
              </button>
              <button
                type="button"
                className={`btn py-1 ${filterType === 'direct' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: '0.78rem' }}
                onClick={() => setFilterType('direct')}
              >
                Direct
              </button>
            </div>

            {/* Status Filter Pills */}
            <div className="btn-group btn-group-sm w-100 mb-2" role="group">
              <button
                type="button"
                className={`btn py-1 ${filterStatus === 'ALL' ? 'btn-dark' : 'btn-outline-secondary'}`}
                style={{ fontSize: '0.72rem' }}
                onClick={() => setFilterStatus('ALL')}
              >
                All Status
              </button>
              <button
                type="button"
                className={`btn py-1 ${filterStatus === 'open' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                style={{ fontSize: '0.72rem' }}
                onClick={() => setFilterStatus('open')}
              >
                Open
              </button>
              <button
                type="button"
                className={`btn py-1 ${filterStatus === 'in_progress' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: '0.72rem' }}
                onClick={() => setFilterStatus('in_progress')}
              >
                In Prog
              </button>
              <button
                type="button"
                className={`btn py-1 ${filterStatus === 'resolved' ? 'btn-secondary text-white' : 'btn-outline-secondary'}`}
                style={{ fontSize: '0.72rem' }}
                onClick={() => setFilterStatus('resolved')}
              >
                Resolved
              </button>
            </div>

            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light border-end-0">
                <i className="fa-solid fa-magnifying-glass text-muted" />
              </span>
              <input
                type="search"
                className="form-control bg-light border-start-0"
                placeholder="Search user, email, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-grow-1 overflow-auto">
            {loadingConversations ? (
              <div className="p-4 text-center text-muted">
                <div className="spinner-border spinner-border-sm text-primary mb-2" role="status" />
                <div className="small">Loading support threads...</div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-muted">
                <i className="fa-solid fa-comments text-muted mb-2" style={{ fontSize: '2rem', opacity: 0.3 }} />
                <div className="small fw-semibold">No active conversations found</div>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isActive = c._id === conversationId;
                const unread = c.unreadCountAdmin || 0;
                const snippet = typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.body || '');
                const catMeta = CATEGORY_MAP[c.category || 'general'];

                return (
                  <div
                    key={c._id}
                    role="button"
                    tabIndex={0}
                    className={`d-flex align-items-center gap-3 p-3 border-bottom transition ${
                      isActive ? 'bg-primary-subtle border-start border-3 border-primary' : 'bg-transparent hover-bg-light'
                    }`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/admin/messages/${c._id}`)}
                  >
                    <div
                      className="d-flex align-items-center justify-content-center bg-dark text-white rounded-circle flex-shrink-0"
                      style={{ width: '42px', height: '42px' }}
                    >
                      <i className={c.type === 'instructor_admin' ? 'fa-solid fa-chalkboard-user text-warning' : c.type === 'student_admin' ? 'fa-solid fa-user-graduate text-info' : 'fa-solid fa-comments text-light'} />
                    </div>

                    <div className="flex-grow-1 min-w-0">
                      <div className="d-flex align-items-center justify-content-between gap-1 mb-1">
                        <span className={`small text-truncate ${unread > 0 ? 'fw-bold text-dark' : 'fw-semibold text-secondary'}`}>
                          {getRecipientLabel(c)}
                        </span>
                        <span className="text-muted small" style={{ fontSize: '0.7rem' }}>
                          {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>

                      <div className="d-flex align-items-center gap-1 mb-1 flex-wrap">
                        {getTypeBadge(c.type)}
                        {catMeta && (
                          <span className={`badge border small py-0 px-1 ${catMeta.badgeClass}`} style={{ fontSize: '0.65rem' }}>
                            {catMeta.label}
                          </span>
                        )}
                        {getStatusBadge(c.supportStatus)}
                      </div>

                      <div className="d-flex align-items-center justify-content-between gap-2">
                        <div className="text-truncate small text-muted" style={{ fontSize: '0.8rem' }}>
                          {snippet || 'Conversation opened'}
                        </div>
                        {unread > 0 && (
                          <span className="badge bg-danger rounded-pill px-2 py-1" style={{ fontSize: '0.65rem' }}>
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Main Chat Thread */}
        <section className="flex-grow-1 d-flex flex-column bg-white min-w-0">
          {hasActiveChat ? (
            <>
              {/* Header */}
              <div className="d-flex align-items-center justify-content-between p-3 border-bottom bg-white flex-wrap gap-2">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="d-flex align-items-center justify-content-center bg-primary text-white rounded-circle"
                    style={{ width: '44px', height: '44px' }}
                  >
                    <i className="fa-solid fa-shield-halved" />
                  </div>
                  <div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>
                        {getRecipientLabel(activeConversation)}
                      </span>
                      {getTypeBadge(activeConversation.type)}
                      {activeConversation.category && CATEGORY_MAP[activeConversation.category] && (
                        <span className={`badge border small px-2 py-0 ${CATEGORY_MAP[activeConversation.category].badgeClass}`}>
                          {CATEGORY_MAP[activeConversation.category].label}
                        </span>
                      )}
                      {getStatusBadge(activeConversation.supportStatus)}
                    </div>
                    <div className="small text-muted d-flex align-items-center gap-2 flex-wrap">
                      <span>Subject: {activeConversation.subject || 'Support Assistance'}</span>
                      {activeConversation.student?.email && <span>· Cadet: {activeConversation.student.email}</span>}
                      {activeConversation.instructor?.email && <span>· Faculty: {activeConversation.instructor.email}</span>}
                      {activeConversation.course?.name && <span>· Course: {activeConversation.course.name}</span>}
                      {activeConversation.cohort?.name && <span>· Cohort: {activeConversation.cohort.name}</span>}
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-3 flex-wrap">
                  <div className="d-flex align-items-center gap-2">
                    <label htmlFor="adminStatusSelect" className="small fw-semibold text-muted mb-0">Status:</label>
                    <select
                      id="adminStatusSelect"
                      className="form-select form-select-sm border-secondary-subtle"
                      style={{ width: '135px', fontSize: '0.8rem' }}
                      value={activeConversation.supportStatus || 'open'}
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                      disabled={updatingStatus}
                    >
                      <option value="open">🟢 Open</option>
                      <option value="in_progress">🔵 In Progress</option>
                      <option value="resolved">⚪ Resolved</option>
                    </select>
                  </div>

                  {connected ? (
                    <span className="badge bg-success-subtle text-success border border-success-subtle small px-2 py-1">
                      <i className="fa-solid fa-bolt me-1" />Live
                    </span>
                  ) : (
                    <span className="badge bg-warning-subtle text-warning border border-warning-subtle small px-2 py-1">
                      Connecting
                    </span>
                  )}
                </div>
              </div>

              {/* Feed */}
              <div
                className="flex-grow-1 overflow-auto p-4 d-flex flex-column gap-3 bg-light"
                ref={feedContainerRef}
              >
                {loadingMessages ? (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary mb-2" role="status" />
                    <span className="small">Loading conversation messages...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center my-auto text-muted">
                    <i className="fa-regular fa-comment-dots mb-2" style={{ fontSize: '2.5rem', opacity: 0.3 }} />
                    <h5 className="fw-semibold text-dark">No messages in this thread</h5>
                    <p className="small">Type a reply below to respond in real time.</p>
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isAdminSender = m.senderRole === 'admin';
                    return (
                      <div
                        key={m._id || `msg-${idx}`}
                        className={`d-flex flex-column ${isAdminSender ? 'align-self-end' : 'align-self-start'}`}
                        style={{ maxWidth: '72%' }}
                      >
                        <div
                          className={`p-3 rounded-3 shadow-sm ${
                            isAdminSender ? 'bg-primary text-white' : 'bg-white text-dark border'
                          }`}
                          style={{
                            borderBottomRightRadius: isAdminSender ? '2px' : '12px',
                            borderBottomLeftRadius: !isAdminSender ? '2px' : '12px',
                          }}
                        >
                          <div className="fw-bold mb-1" style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                            {m.senderName || (isAdminSender ? 'EGSA Administrator' : m.senderRole)}
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{m.body}</div>
                          <div
                            className="d-flex align-items-center justify-content-end gap-1 mt-1 small"
                            style={{ fontSize: '0.68rem', opacity: 0.75 }}
                          >
                            <span>
                              {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                            {isAdminSender && (
                              <i className={`fa-solid ${m.read ? 'fa-check-double text-info' : 'fa-check'}`} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className="p-3 border-top bg-white">
                {sendError && (
                  <div className="alert alert-danger py-1 px-2 mb-2 small d-flex align-items-center justify-content-between">
                    <span>{sendError}</span>
                    <button
                      type="button"
                      className="btn-close small"
                      onClick={() => setSendError(null)}
                    />
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="d-flex align-items-center gap-2">
                  <textarea
                    ref={textareaRef}
                    className="form-control"
                    placeholder="Type official administrative reply (Enter to send)..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sending}
                    rows={1}
                    style={{ resize: 'none' }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary d-flex align-items-center justify-content-center px-4"
                    disabled={!draft.trim() || sending}
                    style={{ height: '40px' }}
                  >
                    {sending ? (
                      <div className="spinner-border spinner-border-sm text-white" role="status" />
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane me-2" />
                        <span>Send</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="d-flex flex-column align-items-center justify-content-center h-100 p-4 text-center text-muted">
              <div
                className="d-flex align-items-center justify-content-center bg-primary-subtle text-primary rounded-circle mb-3"
                style={{ width: '80px', height: '80px', fontSize: '2rem' }}
              >
                <i className="fa-solid fa-headset" />
              </div>
              <h4 className="fw-bold text-dark mb-1">EGSA Academy Support Communications</h4>
              <p className="small text-muted" style={{ maxWidth: '420px' }}>
                Select an active Cadet or Faculty support conversation from the sidebar to inspect
                messages and reply in real time.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
