import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { PageHeader } from '../components/ui.jsx';
import { instructorApi } from '../services/instructor.js';
import { useI18n } from '../i18n/index.jsx';
import { useRealTimeSocket } from '../../../shared/socket/socketClient';
import s from './Contact.module.css';

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

export default function ContactPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

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

  // Load or create the Admin Support conversation for instructor
  const initAdminConversation = useCallback(async () => {
    try {
      setLoading(true);
      const res = await instructorApi.contactAdmin({ subject: 'Faculty Administration Support' });
      const convo = res?.data || res;
      if (convo?._id) {
        setConversation(convo);
        return convo;
      }
    } catch (err) {
      console.error('Failed to initialize instructor-admin conversation:', err);
    } finally {
      setLoading(false);
    }
    return null;
  }, []);

  // Fetch messages
  const loadMessages = useCallback(async (convoId) => {
    if (!convoId) return;
    try {
      setLoadingMessages(true);
      setSendError(null);
      const msgsRes = await instructorApi.messages(convoId, { limit: 100 });
      const msgList = Array.isArray(msgsRes) ? msgsRes : (msgsRes?.data || []);
      setMessages(msgList);
      shouldAutoScrollRef.current = true;

      // Mark read
      instructorApi.markMessagesRead(convoId).catch(() => {});
      socketMarkRead(convoId);
    } catch (err) {
      console.error('Failed to load contact messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, [socketMarkRead]);

  // Initial load
  useEffect(() => {
    let active = true;
    const run = async () => {
      const convo = await initAdminConversation();
      if (active && convo?._id) {
        await loadMessages(convo._id);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [initAdminConversation, loadMessages]);

  const activeConvoId = conversation?._id;

  // Real-Time Socket.IO Subscription
  useEffect(() => {
    if (!socket || !activeConvoId) return;

    joinConversation(activeConvoId, (ack) => {
      if (!ack?.success) {
        console.warn('[Socket.IO] Instructor Contact join room rejected:', ack?.error);
      }
    });

    const handleNewMessage = (payload) => {
      const { conversationId: msgConvId, message } = payload || {};
      if (msgConvId === activeConvoId && message) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          if (feedContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = feedContainerRef.current;
            shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 150;
          }
          return [...prev, message];
        });
        socketMarkRead(activeConvoId);
      }
    };

    const handleMessageRead = (payload) => {
      if (payload?.conversationId === activeConvoId) {
        setMessages((prev) =>
          prev.map((m) => (m.read ? m : { ...m, read: true, readAt: payload.readAt }))
        );
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:read', handleMessageRead);

    return () => {
      leaveConversation(activeConvoId);
      socket.off('message:new', handleNewMessage);
      socket.off('message:read', handleMessageRead);
    };
  }, [socket, activeConvoId, joinConversation, leaveConversation, socketMarkRead]);

  // Autoscroll logic
  useEffect(() => {
    if (shouldAutoScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Send message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const content = draft.trim();
    if (!content || sending || !activeConvoId) return;

    setSending(true);
    setSendError(null);

    if (socket && connected) {
      socketSendMessage({ conversationId: activeConvoId, body: content }, (ack) => {
        setSending(false);
        if (ack?.success && ack?.data) {
          const createdMessage = ack.data;
          setMessages((prev) => {
            if (prev.some((m) => m._id === createdMessage._id)) return prev;
            return [...prev, createdMessage];
          });
          setDraft('');
          shouldAutoScrollRef.current = true;
          if (textareaRef.current) textareaRef.current.focus();
        } else {
          setSendError(ack?.error || 'Failed to dispatch message');
        }
      });
    } else {
      try {
        const res = await instructorApi.sendMessage(activeConvoId, { body: content });
        const createdMessage = res?.data || res;
        if (createdMessage && createdMessage._id) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === createdMessage._id)) return prev;
            return [...prev, createdMessage];
          });
        }
        setDraft('');
        shouldAutoScrollRef.current = true;
        if (textareaRef.current) textareaRef.current.focus();
      } catch (err) {
        console.error('Failed to send contact message:', err);
        setSendError(err.message || 'Failed to send message');
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

  return (
    <>
      <PageHeader
        eyebrow="Governance & Faculty Support"
        title="Contact Administration"
        subtitle="Direct official communications and faculty support with EGSA Academy Administration"
      />

      <div className={s.contactWorkspace}>
        {/* Main: Admin Support Chat Thread */}
        <section className={s.chatConsole} aria-label="Faculty Admin Communication Thread">
          {/* Header */}
          <div className={s.consoleHeader}>
            <div className={s.headerIdentity}>
              <div className={s.adminAvatar} title="Egyptian Space Agency Administration">
                <i className="fa-solid fa-shield-halved" />
              </div>

              <div className={s.headerText}>
                <div className={s.channelTitle}>
                  <span>EGSA Academy Administration & Governance</span>
                  <span className={s.officialBadge}>Official Channel</span>
                </div>
                <div className={s.channelMeta}>
                  <span>support@egsa.gov.eg</span>
                  <span>·</span>
                  <span>Faculty Operations Desk</span>
                  {conversation?.supportStatus && (
                    <>
                      <span>·</span>
                      <span className="text-capitalize fw-semibold text-primary">
                        Status: {conversation.supportStatus.replace('_', ' ')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <div className={s.statusIndicator}>
                {connected ? (
                  <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 d-flex align-items-center gap-2">
                    <span className={s.onlinePulse} />
                    <span>Real-Time Gateway</span>
                  </span>
                ) : (
                  <span className="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1 d-flex align-items-center gap-2">
                    <span className={s.connectingPulse} />
                    <span>Connecting...</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Messages Feed */}
          <div className={s.messageFeed} ref={feedContainerRef} role="log" aria-live="polite">
            {loading || loadingMessages ? (
              <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                <Spinner animation="border" size="sm" variant="primary" className="mb-2" />
                <span className="small">Connecting to Administration Desk...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className={s.emptyFeed}>
                <div className={s.emptyFeedIcon}>
                  <i className="fa-solid fa-comments" />
                </div>
                <h5 className="fw-bold text-dark mb-1">Administrative Support Channel Ready</h5>
                <p className="small text-muted mb-0">
                  You are connected to the official EGSA Academy Governance Desk. Type your inquiry below to initiate communications.
                </p>
              </div>
            ) : (
              messages.map((m, idx) => {
                const isInstructor = m.senderRole === 'instructor';
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
                    <div className={`${s.messageRow} ${isInstructor ? s.instructor : s.admin}`}>
                      <div className={s.messageBubble}>
                        <div className={s.messageSender}>
                          {isInstructor ? (
                            <>
                              <span>Instructor (You)</span>
                              <i className="fa-solid fa-user-tie" />
                            </>
                          ) : (
                            <>
                              <i className="fa-solid fa-building-columns text-primary" />
                              <span>{m.senderName || 'EGSA Administrator'}</span>
                            </>
                          )}
                        </div>
                        <div className={s.messageText}>{m.body}</div>
                        <div className={s.messageMeta}>
                          <span>
                            {m.createdAt
                              ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : ''}
                          </span>
                          {isInstructor && (
                            <span
                              className={s.readReceipt}
                              title={m.read ? 'Read by Administration' : 'Delivered to Gateway'}
                            >
                              <i
                                className={`fa-solid ${
                                  m.read ? 'fa-check-double text-info' : 'fa-check text-muted'
                                }`}
                              />
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

          {/* Composer */}
          <div className={s.composer}>
            {sendError && (
              <div className={s.errorBanner}>
                <div className="d-flex align-items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation" />
                  <span>{sendError}</span>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-sm"
                  onClick={() => setSendError(null)}
                  aria-label="Dismiss error"
                />
              </div>
            )}
            <form onSubmit={handleSendMessage} className={s.composerForm}>
              <div className={s.textareaWrap}>
                <textarea
                  ref={textareaRef}
                  className={s.textarea}
                  placeholder="Type your official inquiry to Academy Administration (Enter to send)..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending || loading}
                  rows={2}
                  aria-label="Official message draft"
                />
                <div className={s.composerHint}>
                  <span>
                    <i className="fa-solid fa-lock text-muted me-1" />
                    Encrypted channel for official faculty governance
                  </span>
                  <span>Enter to send · Shift + Enter for new line</span>
                </div>
              </div>
              <button
                type="submit"
                className={s.sendButton}
                disabled={!draft.trim() || sending || loading}
                aria-label="Send message"
              >
                {sending ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <i className="fa-solid fa-paper-plane" />
                )}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
