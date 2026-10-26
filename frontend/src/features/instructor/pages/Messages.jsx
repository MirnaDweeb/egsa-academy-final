import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { Avatar, PageHeader } from '../components/ui.jsx';
import { instructorApi } from '../services/instructor.js';
import { useI18n } from '../i18n/index.jsx';
import { useRealTimeSocket } from '../../../shared/socket/socketClient';
import s from './messages.module.css';

export default function MessagesPage() {
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, fmtDate, fmtDateTime, lang } = useI18n();

  const queryStudentId = searchParams.get('studentId');
  const queryCohortId = searchParams.get('cohortId');

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
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

  // Real-time Socket.IO Hook
  const {
    socket,
    connected,
    connectionState,
    joinConversation,
    leaveConversation,
    sendMessage: socketSendMessage,
    markRead: socketMarkRead,
  } = useRealTimeSocket();

  // Load conversations list
  const fetchConversations = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingConversations(true);
      const res = await instructorApi.conversations({ type: 'direct' });
      const list = Array.isArray(res) ? res : (res?.data || []);
      setConversations(list);
      return list;
    } catch (err) {
      console.error('Failed to load conversations:', err);
      return [];
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Handle direct message initiation via ?studentId=...&cohortId=...
  useEffect(() => {
    if (!queryStudentId) return;

    let active = true;
    const initDirectChat = async () => {
      try {
        setLoadingConversations(true);
        const res = await instructorApi.createConversation({
          studentId: queryStudentId,
          cohortId: queryCohortId || undefined,
        });
        const convo = res?.data || res;
        if (active && convo && convo._id) {
          await fetchConversations(true);
          navigate(`/instructor/messages/${convo._id}`, { replace: true });
        }
      } catch (err) {
        console.error('Failed to initialize conversation with student:', err);
      } finally {
        if (active) setLoadingConversations(false);
      }
    };

    initDirectChat();
    return () => {
      active = false;
    };
  }, [queryStudentId, queryCohortId, fetchConversations, navigate]);

  // Load active conversation & messages when conversationId changes
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
          instructorApi.conversation(conversationId),
          instructorApi.messages(conversationId, { limit: 100 }),
        ]);

        if (!active) return;

        const convo = convoRes?.data || convoRes;
        setActiveConversation(convo);

        const msgList = Array.isArray(msgsRes) ? msgsRes : (msgsRes?.data || []);
        setMessages(msgList);
        shouldAutoScrollRef.current = true;

        // Mark as read
        if (convo?.unreadCountInstructor > 0) {
          instructorApi.markMessagesRead(conversationId).catch(() => {});
          socketMarkRead(conversationId);
          setConversations((prev) =>
            prev.map((c) =>
              c._id === conversationId ? { ...c, unreadCountInstructor: 0 } : c
            )
          );
        }
      } catch (err) {
        if (active) {
          console.error('Failed to load active conversation:', err);
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

  // Real-Time Socket.IO Subscription for active conversation
  useEffect(() => {
    if (!socket || !conversationId) return;

    joinConversation(conversationId, (ack) => {
      if (!ack?.success) {
        console.warn('[Socket.IO] Join conversation rejected:', ack?.error);
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

    const handleConversationUpdate = () => {
      fetchConversations(true);
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:read', handleMessageRead);
    socket.on('conversation:update', handleConversationUpdate);

    return () => {
      leaveConversation(conversationId);
      socket.off('message:new', handleNewMessage);
      socket.off('message:read', handleMessageRead);
      socket.off('conversation:update', handleConversationUpdate);
    };
  }, [socket, conversationId, joinConversation, leaveConversation, socketMarkRead, fetchConversations]);

  // Autoscroll logic
  useEffect(() => {
    if (shouldAutoScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Send message via real-time Socket with REST fallback
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
          const createdMessage = ack.data;
          setMessages((prev) => {
            if (prev.some((m) => m._id === createdMessage._id)) return prev;
            return [...prev, createdMessage];
          });
          setDraft('');
          shouldAutoScrollRef.current = true;
          fetchConversations(true);
          if (textareaRef.current) textareaRef.current.focus();
        } else {
          setSendError(ack?.error || t('messages.failedToSend'));
        }
      });
    } else {
      try {
        const res = await instructorApi.sendMessage(conversationId, { body: content });
        const createdMessage = res?.data || res;

        if (createdMessage && createdMessage._id) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === createdMessage._id)) return prev;
            return [...prev, createdMessage];
          });
        }
        setDraft('');
        shouldAutoScrollRef.current = true;
        fetchConversations(true);
        if (textareaRef.current) textareaRef.current.focus();
      } catch (err) {
        console.error('Failed to send message:', err);
        setSendError(err.message || t('messages.failedToSend'));
      } finally {
        setSending(false);
      }
    }
  };

  // Contact Admin Support
  const handleContactAdmin = async () => {
    try {
      const res = await instructorApi.contactAdmin({ subject: 'Faculty Administration Support' });
      const convo = res?.data || res;
      if (convo?._id) {
        await fetchConversations(true);
        navigate(`/instructor/messages/${convo._id}`);
      }
    } catch (err) {
      console.error('Failed to contact admin support:', err);
    }
  };

  // Keyboard shortcut: Enter sends, Shift+Enter new line
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (c.student?.name || c.subject || '').toLowerCase();
    const email = (c.student?.email || '').toLowerCase();
    const cohort = (c.cohort?.name || '').toLowerCase();
    return name.includes(q) || email.includes(q) || cohort.includes(q);
  });

  // Group messages by date
  const groupMessagesByDate = (msgs) => {
    const groups = [];
    let currentDate = null;

    msgs.forEach((msg) => {
      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ type: 'date', date: msg.createdAt });
      }
      groups.push({ type: 'message', data: msg });
    });

    return groups;
  };

  const hasActiveChat = Boolean(conversationId && activeConversation);
  const isAdminSupport = activeConversation?.type === 'instructor_admin';

  return (
    <>
      <PageHeader
        eyebrow={t('navGroup.learners')}
        title={t('messages.title')}
        subtitle={t('messages.subtitle')}
      />

      <div className={s.messagingContainer} data-active-chat={hasActiveChat}>
        {/* Sidebar: Conversation List */}
        <aside className={s.sidebar} aria-label="Cadet Conversations">
          <div className={s.sidebarHeader}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold small text-uppercase text-muted" style={{ letterSpacing: '0.04em' }}>
                  {t('messages.title')}
                </span>
                {connected ? (
                  <span className="badge bg-success-subtle text-success border border-success-subtle small px-2 py-1" style={{ fontSize: '0.7rem' }}>
                    <i className="fa-solid fa-bolt me-1"></i>Real-Time
                  </span>
                ) : (
                  <span className="badge bg-warning-subtle text-warning border border-warning-subtle small px-2 py-1" style={{ fontSize: '0.7rem' }}>
                    Connecting...
                  </span>
                )}
              </div>
              <span className="badge bg-light text-dark border mono small">
                {conversations.length}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline-primary w-100 mb-2 d-flex align-items-center justify-content-center gap-2 py-1"
              style={{ fontSize: '0.8rem', borderRadius: '6px' }}
              onClick={handleContactAdmin}
            >
              <i className="fa-solid fa-headset text-primary"></i>
              <span>Contact Academy Support</span>
            </button>

            <div className={s.searchWrap}>
              <i className={`fa-solid fa-magnifying-glass ${s.searchIcon}`} />
              <input
                type="search"
                className={s.searchInput}
                placeholder={t('messages.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t('common.search')}
              />
            </div>
          </div>

          <div className={s.conversationList} role="list">
            {loadingConversations ? (
              <div className="p-4 text-center text-muted">
                <Spinner animation="border" size="sm" variant="primary" />
                <div className="small mt-2">{t('common.loading')}</div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-muted">
                <i className="fa-solid fa-comments text-muted mb-2" style={{ fontSize: '1.8rem', opacity: 0.4 }} />
                <div className="small fw-semibold">{t('messages.empty')}</div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.78rem' }}>
                  {t('messages.emptySub')}
                </div>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isActive = c._id === conversationId;
                const unread = c.unreadCountInstructor || 0;
                const snippet = typeof c.lastMessage === 'string'
                  ? c.lastMessage
                  : (c.lastMessage?.body || '');
                const isSupportConvo = c.type === 'instructor_admin';

                return (
                  <div
                    key={c._id}
                    role="button"
                    tabIndex={0}
                    className={`${s.conversationItem} ${isActive ? s.active : ''}`}
                    onClick={() => navigate(`/instructor/messages/${c._id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/instructor/messages/${c._id}`);
                      }
                    }}
                    aria-label={`Conversation with ${isSupportConvo ? 'Academy Support' : (c.student?.name || 'Cadet')}`}
                  >
                    <div className="position-relative">
                      {isSupportConvo ? (
                        <div
                          className="d-flex align-items-center justify-content-center bg-primary text-white rounded-circle"
                          style={{ width: '40px', height: '40px' }}
                        >
                          <i className="fa-solid fa-shield-halved" />
                        </div>
                      ) : (
                        <Avatar name={c.student?.name || 'C'} size={40} />
                      )}
                      {unread > 0 && <span className={s.unreadDot} />}
                    </div>

                    <div className={s.itemContent}>
                      <div className={s.itemHeader}>
                        <span className={`${s.itemName} ${unread > 0 ? s.unread : ''}`}>
                          {isSupportConvo ? (c.subject || 'Academy Administration') : (c.student?.name || t('common.unknown'))}
                        </span>
                        <span className={s.itemTime}>
                          {c.lastMessageAt ? fmtDateTime(c.lastMessageAt) : ''}
                        </span>
                      </div>

                      <div className={s.itemSub}>
                        {isSupportConvo ? (
                          <span className="badge bg-secondary-subtle text-secondary small py-0 px-1 me-1">Support</span>
                        ) : c.cohort?.name ? (
                          <span className={s.cohortBadge}>{c.cohort.name}</span>
                        ) : null}
                        <span className={`${s.snippet} ${unread > 0 ? s.unread : ''}`}>
                          {snippet || t('messages.noMessagesYet')}
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
                    onClick={() => navigate('/instructor/messages')}
                    aria-label={t('common.back')}
                  >
                    <i className="fa-solid fa-arrow-left" />
                  </button>

                  {isAdminSupport ? (
                    <div
                      className="d-flex align-items-center justify-content-center bg-primary text-white rounded-circle"
                      style={{ width: '42px', height: '42px' }}
                    >
                      <i className="fa-solid fa-shield-halved" />
                    </div>
                  ) : (
                    <Avatar name={activeConversation.student?.name || 'Cadet'} size={42} />
                  )}

                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold text-dark">
                        {isAdminSupport ? 'EGSA Academy Administration & Support' : activeConversation.student?.name}
                      </span>
                      <span className={s.cadetBadge}>
                        {isAdminSupport ? 'Admin Support' : t('messages.cadet')}
                      </span>
                    </div>
                    <div className={s.headerSubtitle}>
                      <span className={s.onlinePulse} />
                      <span>{isAdminSupport ? 'support@egsa.gov.eg' : activeConversation.student?.email}</span>
                      {activeConversation.cohort?.name && (
                        <span>· {activeConversation.cohort.name}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  {connected ? (
                    <span className="badge bg-success-subtle text-success border border-success-subtle small px-2 py-1">
                      <i className="fa-solid fa-bolt me-1"></i>Live
                    </span>
                  ) : (
                    <span className="badge bg-warning-subtle text-warning border border-warning-subtle small px-2 py-1">
                      Connecting
                    </span>
                  )}
                </div>
              </div>

              {/* Message Feed */}
              <div
                className={s.messageFeed}
                ref={feedContainerRef}
                role="log"
                aria-live="polite"
              >
                {loadingMessages ? (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                    <Spinner animation="border" size="sm" variant="primary" />
                    <span className="small mt-2">{t('common.loading')}</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className={s.emptyFeed}>
                    <i className={`fa-regular fa-comment-dots ${s.emptyFeedIcon}`} />
                    <h5 className="fw-semibold text-dark mb-1">{t('messages.noMessagesYet')}</h5>
                    <p className="small text-muted mb-0">{t('messages.subtitle')}</p>
                  </div>
                ) : (
                  groupMessagesByDate(messages).map((item, idx) => {
                    if (item.type === 'date') {
                      return (
                        <div key={`date-${idx}`} className={s.dateSeparator}>
                          <span>{fmtDate(item.date)}</span>
                        </div>
                      );
                    }

                    const m = item.data;
                    if (!m) return null;
                    const isInstructor = m.senderRole === 'instructor';

                    return (
                      <div
                        key={m._id || `msg-${idx}`}
                        className={`${s.messageRow} ${isInstructor ? s.sent : s.received}`}
                      >
                        <div className={s.messageBubble}>
                          <div className={s.messageSenderRole}>
                            {m.senderName || (isInstructor ? 'You (Instructor)' : (m.senderRole === 'admin' ? 'Academy Admin' : 'Cadet'))}
                          </div>
                          <div className={s.messageText}>{m.body}</div>
                          <div className={s.messageMeta}>
                            <span>{fmtDateTime(m.createdAt)}</span>
                            {isInstructor && (
                              <span className={s.readIndicator} title={m.read ? t('messages.read') : t('messages.sent')}>
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
                    placeholder={t('messages.typePlaceholder')}
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
                    aria-label={t('messages.send')}
                  >
                    {sending ? (
                      <Spinner animation="border" size="sm" />
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
                  <i className="fa-solid fa-satellite-dish" />
                </div>
                <h4 className="fw-bold text-dark mb-2">{t('messages.title')}</h4>
                <p className="text-muted small mb-3">
                  {t('messages.subtitle')}
                </p>
                <div className="d-flex flex-wrap gap-2 justify-content-center">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary d-flex align-items-center gap-2"
                    onClick={handleContactAdmin}
                  >
                    <i className="fa-solid fa-headset"></i> Contact Academy Administration
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
