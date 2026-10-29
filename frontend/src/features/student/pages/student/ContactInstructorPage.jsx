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

export default function ContactInstructorPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [availableInstructors, setAvailableInstructors] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [selectedConvoId, setSelectedConvoId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Composer
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  // Modal to initiate conversation with eligible instructor
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

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

  // Load eligible instructors for this student
  const fetchContacts = useCallback(async () => {
    try {
      setLoadingContacts(true);
      const res = await axios.get(`${API_BASE}/contacts`, authHeaders());
      const instructors = res.data?.data?.instructors || [];
      setAvailableInstructors(instructors);
      return instructors;
    } catch (err) {
      console.error('Failed to load eligible instructors:', err);
      return [];
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  // Load direct instructor conversations
  const fetchConversations = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingConversations(true);
      const res = await axios.get(`${API_BASE}/conversations?type=direct`, authHeaders());
      const list = res.data?.data || [];
      setConversations(list);
      return list;
    } catch (err) {
      console.error('Failed to load student instructor conversations:', err);
      return [];
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let active = true;
    const init = async () => {
      const [instList, convList] = await Promise.all([fetchContacts(), fetchConversations()]);
      if (!active) return;
      if (!conversationId && !selectedConvoId && convList.length > 0) {
        setSelectedConvoId(convList[0]._id);
      }
    };
    init();
    return () => {
      active = false;
    };
  }, [conversationId, selectedConvoId, fetchContacts, fetchConversations]);

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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Start or open conversation with an eligible instructor
  const handleSelectInstructor = async (instructor) => {
    try {
      setStartingChat(true);
      const res = await axios.post(
        `${API_BASE}/conversations/instructor`,
        {
          instructorId: instructor._id,
          cohortId: instructor.cohortId,
          subject: `${instructor.courseName || 'Course'} Academic Inquiry`,
        },
        authHeaders()
      );

      const conv = res.data?.data;
      if (conv?._id) {
        setShowSelectModal(false);
        await fetchConversations(true);
        setSelectedConvoId(conv._id);
        navigate(`/student/contact-instructor/${conv._id}`);
      }
    } catch (err) {
      console.error('Failed to initiate instructor conversation:', err);
      alert(err.response?.data?.message || 'Failed to start conversation with instructor.');
    } finally {
      setStartingChat(false);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const instName = (c.instructor?.name || '').toLowerCase();
    const courseName = (c.course?.name || '').toLowerCase();
    const cohortName = (c.cohort?.name || '').toLowerCase();
    const subj = (c.subject || '').toLowerCase();
    const snippet = (typeof c.lastMessage === 'string' ? c.lastMessage : c.lastMessage?.body || '').toLowerCase();
    return instName.includes(q) || courseName.includes(q) || cohortName.includes(q) || subj.includes(q) || snippet.includes(q);
  });

  const hasActiveChat = Boolean(activeChatId && activeConversation);
  const activeInstructor = activeConversation?.instructor;
  const activeCourse = activeConversation?.course;
  const activeCohort = activeConversation?.cohort;

  return (
    <div className="container-fluid py-3 px-4">
      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: '#0f172a' }}>
            <i className="fa-solid fa-chalkboard-user text-primary me-2" />
            Contact My Instructor
          </h2>
          <p className="text-muted small mb-0">
            Direct academic consultations and flight-deck inquiries with assigned course faculty
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
            onClick={() => setShowSelectModal(true)}
            disabled={loadingContacts || availableInstructors.length === 0}
          >
            <i className="fa-solid fa-comment-medical" />
            <span>Message Instructor</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className={s.messagingContainer} data-active-chat={hasActiveChat}>
        {/* Sidebar: Conversation List */}
        <aside className={s.sidebar} aria-label="Faculty Conversations">
          <div className={s.sidebarHeader}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-bold small text-uppercase text-muted" style={{ letterSpacing: '0.04em' }}>
                Assigned Instructors
              </span>
              <span className="badge bg-light text-dark border small">
                {filteredConversations.length}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline-primary w-100 mb-2 d-flex align-items-center justify-content-center gap-2 py-1"
              style={{ fontSize: '0.82rem', borderRadius: '6px' }}
              onClick={() => setShowSelectModal(true)}
              disabled={loadingContacts || availableInstructors.length === 0}
            >
              <i className="fa-solid fa-chalkboard-user"></i>
              <span>Select Assigned Instructor</span>
            </button>

            <div className={s.searchWrap}>
              <i className={`fa-solid fa-magnifying-glass ${s.searchIcon}`} />
              <input
                type="search"
                className={s.searchInput}
                placeholder="Search instructor or course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className={s.conversationList} role="list">
            {loadingConversations ? (
              <div className="p-4 text-center text-muted">
                <div className="spinner-border spinner-border-sm text-primary mb-2" role="status" />
                <div className="small">Loading conversations...</div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-muted">
                <i className="fa-solid fa-chalkboard-user text-muted mb-2" style={{ fontSize: '2rem', opacity: 0.3 }} />
                <div className="small fw-semibold">No direct conversations yet</div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.8rem' }}>
                  {availableInstructors.length > 0
                    ? 'Click "Select Assigned Instructor" above to start communicating with your instructor.'
                    : 'You do not currently have any active course enrollments with assigned instructors.'}
                </div>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isActive = c._id === activeChatId;
                const unread = c.unreadCountStudent || 0;
                const snippet = typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.body || '');
                const instName = c.instructor?.name || 'Faculty Instructor';
                const courseLabel = c.course?.name || c.cohort?.name || 'Assigned Course';

                return (
                  <div
                    key={c._id}
                    role="button"
                    tabIndex={0}
                    className={`${s.conversationItem} ${isActive ? s.active : ''}`}
                    onClick={() => {
                      setSelectedConvoId(c._id);
                      navigate(`/student/contact-instructor/${c._id}`);
                    }}
                  >
                    <div className="position-relative">
                      <div
                        className="d-flex align-items-center justify-content-center bg-dark text-white rounded-circle shadow-sm"
                        style={{ width: '42px', height: '42px' }}
                      >
                        <i className="fa-solid fa-chalkboard-user text-info" />
                      </div>
                      {unread > 0 && <span className={s.unreadDot} />}
                    </div>

                    <div className={s.itemContent}>
                      <div className={s.itemHeader}>
                        <span className={`${s.itemName} ${unread > 0 ? s.unread : ''}`}>
                          {instName}
                        </span>
                        <span className={s.itemTime}>
                          {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </div>

                      <div className="d-flex align-items-center gap-1 mb-1">
                        <span className="badge bg-light text-dark border small py-0 px-1" style={{ fontSize: '0.7rem' }}>
                          <i className="fa-solid fa-book-open me-1 text-primary" />
                          {courseLabel}
                        </span>
                      </div>

                      <div className={s.itemSub}>
                        <span className={`${s.snippet} ${unread > 0 ? s.unread : ''}`}>
                          {snippet || 'Start conversation with your instructor...'}
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
        <section className={s.chatPanel} aria-label="Instructor Chat Thread">
          {hasActiveChat ? (
            <>
              {/* Thread Header */}
              <div className={s.threadHeader}>
                <div className="d-flex align-items-center gap-3">
                  <button
                    type="button"
                    className={s.backButton}
                    onClick={() => navigate('/student/contact-instructor')}
                    aria-label="Back to conversations"
                  >
                    <i className="fa-solid fa-arrow-left" />
                  </button>

                  <div
                    className="d-flex align-items-center justify-content-center bg-dark text-white rounded-circle"
                    style={{ width: '44px', height: '44px' }}
                  >
                    <i className="fa-solid fa-chalkboard-user text-info" />
                  </div>

                  <div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>
                        {activeInstructor?.name || 'Faculty Instructor'}
                      </span>
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle small px-2 py-0">
                        Course Faculty
                      </span>
                    </div>
                    <div className={s.headerSubtitle}>
                      <span className={s.onlinePulse} />
                      <span>{activeCourse?.name || 'Course Mission'}</span>
                      {activeCohort?.name && <span>· Cohort: {activeCohort.name}</span>}
                      {activeInstructor?.email && <span>· {activeInstructor.email}</span>}
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

              {/* Message Feed */}
              <div className={s.messageFeed} ref={feedContainerRef} role="log" aria-live="polite">
                {loadingMessages ? (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary mb-2" role="status" />
                    <span className="small">Loading conversation history...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className={s.emptyFeed}>
                    <i className="fa-regular fa-comment-dots text-muted mb-2" style={{ fontSize: '2.5rem', opacity: 0.3 }} />
                    <h5 className="fw-semibold text-dark mb-1">No messages exchanged yet</h5>
                    <p className="small text-muted mb-0">Send a message below to start your direct consultation with this instructor.</p>
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
                                  <i className="fa-solid fa-graduation-cap me-1 text-primary" />
                                  <span>{m.senderName || activeInstructor?.name || 'Assigned Instructor'}</span>
                                </>
                              )}
                            </div>
                            <div className={s.messageText}>{m.body}</div>
                            <div className={s.messageMeta}>
                              <span>
                                {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                              {isStudent && (
                                <span className={s.readIndicator} title={m.read ? 'Read by Instructor' : 'Delivered'}>
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
                    placeholder={`Type your message to ${activeInstructor?.name || 'Instructor'} (Enter to send)...`}
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
                  <i className="fa-solid fa-chalkboard-user" />
                </div>
                <h4 className="fw-bold text-dark mb-2">Contact Your Assigned Instructor</h4>
                <p className="text-muted small mb-3">
                  Consult directly with your course instructors regarding lecture content, assignments,
                  attendance inquiries, and academic mentorship.
                </p>
                {availableInstructors.length > 0 ? (
                  <div className="d-flex flex-wrap gap-2 justify-content-center">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm d-flex align-items-center gap-2"
                      onClick={() => setShowSelectModal(true)}
                    >
                      <i className="fa-solid fa-comment-medical" />
                      <span>Select Eligible Instructor</span>
                    </button>
                  </div>
                ) : (
                  <div className="alert alert-light border small text-muted text-start mt-2">
                    <i className="fa-solid fa-circle-info text-info me-2" />
                    No instructors are currently assigned to your enrolled courses or cohorts.
                    Once enrolled in an active training mission, your assigned faculty will appear here automatically.
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Select Eligible Instructor Modal */}
      {showSelectModal && (
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
                  <i className="fa-solid fa-chalkboard-user text-primary" />
                  <span>Choose Eligible Course Instructor</span>
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowSelectModal(false)}
                  disabled={startingChat}
                  aria-label="Close"
                />
              </div>

              <div className="modal-body p-4">
                <p className="text-muted small mb-3">
                  Below are faculty instructors actively assigned to your enrolled courses and cohorts.
                  Select an instructor to open or continue your direct consultation.
                </p>

                {availableInstructors.length === 0 ? (
                  <div className="alert alert-warning py-3 text-center small mb-0">
                    <i className="fa-solid fa-circle-exclamation me-2" />
                    No eligible instructors found for your active enrollments.
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    {availableInstructors.map((inst) => (
                      <div
                        key={`${inst._id}-${inst.cohortId || 'gen'}`}
                        className="p-3 border rounded-3 bg-light d-flex align-items-center justify-content-between hover-shadow transition"
                        style={{ cursor: 'pointer' }}
                        onClick={() => !startingChat && handleSelectInstructor(inst)}
                      >
                        <div className="d-flex align-items-center gap-3">
                          <div
                            className="d-flex align-items-center justify-content-center bg-dark text-white rounded-circle"
                            style={{ width: '40px', height: '40px' }}
                          >
                            <i className="fa-solid fa-user text-info" />
                          </div>
                          <div>
                            <div className="fw-bold text-dark small">{inst.name}</div>
                            <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                              <i className="fa-solid fa-book-open me-1 text-primary" />
                              {inst.courseName || 'Course'} ({inst.cohortName || 'Active Cohort'})
                            </div>
                            {inst.email && (
                              <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                {inst.email}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm px-3"
                          disabled={startingChat}
                        >
                          <i className="fa-solid fa-comments me-1" />
                          <span>Chat</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-footer border-top py-2 px-4 bg-light">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setShowSelectModal(false)}
                  disabled={startingChat}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
