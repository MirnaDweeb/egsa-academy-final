import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { PageHeader } from '../components/ui.jsx';
import { instructorApi } from '../services/instructor.js';
import { useI18n } from '../i18n/index.jsx';
import { useRealTimeSocket } from '../../../shared/socket/socketClient';
import s from './messages.module.css';

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
        eyebrow="Governance & Support"
        title="Contact Administration"
        subtitle="Direct official communications and faculty support with EGSA Academy Administration"
      />

      <div className={s.messagingContainer} data-active-chat="true" style={{ gridTemplateColumns: '1fr' }}>
        {/* Main: Admin Support Chat Thread */}
        <section className={s.chatPanel} aria-label="Faculty Admin Communication Thread" style={{ borderRadius: '12px' }}>
          {/* Header */}
          <div className={s.threadHeader}>
            <div className="d-flex align-items-center gap-3">
              <div
                className="d-flex align-items-center justify-content-center bg-primary text-white rounded-circle shadow-sm"
                style={{ width: '46px', height: '46px' }}
              >
                <i className="fa-solid fa-shield-halved fa-lg" />
              </div>

              <div>
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>
                    EGSA Academy Administration & Support
                  </span>
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle small px-2 py-0">
                    Official Channel
                  </span>
                </div>
                <div className={s.headerSubtitle}>
                  <span className={s.onlinePulse} />
                  <span>support@egsa.gov.eg</span>
                  <span>· Faculty Operations & Academic Governance</span>
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
                  Connecting...
                </span>
              )}
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
                <i className="fa-regular fa-comment-dots text-muted mb-2" style={{ fontSize: '2.5rem', opacity: 0.3 }} />
                <h5 className="fw-semibold text-dark mb-1">No messages exchanged yet</h5>
                <p className="small text-muted mb-0">Type below to reach EGSA Academy Administration directly.</p>
              </div>
            ) : (
              messages.map((m, idx) => {
                const isInstructor = m.senderRole === 'instructor';
                return (
                  <div
                    key={m._id || `msg-${idx}`}
                    className={`${s.messageRow} ${isInstructor ? s.sent : s.received}`}
                  >
                    <div className={s.messageBubble}>
                      <div className={s.messageSenderRole}>
                        {m.senderName || (isInstructor ? 'Instructor (You)' : 'EGSA Administrator')}
                      </div>
                      <div className={s.messageText}>{m.body}</div>
                      <div className={s.messageMeta}>
                        <span>
                          {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        {isInstructor && (
                          <span className={s.readIndicator} title={m.read ? 'Read by Admin' : 'Delivered'}>
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

          {/* Composer */}
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
                disabled={sending || loading}
                rows={1}
                aria-label="Message draft"
              />
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
