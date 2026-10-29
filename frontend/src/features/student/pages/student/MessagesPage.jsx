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

function formatDateSeparator(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return 'Today';
  }
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MessagesPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [selectedConvoId, setSelectedConvoId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const messagesEndRef = useRef(null);
  const feedContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  // Active chat ID: URL param takes precedence, then selected state, then first item
  const activeChatId = conversationId || selectedConvoId || conversations[0]?._id;

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

  // Load conversations
  const fetchConversations = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingConversations(true);
      const res = await axios.get(`${API_BASE}/conversations`, authHeaders());
      const list = (res.data?.data || []).filter((c) => c.type === 'student_admin');
      setConversations(list);
      return list;
    } catch (err) {
      console.error('Failed to load student contact conversations:', err);
      return [];
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  }, []);

  // Initialize and auto-open Admin Support conversation without forcing URL change away from /student/contact
  useEffect(() => {
    let active = true;
    const initContact = async () => {
      const list = await fetchConversations();
      if (!active) return;
      if (!conversationId && !selectedConvoId) {
        if (list.length > 0) {
          setSelectedConvoId(list[0]._id);
        } else {
          try {
            const res = await axios.post(
              `${API_BASE}/conversations/admin-support`,
              { subject: 'EGSA Cadet Support & Admissions Inquiry' },
              authHeaders()
            );
            const created = res.data?.data;
            if (active && created?._id) {
              await fetchConversations(true);
              setSelectedConvoId(created._id);
            }
          } catch (err) {
            console.error('Failed to auto-create admin support conversation:', err);
          }
        }
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

  // Real-Time Socket.IO Subscription for active chat
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

    const handleConversationUpdate = () => {
      fetchConversations(true);
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:read', handleMessageRead);
    socket.on('conversation:update', handleConversationUpdate);

    return () => {
      leaveConversation(activeChatId);
      socket.off('message:new', handleNewMessage);
      socket.off('message:read', handleMessageRead);
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

  // Keyboard shortcut
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Start chat with Admin Support
  const handleStartAdminSupport = async () => {
    try {
      const res = await axios.post(
        `${API_BASE}/conversations/admin-support`,
        { subject: 'EGSA Cadet Support & Admissions Inquiry' },
        authHeaders()
      );
      const convo = res.data?.data;
      if (convo?._id) {
        await fetchConversations(true);
        setSelectedConvoId(convo._id);
      }
    } catch (err) {
      console.error('Failed to connect with Admin Support:', err);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (c.subject || 'Admin Support').toLowerCase();
    const snippet = (typeof c.lastMessage === 'string' ? c.lastMessage : c.lastMessage?.body || '').toLowerCase();
    return name.includes(q) || snippet.includes(q);
  });

  const hasActiveChat = Boolean(activeChatId && activeConversation);
  const isSupportChat = true;

  return (
    <div className="container-fluid py-3 px-4">
      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: '#0f172a' }}>
            <i className="fa-solid fa-envelope text-primary me-2" />
            Contact Administration
          </h2>
          <p className="text-muted small mb-0">
            Official direct inquiries and assistance from EGSA Academy Administration & Support Desk
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          {connected ? (
            <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 d-flex align-items-center gap-2">
              <i className="fa-solid fa-bolt" />
              <span>Real-Time Connected</span>
            </span>
          ) : (
            <span className="badge bg-warning-subtle text-warning border border-warning-subtle px-3 py-2 d-flex align-items-center gap-2">
              <i className="fa-solid fa-circle-notch fa-spin" />
              <span>Connecting to Gateway...</span>
            </span>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm d-flex align-items-center gap-2"
            onClick={handleStartAdminSupport}
          >
            <i className="fa-solid fa-headset" />
            <span>Contact Support Desk</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className={s.messagingContainer} data-active-chat={hasActiveChat}>
        {/* Sidebar: Conversation List */}
        <aside className={s.sidebar} aria-label="Student Conversations">
          <div className={s.sidebarHeader}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-bold small text-uppercase text-muted" style={{ letterSpacing: '0.04em' }}>
                Conversations
              </span>
              <span className="badge bg-light text-dark border small">
                {conversations.length}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline-primary w-100 mb-2 d-flex align-items-center justify-content-center gap-2 py-1"
              style={{ fontSize: '0.82rem', borderRadius: '6px' }}
              onClick={handleStartAdminSupport}
            >
              <i className="fa-solid fa-shield-halved text-primary"></i>
              <span>Contact Academy Support Desk</span>
            </button>

            <div className={s.searchWrap}>
              <i className={`fa-solid fa-magnifying-glass ${s.searchIcon}`} />
              <input
                type="search"
                className={s.searchInput}
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className={s.conversationList} role="list">
            {loadingConversations ? (
              <div className="p-4 text-center text-muted">
                <div className="spinner-border spinner-border-sm text-primary mb-2" role="status" />
                <div className="small">Loading communications...</div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-muted">
                <i className="fa-solid fa-comments text-muted mb-2" style={{ fontSize: '2rem', opacity: 0.3 }} />
                <div className="small fw-semibold">No active inquiries</div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.8rem' }}>
                  Click &quot;Contact Support Desk&quot; above to reach EGSA Academy Administration.
                </div>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isActive = c._id === activeChatId;
                const unread = c.unreadCountStudent || 0;
                const snippet = typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.body || '');
                const displayName = c.subject || 'EGSA Academy Administration & Support';

                return (
                  <div
                    key={c._id}
                    role="button"
                    tabIndex={0}
                    className={`${s.conversationItem} ${isActive ? s.active : ''}`}
                    onClick={() => {
                      setSelectedConvoId(c._id);
                      navigate(`/student/contact/${c._id}`);
                    }}
                  >
                    <div className="position-relative">
                      <div
                        className="d-flex align-items-center justify-content-center bg-primary text-white rounded-circle shadow-sm"
                        style={{ width: '42px', height: '42px' }}
                      >
                        <i className="fa-solid fa-shield-halved" />
                      </div>
                      {unread > 0 && <span className={s.unreadDot} />}
                    </div>

                    <div className={s.itemContent}>
                      <div className={s.itemHeader}>
                        <span className={`${s.itemName} ${unread > 0 ? s.unread : ''}`}>
                          {displayName}
                        </span>
                        <span className={s.itemTime}>
                          {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>

                      <div className={s.itemSub}>
                        <span className="badge bg-primary-subtle text-primary small py-0 px-1 me-1">Admin Support</span>
                        <span className={`${s.snippet} ${unread > 0 ? s.unread : ''}`}>
                          {snippet || 'Start conversation...'}
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
        <section className={s.chatPanel} aria-label="Conversation Thread">
          {hasActiveChat ? (
            <>
              {/* Thread Header */}
              <div className={s.threadHeader}>
                <div className="d-flex align-items-center gap-3">
                  <button
                    type="button"
                    className={s.backButton}
                    onClick={() => navigate('/student/contact')}
                    aria-label="Back to conversations"
                  >
                    <i className="fa-solid fa-arrow-left" />
                  </button>

                  <div
                    className="d-flex align-items-center justify-content-center bg-primary text-white rounded-circle"
                    style={{ width: '44px', height: '44px' }}
                  >
                    <i className="fa-solid fa-shield-halved" />
                  </div>

                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold text-dark" style={{ fontSize: '1rem' }}>
                        EGSA Academy Administration & Support
                      </span>
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle small px-2 py-0">
                        Official Desk
                      </span>
                    </div>
                    <div className={s.headerSubtitle}>
                      <span className={s.onlinePulse} />
                      <span>admissions@egsa.gov.eg</span>
                      <span>· Student Governance & Admissions</span>
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  {connected ? (
                    <span className="badge bg-success-subtle text-success border border-success-subtle small px-2 py-1">
                      <i className="fa-solid fa-bolt me-1" />Live Real-Time
                    </span>
                  ) : (
                    <span className="badge bg-warning-subtle text-warning border border-warning-subtle small px-2 py-1">
                      Connecting
                    </span>
                  )}
                </div>
              </div>

              {/* Message Feed */}
              <div className={s.messageFeed} ref={feedContainerRef} role="log" aria-live="polite">
                {loadingMessages ? (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary mb-2" role="status" />
                    <span className="small">Loading message history...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className={s.emptyFeed}>
                    <i className="fa-regular fa-comment-dots text-muted mb-2" style={{ fontSize: '2.5rem', opacity: 0.3 }} />
                    <h5 className="fw-semibold text-dark mb-1">No messages exchanged yet</h5>
                    <p className="small text-muted mb-0">Type below to begin real-time communication with Academy Administration.</p>
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isStudent = m.senderRole === 'student';
                    const showDateSep =
                      idx === 0 ||
                      new Date(m.createdAt).toDateString() !== new Date(messages[idx - 1].createdAt).toDateString();

                    return (
                      <React.Fragment key={m._id || `msg-${idx}`}>
                        {showDateSep && (
                          <div className={s.dateSeparator}>
                            <span>{formatDateSeparator(m.createdAt)}</span>
                          </div>
                        )}
                        <div
                          className={`${s.messageRow} ${isStudent ? s.sent : s.received}`}
                        >
                          <div className={s.messageBubble}>
                            <div className={s.messageSenderRole}>
                              {isStudent ? (
                                <>
                                  <span>You (Cadet)</span>
                                  <i className="fa-solid fa-user-astronaut ms-1" />
                                </>
                              ) : (
                                <>
                                  <i className="fa-solid fa-shield-halved me-1 text-primary" />
                                  <span>{m.senderName || 'EGSA Administrator'}</span>
                                </>
                              )}
                            </div>
                            <div className={s.messageText}>{m.body}</div>
                            <div className={s.messageMeta}>
                              <span>
                                {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                              {isStudent && (
                                <span className={s.readIndicator} title={m.read ? 'Read by Administrator' : 'Delivered'}>
                                  <i className={`fa-solid ${m.read ? 'fa-check-double text-info' : 'fa-check text-muted'}`} />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
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
                    placeholder="Type your message to Academy Administration (Enter to send)..."
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
                <h4 className="fw-bold text-dark mb-2">Contact Academy Administration</h4>
                <p className="text-muted small mb-3">
                  Reach out directly to EGSA Academy Administration for admissions, registration,
                  cohort enrollment, and student assistance.
                </p>
                <div className="d-flex flex-wrap gap-2 justify-content-center">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm d-flex align-items-center gap-2"
                    onClick={handleStartAdminSupport}
                  >
                    <i className="fa-solid fa-headset" />
                    <span>Open Administration Channel</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
