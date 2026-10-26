import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useRealTimeSocket, getActiveToken } from '../../../../shared/socket/socketClient';
import s from './MessagesPage.module.css';

const API_BASE = '/api/messages';

function authHeaders() {
  const token = getActiveToken();
  return {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
  };
}

const CATEGORY_MAP = {
  general: { label: 'General Inquiry', icon: 'fa-circle-info', badgeClass: 'bg-primary-subtle text-primary border-primary-subtle' },
  technical: { label: 'Technical Issue', icon: 'fa-gear', badgeClass: 'bg-warning-subtle text-dark border-warning-subtle' },
  academic: { label: 'Academic Inquiry', icon: 'fa-graduation-cap', badgeClass: 'bg-info-subtle text-info border-info-subtle' },
  complaint: { label: 'Complaint / Report', icon: 'fa-triangle-exclamation', badgeClass: 'bg-danger-subtle text-danger border-danger-subtle' },
};

const STATUS_MAP = {
  open: { label: 'Open', badgeClass: 'bg-success-subtle text-success border-success-subtle' },
  in_progress: { label: 'In Progress', badgeClass: 'bg-primary-subtle text-primary border-primary-subtle' },
  resolved: { label: 'Resolved', badgeClass: 'bg-secondary-subtle text-secondary border-secondary-subtle' },
};

export default function ContactAdminPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [selectedConvoId, setSelectedConvoId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | open | in_progress | resolved

  // Composer
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  // New Support Ticket Modal
  const [showModal, setShowModal] = useState(false);
  const [modalCategory, setModalCategory] = useState('general');
  const [modalSubject, setModalSubject] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [modalError, setModalError] = useState(null);

  const messagesEndRef = useRef(null);
  const feedContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  // Active chat ID: URL param takes precedence, then state, then first item
  const activeChatId = conversationId || selectedConvoId || conversations[0]?._id;

  // Real-time socket hook
  const {
    socket,
    connected,
    joinConversation,
    leaveConversation,
    sendMessage: socketSendMessage,
    markRead: socketMarkRead,
  } = useRealTimeSocket();

  // Load conversations
  const fetchConversations = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingConversations(true);
      const res = await axios.get(`${API_BASE}/conversations?type=student_admin`, authHeaders());
      const list = res.data?.data || [];
      setConversations(list);
      return list;
    } catch (err) {
      console.error('Failed to load student admin conversations:', err);
      return [];
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let active = true;
    const initContact = async () => {
      const list = await fetchConversations();
      if (!active) return;
      if (!conversationId && !selectedConvoId && list.length > 0) {
        setSelectedConvoId(list[0]._id);
      }
    };
    initContact();
    return () => {
      active = false;
    };
  }, [conversationId, selectedConvoId, fetchConversations]);

  // Load active conversation & message history
  useEffect(() => {
    if (!activeChatId) {
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
          axios.get(`${API_BASE}/conversations/${activeChatId}`, authHeaders()),
          axios.get(`${API_BASE}/conversations/${activeChatId}/messages`, authHeaders()),
        ]);

        if (!active) return;

        const convo = convoRes.data?.data || convoRes.data;
        setActiveConversation(convo);

        const msgList = msgsRes.data?.data || [];
        setMessages(msgList);
        shouldAutoScrollRef.current = true;

        // Mark as read
        axios.patch(`${API_BASE}/conversations/${activeChatId}/read`, {}, authHeaders()).catch(() => {});
        socketMarkRead(activeChatId);
        setConversations((prev) =>
          prev.map((c) =>
            c._id === activeChatId ? { ...c, unreadCountStudent: 0 } : c
          )
        );
      } catch (err) {
        if (active) {
          console.error('Failed to load conversation thread:', err);
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
  }, [activeChatId, socketMarkRead]);

  // Real-Time Socket.IO Subscription
  useEffect(() => {
    if (!socket || !activeChatId) return;

    joinConversation(activeChatId, (ack) => {
      if (!ack?.success) {
        console.warn('[Socket.IO] Student join room rejected:', ack?.error);
      }
    });

    const handleNewMessage = (payload) => {
      const { conversationId: msgConvId, message } = payload || {};
      if (msgConvId === activeChatId && message) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          if (feedContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = feedContainerRef.current;
            shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 150;
          }
          return [...prev, message];
        });
        socketMarkRead(activeChatId);
      }
      fetchConversations(true);
    };

    const handleMessageRead = (payload) => {
      if (payload?.conversationId === activeChatId) {
        setMessages((prev) =>
          prev.map((m) => (m.read ? m : { ...m, read: true, readAt: payload.readAt }))
        );
      }
    };

    const handleStatusChanged = (payload) => {
      if (payload?.conversationId === activeChatId) {
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
      leaveConversation(activeChatId);
      socket.off('message:new', handleNewMessage);
      socket.off('message:read', handleMessageRead);
      socket.off('conversation:status_changed', handleStatusChanged);
      socket.off('conversation:update', handleConversationUpdate);
    };
  }, [socket, activeChatId, joinConversation, leaveConversation, socketMarkRead, fetchConversations]);

  // Autoscroll
  useEffect(() => {
    if (shouldAutoScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Send message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const content = draft.trim();
    if (!content || sending || !activeChatId) return;

    setSending(true);
    setSendError(null);

    // If currently resolved, sending a follow-up automatically reopens to in_progress
    if (activeConversation?.supportStatus === 'resolved') {
      setActiveConversation((prev) => ({ ...prev, supportStatus: 'in_progress' }));
    }

    if (socket && connected) {
      socketSendMessage({ conversationId: activeChatId, body: content }, (ack) => {
        setSending(false);
        if (ack?.success && ack?.data) {
          const created = ack.data;
          setMessages((prev) => {
            if (prev.some((m) => m._id === created._id)) return prev;
            return [...prev, created];
          });
          setDraft('');
          shouldAutoScrollRef.current = true;
          fetchConversations(true);
          if (textareaRef.current) textareaRef.current.focus();
        } else {
          setSendError(ack?.error || 'Failed to send message');
        }
      });
    } else {
      try {
        const res = await axios.post(
          `${API_BASE}/conversations/${activeChatId}/messages`,
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
        console.error('Failed to send message via REST:', err);
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

  // Create new ticket / report
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!modalSubject.trim() || !modalMessage.trim()) {
      setModalError('Please provide both a subject and an initial message description.');
      return;
    }

    setCreatingTicket(true);
    setModalError(null);

    try {
      const res = await axios.post(
        `${API_BASE}/conversations/admin-support`,
        {
          category: modalCategory,
          subject: modalSubject.trim(),
          body: modalMessage.trim(),
          forceNew: true,
        },
        authHeaders()
      );

      const created = res.data?.data;
      if (created?._id) {
        setShowModal(false);
        setModalSubject('');
        setModalMessage('');
        setModalCategory('general');
        await fetchConversations(true);
        setSelectedConvoId(created._id);
        navigate(`/student/contact-admin/${created._id}`);
      }
    } catch (err) {
      console.error('Failed to create admin support ticket:', err);
      setModalError(err.response?.data?.message || err.message || 'Failed to dispatch ticket');
    } finally {
      setCreatingTicket(false);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (statusFilter !== 'ALL' && (c.supportStatus || 'open') !== statusFilter) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (c.subject || 'Admin Support').toLowerCase();
    const snippet = (typeof c.lastMessage === 'string' ? c.lastMessage : c.lastMessage?.body || '').toLowerCase();
    return name.includes(q) || snippet.includes(q);
  });

  const hasActiveChat = Boolean(activeChatId && activeConversation);
  const activeCategoryMeta = CATEGORY_MAP[activeConversation?.category || 'general'] || CATEGORY_MAP.general;
  const activeStatusMeta = STATUS_MAP[activeConversation?.supportStatus || 'open'] || STATUS_MAP.open;

  return (
    <div className="container-fluid py-3 px-4">
      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: '#0f172a' }}>
            <i className="fa-solid fa-headset text-primary me-2" />
            Contact Administration & Support Desk
          </h2>
          <p className="text-muted small mb-0">
            Official communications, technical assistance, academic governance inquiries, and cadet reports
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
              <span>Connecting Gateway...</span>
            </span>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm d-flex align-items-center gap-2 shadow-sm"
            onClick={() => setShowModal(true)}
          >
            <i className="fa-solid fa-plus" />
            <span>New Support Inquiry</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className={s.messagingContainer} data-active-chat={hasActiveChat}>
        {/* Sidebar: Conversation List */}
        <aside className={s.sidebar} aria-label="Support Conversations">
          <div className={s.sidebarHeader}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-bold small text-uppercase text-muted" style={{ letterSpacing: '0.04em' }}>
                Support Tickets
              </span>
              <span className="badge bg-light text-dark border small">
                {filteredConversations.length}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline-primary w-100 mb-2 d-flex align-items-center justify-content-center gap-2 py-1"
              style={{ fontSize: '0.82rem', borderRadius: '6px' }}
              onClick={() => setShowModal(true)}
            >
              <i className="fa-solid fa-pen-to-square"></i>
              <span>Create Support Ticket</span>
            </button>

            {/* Status Filter Tabs */}
            <div className="btn-group btn-group-sm w-100 mb-2" role="group">
              <button
                type="button"
                className={`btn py-1 ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: '0.75rem' }}
                onClick={() => setStatusFilter('ALL')}
              >
                All
              </button>
              <button
                type="button"
                className={`btn py-1 ${statusFilter === 'open' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: '0.75rem' }}
                onClick={() => setStatusFilter('open')}
              >
                Open
              </button>
              <button
                type="button"
                className={`btn py-1 ${statusFilter === 'in_progress' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: '0.75rem' }}
                onClick={() => setStatusFilter('in_progress')}
              >
                In Progress
              </button>
              <button
                type="button"
                className={`btn py-1 ${statusFilter === 'resolved' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: '0.75rem' }}
                onClick={() => setStatusFilter('resolved')}
              >
                Resolved
              </button>
            </div>

            <div className={s.searchWrap}>
              <i className={`fa-solid fa-magnifying-glass ${s.searchIcon}`} />
              <input
                type="search"
                className={s.searchInput}
                placeholder="Search inquiries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className={s.conversationList} role="list">
            {loadingConversations ? (
              <div className="p-4 text-center text-muted">
                <div className="spinner-border spinner-border-sm text-primary mb-2" role="status" />
                <div className="small">Loading support history...</div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-muted">
                <i className="fa-solid fa-headset text-muted mb-2" style={{ fontSize: '2rem', opacity: 0.3 }} />
                <div className="small fw-semibold">No tickets found</div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.8rem' }}>
                  Click &quot;New Support Inquiry&quot; to contact EGSA Academy Administration.
                </div>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isActive = c._id === activeChatId;
                const unread = c.unreadCountStudent || 0;
                const snippet = typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.body || '');
                const displayName = c.subject || 'EGSA Academy Administration & Support';
                const catMeta = CATEGORY_MAP[c.category || 'general'] || CATEGORY_MAP.general;
                const statMeta = STATUS_MAP[c.supportStatus || 'open'] || STATUS_MAP.open;

                return (
                  <div
                    key={c._id}
                    role="button"
                    tabIndex={0}
                    className={`${s.conversationItem} ${isActive ? s.active : ''}`}
                    onClick={() => {
                      setSelectedConvoId(c._id);
                      navigate(`/student/contact-admin/${c._id}`);
                    }}
                  >
                    <div className="position-relative">
                      <div
                        className="d-flex align-items-center justify-content-center bg-primary text-white rounded-circle shadow-sm"
                        style={{ width: '42px', height: '42px' }}
                      >
                        <i className={`fa-solid ${catMeta.icon}`} />
                      </div>
                      {unread > 0 && <span className={s.unreadDot} />}
                    </div>

                    <div className={s.itemContent}>
                      <div className={s.itemHeader}>
                        <span className={`${s.itemName} ${unread > 0 ? s.unread : ''}`}>
                          {displayName}
                        </span>
                        <span className={s.itemTime}>
                          {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </div>

                      <div className="d-flex align-items-center gap-1 mb-1">
                        <span className={`badge border small py-0 px-1 ${catMeta.badgeClass}`} style={{ fontSize: '0.7rem' }}>
                          {catMeta.label}
                        </span>
                        <span className={`badge border small py-0 px-1 ${statMeta.badgeClass}`} style={{ fontSize: '0.7rem' }}>
                          {statMeta.label}
                        </span>
                      </div>

                      <div className={s.itemSub}>
                        <span className={`${s.snippet} ${unread > 0 ? s.unread : ''}`}>
                          {snippet || 'New ticket initiated...'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Main: Chat Thread View */}
        <section className={s.chatPanel} aria-label="Support Thread View">
          {hasActiveChat ? (
            <>
              {/* Thread Header */}
              <div className={s.threadHeader}>
                <div className="d-flex align-items-center gap-3">
                  <button
                    type="button"
                    className={s.backButton}
                    onClick={() => navigate('/student/contact-admin')}
                    aria-label="Back to conversations"
                  >
                    <i className="fa-solid fa-arrow-left" />
                  </button>

                  <div
                    className="d-flex align-items-center justify-content-center bg-primary text-white rounded-circle"
                    style={{ width: '44px', height: '44px' }}
                  >
                    <i className={`fa-solid ${activeCategoryMeta.icon}`} />
                  </div>

                  <div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>
                        {activeConversation.subject || 'Support Inquiry'}
                      </span>
                      <span className={`badge border small px-2 py-0 ${activeCategoryMeta.badgeClass}`}>
                        {activeCategoryMeta.label}
                      </span>
                      <span className={`badge border small px-2 py-0 ${activeStatusMeta.badgeClass}`}>
                        <i className="fa-solid fa-circle me-1" style={{ fontSize: '0.5rem' }} />
                        {activeStatusMeta.label}
                      </span>
                    </div>
                    <div className={s.headerSubtitle}>
                      <span className={s.onlinePulse} />
                      <span>EGSA Administration Desk</span>
                      <span>· admissions@egsa.gov.eg</span>
                      {activeConversation.createdAt && (
                        <span>· Opened {new Date(activeConversation.createdAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
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

              {/* Resolved Reopening Notice Banner */}
              {activeConversation.supportStatus === 'resolved' && (
                <div className="bg-light border-bottom px-3 py-2 text-center text-muted small d-flex align-items-center justify-content-center gap-2">
                  <i className="fa-solid fa-circle-info text-info" />
                  <span>
                    This inquiry is marked as <strong>Resolved</strong>. Sending a follow-up reply below will automatically reopen it.
                  </span>
                </div>
              )}

              {/* Message Feed */}
              <div className={s.messageFeed} ref={feedContainerRef} role="log" aria-live="polite">
                {loadingMessages ? (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary mb-2" role="status" />
                    <span className="small">Loading ticket history...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className={s.emptyFeed}>
                    <i className="fa-regular fa-comment-dots text-muted mb-2" style={{ fontSize: '2.5rem', opacity: 0.3 }} />
                    <h5 className="fw-semibold text-dark mb-1">No messages exchanged yet</h5>
                    <p className="small text-muted mb-0">Send a message below to communicate with Academy Administration.</p>
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isStudent = m.senderRole === 'student';
                    return (
                      <div
                        key={m._id || `msg-${idx}`}
                        className={`${s.messageRow} ${isStudent ? s.sent : s.received}`}
                      >
                        <div className={s.messageBubble}>
                          <div className={s.messageSenderRole}>
                            {m.senderName || (isStudent ? 'You (Cadet)' : 'EGSA Administrator')}
                          </div>
                          <div className={s.messageText}>{m.body}</div>
                          <div className={s.messageMeta}>
                            <span>
                              {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                            {isStudent && (
                              <span className={s.readIndicator} title={m.read ? 'Read' : 'Delivered'}>
                                <i className={`fa-solid ${m.read ? 'fa-check-double text-info' : 'fa-check text-muted'}`} />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className={s.composer}>
                {sendError && (
                  <div className="alert alert-danger py-1 px-2 mb-2 small d-flex align-items-center justify-content-between">
                    <span>{sendError}</span>
                    <button
                      type="button"
                      className="btn-close small"
                      onClick={() => setSendError(null)}
                      aria-label="Dismiss error"
                    />
                  </div>
                )}
                <form onSubmit={handleSendMessage} className={s.composerForm}>
                  <textarea
                    ref={textareaRef}
                    className={s.textarea}
                    placeholder="Type your reply to Academy Administration (Enter to send)..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sending}
                    rows={1}
                    aria-label="Message draft"
                  />
                  <button
                    type="submit"
                    className={s.sendButton}
                    disabled={!draft.trim() || sending}
                    aria-label="Send message"
                  >
                    {sending ? (
                      <div className="spinner-border spinner-border-sm text-white" role="status" />
                    ) : (
                      <i className="fa-solid fa-paper-plane" />
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className={s.noActiveChat}>
              <div className={s.noActiveCard}>
                <div className={s.noActiveIconWrap}>
                  <i className="fa-solid fa-headset" />
                </div>
                <h4 className="fw-bold text-dark mb-2">Academy Administration Support</h4>
                <p className="text-muted small mb-3">
                  Reach out directly to EGSA Academy Administration for admissions, registration,
                  technical troubleshooting, academic questions, or formal reports.
                </p>
                <div className="d-flex flex-wrap gap-2 justify-content-center">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm d-flex align-items-center gap-2"
                    onClick={() => setShowModal(true)}
                  >
                    <i className="fa-solid fa-plus" />
                    <span>Create Support Ticket</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* New Support Inquiry Modal */}
      {showModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 1050 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-3">
              <div className="modal-header border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="fa-solid fa-headset text-primary" />
                  <span>New Support Inquiry or Report</span>
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                  disabled={creatingTicket}
                  aria-label="Close"
                />
              </div>

              <form onSubmit={handleCreateTicket}>
                <div className="modal-body p-4">
                  {modalError && (
                    <div className="alert alert-danger py-2 px-3 mb-3 small d-flex align-items-center justify-content-between">
                      <span>{modalError}</span>
                      <button
                        type="button"
                        className="btn-close small"
                        onClick={() => setModalError(null)}
                        aria-label="Dismiss"
                      />
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark">Inquiry Category</label>
                    <div className="row g-2">
                      {Object.entries(CATEGORY_MAP).map(([catKey, catVal]) => {
                        const isSelected = modalCategory === catKey;
                        return (
                          <div className="col-6" key={catKey}>
                            <button
                              type="button"
                              className={`btn btn-sm w-100 text-start d-flex align-items-center gap-2 py-2 px-3 border ${
                                isSelected ? 'btn-primary text-white' : 'btn-light text-dark'
                              }`}
                              style={{ borderRadius: '8px' }}
                              onClick={() => setModalCategory(catKey)}
                            >
                              <i className={`fa-solid ${catVal.icon}`} />
                              <span style={{ fontSize: '0.82rem' }}>{catVal.label}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="ticketSubject" className="form-label small fw-semibold text-dark">
                      Subject
                    </label>
                    <input
                      id="ticketSubject"
                      type="text"
                      className="form-control"
                      placeholder="e.g., Question regarding satellite orbital mechanics session"
                      value={modalSubject}
                      onChange={(e) => setModalSubject(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="ticketMessage" className="form-label small fw-semibold text-dark">
                      Detailed Description
                    </label>
                    <textarea
                      id="ticketMessage"
                      className="form-control"
                      rows={4}
                      placeholder="Explain your inquiry, technical issue, or report in detail..."
                      value={modalMessage}
                      onChange={(e) => setModalMessage(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer border-top py-2 px-4 bg-light d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowModal(false)}
                    disabled={creatingTicket}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm d-flex align-items-center gap-2"
                    disabled={creatingTicket || !modalSubject.trim() || !modalMessage.trim()}
                  >
                    {creatingTicket ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" />
                        <span>Submitting Ticket...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane" />
                        <span>Submit Ticket</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
