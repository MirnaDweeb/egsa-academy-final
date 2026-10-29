import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useRealTimeSocket, getActiveToken } from '../../../../shared/socket/socketClient';
import styles from './AdminMessagesPage.module.css';

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

/**
 * Robust classification of conversations based on authoritative participant
 * IDs, roles, and conversation metadata.
 * Returns: 'student_support' | 'instructor_support' | 'student_instructor' | 'needs_review'
 */
export function classifyConversation(c) {
  if (!c) return 'needs_review';

  // 1. Authoritative type checks
  if (c.type === 'student_admin') {
    // Only student and admin participants
    if (c.student && !c.instructor) return 'student_support';
    if (!c.student && !c.instructor) return 'needs_review';
    if (c.student && c.instructor) return 'needs_review';
    return 'student_support';
  }

  if (c.type === 'instructor_admin') {
    // Only instructor and admin participants
    if (c.instructor && !c.student) return 'instructor_support';
    if (!c.student && !c.instructor) return 'needs_review';
    if (c.student && c.instructor) return 'needs_review';
    return 'instructor_support';
  }

  if (c.type === 'direct') {
    // Direct chat between student and instructor
    if (c.student && c.instructor) return 'student_instructor';
    return 'needs_review';
  }

  // 2. Fallback heuristic for legacy or missing type records
  if (c.student && !c.instructor && (c.admin || c.adminName)) {
    return 'student_support';
  }
  if (c.instructor && !c.student && (c.admin || c.adminName)) {
    return 'instructor_support';
  }
  if (c.student && c.instructor && !c.admin) {
    return 'student_instructor';
  }

  return 'needs_review';
}

function formatLastActivity(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function AdminMessagesPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  // Active top tab: 'student_support' | 'instructor_support' | 'student_instructor' | 'needs_review'
  const [selectedTab, setSelectedTab] = useState('student_support');

  // Filters within selected tab
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState('ALL'); // ALL | UNREAD | AWAITING
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL | open | in_progress | resolved

  // Conversations & message data
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Message draft & sending
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
    joinConversation,
    leaveConversation,
    sendMessage: socketSendMessage,
    markRead: socketMarkRead,
  } = useRealTimeSocket();

  // Load conversations
  const fetchConversations = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingConversations(true);
      const res = await axios.get(`${API_BASE}/conversations?limit=200`, authHeaders());
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

  // Classify all conversations with accurate participant inspection
  const classifiedConversations = useMemo(() => {
    return conversations.map((c) => ({
      ...c,
      _category: classifyConversation(c),
    }));
  }, [conversations]);

  // Aggregate metrics for tabs and top bar
  const tabMetrics = useMemo(() => {
    const metrics = {
      student_support: { total: 0, unread: 0, awaiting: 0 },
      instructor_support: { total: 0, unread: 0, awaiting: 0 },
      student_instructor: { total: 0, unread: 0, awaiting: 0 },
      needs_review: { total: 0, unread: 0, awaiting: 0 },
      totalUnread: 0,
      totalAwaiting: 0,
    };

    for (const c of classifiedConversations) {
      const cat = c._category;
      if (metrics[cat]) {
        metrics[cat].total += 1;
        const unreadAdmin = c.unreadCountAdmin || 0;
        if (unreadAdmin > 0) {
          metrics[cat].unread += unreadAdmin;
          metrics.totalUnread += unreadAdmin;
        }

        // Awaiting response heuristic: last message was from non-admin and ticket is not resolved
        const isResolved = c.supportStatus === 'resolved';
        if (!isResolved) {
          if (cat === 'student_support' && c.lastMessage?.senderRole === 'student') {
            metrics[cat].awaiting += 1;
            metrics.totalAwaiting += 1;
          } else if (cat === 'instructor_support' && c.lastMessage?.senderRole === 'instructor') {
            metrics[cat].awaiting += 1;
            metrics.totalAwaiting += 1;
          }
        }
      }
    }

    return metrics;
  }, [classifiedConversations]);

  // Handle Tab Switch
  const handleTabChange = (newTab) => {
    if (newTab === selectedTab) return;
    setSelectedTab(newTab);
    setSearchQuery('');
    setQuickFilter('ALL');
    setFilterStatus('ALL');

    // Never leave a conversation from the previous tab displayed accidentally
    if (activeConversation && classifyConversation(activeConversation) !== newTab) {
      setActiveConversation(null);
      navigate('/admin/messages');
    }
  };

  // Filter conversations for the active tab
  const activeTabConversations = useMemo(() => {
    return classifiedConversations.filter((c) => c._category === selectedTab);
  }, [classifiedConversations, selectedTab]);

  const filteredConversations = useMemo(() => {
    let list = activeTabConversations;

    // Search query within current tab
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((c) => {
        const sName = (c.student?.name || '').toLowerCase();
        const sEmail = (c.student?.email || '').toLowerCase();
        const iName = (c.instructor?.name || '').toLowerCase();
        const iEmail = (c.instructor?.email || '').toLowerCase();
        const subj = (c.subject || '').toLowerCase();
        const courseName = (c.course?.name || c.course?.code || '').toLowerCase();
        const cohortName = (c.cohort?.name || '').toLowerCase();
        const body = (typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.body || '')).toLowerCase();
        return (
          sName.includes(q) ||
          sEmail.includes(q) ||
          iName.includes(q) ||
          iEmail.includes(q) ||
          subj.includes(q) ||
          courseName.includes(q) ||
          cohortName.includes(q) ||
          body.includes(q)
        );
      });
    }

    // Quick filter: All, Unread, Awaiting
    if (quickFilter === 'UNREAD') {
      list = list.filter((c) => (c.unreadCountAdmin || 0) > 0);
    } else if (quickFilter === 'AWAITING') {
      if (selectedTab === 'student_support') {
        list = list.filter((c) => c.lastMessage?.senderRole === 'student' && c.supportStatus !== 'resolved');
      } else if (selectedTab === 'instructor_support') {
        list = list.filter((c) => c.lastMessage?.senderRole === 'instructor' && c.supportStatus !== 'resolved');
      }
    }

    // Support Status filter (Open, In Progress, Resolved)
    if (filterStatus !== 'ALL') {
      list = list.filter((c) => (c.supportStatus || 'open') === filterStatus);
    }

    return list;
  }, [activeTabConversations, searchQuery, quickFilter, filterStatus, selectedTab]);

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

        // Ensure active top tab aligns with the loaded conversation's category
        const cat = classifyConversation(convo);
        setSelectedTab((current) => (current !== cat ? cat : current));

        const msgList = msgsRes.data?.data || [];
        setMessages(msgList);
        shouldAutoScrollRef.current = true;

        // Mark as read in backend
        axios.patch(`${API_BASE}/conversations/${conversationId}/read`, {}, authHeaders()).catch(() => {});
        socketMarkRead(conversationId);
        setConversations((prev) =>
          prev.map((c) => (c._id === conversationId ? { ...c, unreadCountAdmin: 0 } : c))
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

  // Update Status
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

  // Send message as Admin (only enabled for direct support tabs)
  const isMonitoredConversation = activeConversation && classifyConversation(activeConversation) === 'student_instructor';

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const content = draft.trim();
    if (!content || sending || !conversationId || isMonitoredConversation) return;

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

  const hasActiveChat = Boolean(conversationId && activeConversation);

  // Tab configurations
  const TAB_DEFS = [
    {
      key: 'student_support',
      label: 'Student Support',
      icon: 'fa-user-graduate',
      activeClass: styles.tabBtnActiveStudent,
      title: 'Cadet Support Desk',
      description: 'Direct inquiries and support assistance between Academy Students (Cadets) and Administration.',
    },
    {
      key: 'instructor_support',
      label: 'Instructor Support',
      icon: 'fa-chalkboard-user',
      activeClass: styles.tabBtnActiveInstructor,
      title: 'Faculty Support Desk',
      description: 'Direct inquiries, syllabus coordination, and assistance between Faculty Instructors and Administration.',
    },
    {
      key: 'student_instructor',
      label: 'Student–Instructor Chats',
      icon: 'fa-people-arrows',
      activeClass: styles.tabBtnActiveMonitored,
      title: 'Monitored Academic Threads',
      description: 'Course and cohort communications between Cadets and Instructors, accessible for authorized oversight.',
    },
  ];

  // Include Needs Review only if unclassified conversations exist
  if (tabMetrics.needs_review.total > 0) {
    TAB_DEFS.push({
      key: 'needs_review',
      label: 'Needs Review',
      icon: 'fa-triangle-exclamation',
      activeClass: styles.tabBtnActiveReview,
      title: 'Conversations Requiring Review',
      description: 'Conversations with missing, incomplete, or ambiguous participant linkages.',
    });
  }

  const activeTabDef = TAB_DEFS.find((t) => t.key === selectedTab) || TAB_DEFS[0];

  return (
    <div className={styles.pageContainer}>
      {/* 1. Page Header */}
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.headerTitle}>
            <i className="fa-solid fa-headset text-primary" />
            Support &amp; Messages
          </h1>
          <p className={styles.headerSubtitle}>
            Administrative communications hub — Direct Cadet &amp; Faculty support desks and monitored academic threads.
          </p>
        </div>

        {/* Quick Stats & Live Gateway Status */}
        <div className={styles.statsBar}>
          <div className={styles.statChip}>
            <span>Total Threads:</span>
            <span className={styles.statChipStrong}>{conversations.length}</span>
          </div>

          <div className={`${styles.statChip} ${tabMetrics.totalUnread > 0 ? styles.statChipWarning : ''}`}>
            <span>Unread:</span>
            <span className={styles.statChipStrong}>{tabMetrics.totalUnread}</span>
          </div>

          <div className={styles.statChip}>
            <span>Awaiting Reply:</span>
            <span className={styles.statChipStrong}>{tabMetrics.totalAwaiting}</span>
          </div>

          {connected ? (
            <div className={`${styles.statChip} ${styles.statChipSuccess}`}>
              <i className="fa-solid fa-bolt" />
              <span>Real-Time Live</span>
            </div>
          ) : (
            <div className={`${styles.statChip} ${styles.statChipWarning}`}>
              <i className="fa-solid fa-circle-notch fa-spin" />
              <span>Connecting Gateway...</span>
            </div>
          )}
        </div>
      </header>

      {/* 2. Three Prominent Category Tabs */}
      <nav className={styles.tabsNav} role="tablist" aria-label="Support & Messaging Categories">
        {TAB_DEFS.map((tab) => {
          const isActive = selectedTab === tab.key;
          const metric = tabMetrics[tab.key] || { total: 0, unread: 0 };

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.tabBtn} ${isActive ? `${styles.tabBtnActive} ${tab.activeClass}` : ''}`}
              onClick={() => handleTabChange(tab.key)}
            >
              <i className={`fa-solid ${tab.icon}`} />
              <span>{tab.label}</span>
              <span className={styles.tabCountBadge}>{metric.total}</span>
              {metric.unread > 0 && (
                <span className={styles.tabUnreadBadge} title={`${metric.unread} unread messages`}>
                  {metric.unread} unread
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 3. Main Workspace (Split View) */}
      <main className={styles.workspace}>
        {/* Left Sidebar: Conversation List for Selected Tab */}
        <aside
          className={`${styles.sidebar} ${hasActiveChat ? styles.sidebarHiddenOnMobile : ''}`}
          aria-label="Conversation Directory"
        >
          {/* Tab Descriptor Banner */}
          <div className={styles.tabDescriptor}>
            <div className={styles.tabDescriptorTitle}>
              <span>{activeTabDef.title}</span>
              <span className="badge bg-light text-secondary border">
                {filteredConversations.length} {filteredConversations.length === 1 ? 'thread' : 'threads'}
              </span>
            </div>
            <p className={styles.tabDescriptorText}>{activeTabDef.description}</p>
          </div>

          {/* Search & Filter Controls */}
          <div className={styles.searchAndFilters}>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light border-end-0">
                <i className="fa-solid fa-magnifying-glass text-muted" />
              </span>
              <input
                type="search"
                className={`form-control bg-light border-start-0 ${styles.searchInput}`}
                placeholder={
                  selectedTab === 'student_support'
                    ? 'Search student name, email, subject...'
                    : selectedTab === 'instructor_support'
                    ? 'Search instructor name, email, subject...'
                    : 'Search student, instructor, course, cohort...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search conversations"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-light border border-start-0 text-muted"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>

            {/* Quick Filter Pills */}
            <div className={styles.filterPills}>
              <button
                type="button"
                className={`${styles.filterBtn} ${quickFilter === 'ALL' ? styles.filterBtnActive : ''}`}
                onClick={() => setQuickFilter('ALL')}
              >
                All ({activeTabConversations.length})
              </button>

              <button
                type="button"
                className={`${styles.filterBtn} ${quickFilter === 'UNREAD' ? styles.filterBtnActive : ''}`}
                onClick={() => setQuickFilter('UNREAD')}
              >
                Unread ({tabMetrics[selectedTab]?.unread || 0})
              </button>

              {(selectedTab === 'student_support' || selectedTab === 'instructor_support') && (
                <button
                  type="button"
                  className={`${styles.filterBtn} ${quickFilter === 'AWAITING' ? styles.filterBtnActive : ''}`}
                  onClick={() => setQuickFilter('AWAITING')}
                >
                  Awaiting Reply ({tabMetrics[selectedTab]?.awaiting || 0})
                </button>
              )}

              {/* Status Dropdown Filter for Support Tickets */}
              {(selectedTab === 'student_support' || selectedTab === 'instructor_support') && (
                <select
                  className="form-select form-select-sm ms-auto border-secondary-subtle"
                  style={{ width: 'auto', fontSize: '0.72rem', padding: '0.2rem 1.6rem 0.2rem 0.5rem' }}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  aria-label="Filter by ticket status"
                >
                  <option value="ALL">All Status</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              )}
            </div>
          </div>

          {/* Conversation Cards List */}
          <div className={styles.conversationList}>
            {loadingConversations ? (
              <div className="p-4 text-center text-muted">
                <div className="spinner-border spinner-border-sm text-primary mb-2" role="status" />
                <div className="small">Loading {activeTabDef.label}...</div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-muted">
                <i className={`fa-solid ${activeTabDef.icon} mb-2`} style={{ fontSize: '2.2rem', opacity: 0.3 }} />
                <div className="fw-semibold small text-dark mb-1">No conversations found</div>
                <p className="small text-muted mb-0" style={{ fontSize: '0.78rem' }}>
                  {searchQuery.trim()
                    ? `No matching results for "${searchQuery}" in ${activeTabDef.label}.`
                    : `No threads currently present in this category.`}
                </p>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isActive = c._id === conversationId;
                const unread = c.unreadCountAdmin || 0;
                const snippet = typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.body || '');
                const lastTime = formatLastActivity(c.lastMessageAt || c.updatedAt);

                return (
                  <div
                    key={c._id}
                    role="button"
                    tabIndex={0}
                    className={`${styles.conversationCard} ${isActive ? styles.conversationCardActive : ''}`}
                    onClick={() => navigate(`/admin/messages/${c._id}`)}
                  >
                    {/* Role-Specific Avatar */}
                    <div
                      className={`${styles.avatarBox} ${
                        c._category === 'student_support'
                          ? styles.avatarStudent
                          : c._category === 'instructor_support'
                          ? styles.avatarInstructor
                          : c._category === 'student_instructor'
                          ? styles.avatarMonitored
                          : styles.avatarReview
                      }`}
                    >
                      <i
                        className={`fa-solid ${
                          c._category === 'student_support'
                            ? 'fa-user-graduate'
                            : c._category === 'instructor_support'
                            ? 'fa-chalkboard-user'
                            : c._category === 'student_instructor'
                            ? 'fa-people-arrows'
                            : 'fa-triangle-exclamation'
                        }`}
                      />
                    </div>

                    {/* Card Content */}
                    <div className={styles.cardBody}>
                      <div className={styles.cardTopRow}>
                        <span className={`${styles.cardName} ${unread > 0 ? styles.cardNameUnread : ''}`}>
                          {c._category === 'student_support' && (c.student?.name || 'Cadet Student')}
                          {c._category === 'instructor_support' && (c.instructor?.name || 'Faculty Instructor')}
                          {c._category === 'student_instructor' &&
                            `${c.student?.name || 'Student'} ↔ ${c.instructor?.name || 'Instructor'}`}
                          {c._category === 'needs_review' && (c.subject || 'Unclassified Thread')}
                        </span>
                        <span className={styles.cardTime}>{lastTime}</span>
                      </div>

                      {/* Role & Context Meta */}
                      <div className={styles.cardMetaRow}>
                        <span
                          className={`${styles.roleTag} ${
                            c._category === 'student_support'
                              ? styles.roleTagStudent
                              : c._category === 'instructor_support'
                              ? styles.roleTagInstructor
                              : c._category === 'student_instructor'
                              ? styles.roleTagMonitored
                              : styles.roleTagReview
                          }`}
                        >
                          {c._category === 'student_support' && 'Student'}
                          {c._category === 'instructor_support' && 'Instructor'}
                          {c._category === 'student_instructor' && 'Student–Instructor'}
                          {c._category === 'needs_review' && 'Needs Review'}
                        </span>

                        {c.course?.name && (
                          <span className="badge bg-light text-secondary border small py-0 px-1" style={{ fontSize: '0.65rem' }}>
                            {c.course.name}
                          </span>
                        )}

                        {c.supportStatus && (c._category === 'student_support' || c._category === 'instructor_support') && (
                          <span
                            className={`badge small py-0 px-1 ${
                              c.supportStatus === 'resolved'
                                ? 'bg-secondary-subtle text-secondary'
                                : c.supportStatus === 'in_progress'
                                ? 'bg-primary-subtle text-primary'
                                : 'bg-success-subtle text-success'
                            }`}
                            style={{ fontSize: '0.65rem' }}
                          >
                            {c.supportStatus === 'resolved'
                              ? 'Resolved'
                              : c.supportStatus === 'in_progress'
                              ? 'In Progress'
                              : 'Open'}
                          </span>
                        )}
                      </div>

                      {/* Latest Message Preview & Unread Pill */}
                      <div className="d-flex align-items-center justify-content-between gap-2">
                        <p className={`${styles.cardSnippet} ${unread > 0 ? styles.cardSnippetUnread : ''}`}>
                          {snippet || 'Conversation thread opened'}
                        </p>
                        {unread > 0 && (
                          <span className="badge bg-danger rounded-pill px-2 py-0" style={{ fontSize: '0.68rem' }}>
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

        {/* Right Conversation Panel */}
        <section
          className={`${styles.chatPanel} ${!hasActiveChat ? styles.chatPanelHiddenOnMobile : ''}`}
          aria-label="Active Conversation View"
        >
          {hasActiveChat ? (
            <>
              {/* Header */}
              <div className={styles.chatHeader}>
                <div className={styles.chatHeaderMain}>
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    className={`btn btn-outline-secondary btn-sm ${styles.backButtonMobile}`}
                    onClick={() => {
                      setActiveConversation(null);
                      navigate('/admin/messages');
                    }}
                    aria-label="Back to conversations list"
                  >
                    <i className="fa-solid fa-arrow-left me-1" />
                    Back
                  </button>

                  <div
                    className={`${styles.avatarBox} ${
                      activeConversation._category === 'student_support'
                        ? styles.avatarStudent
                        : activeConversation._category === 'instructor_support'
                        ? styles.avatarInstructor
                        : styles.avatarMonitored
                    }`}
                  >
                    <i
                      className={`fa-solid ${
                        activeConversation._category === 'student_support'
                          ? 'fa-user-graduate'
                          : activeConversation._category === 'instructor_support'
                          ? 'fa-chalkboard-user'
                          : 'fa-people-arrows'
                      }`}
                    />
                  </div>

                  <div className={styles.chatHeaderNames}>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span
                        className={`${styles.chatTypeLabel} ${
                          activeConversation._category === 'student_support'
                            ? 'text-primary'
                            : activeConversation._category === 'instructor_support'
                            ? 'text-warning'
                            : 'text-purple'
                        }`}
                        style={{
                          color:
                            activeConversation._category === 'student_instructor'
                              ? '#7c3aed'
                              : undefined,
                        }}
                      >
                        {activeConversation._category === 'student_support' && 'Student Support Thread'}
                        {activeConversation._category === 'instructor_support' && 'Instructor Support Thread'}
                        {activeConversation._category === 'student_instructor' && 'Student–Instructor Course Chat'}
                        {activeConversation._category === 'needs_review' && 'Unclassified Thread'}
                      </span>

                      {/* Prominent Monitoring Badge if Student-Instructor Chat */}
                      {isMonitoredConversation && (
                        <span className="badge text-white px-2 py-1" style={{ background: '#7c3aed', fontSize: '0.72rem' }}>
                          <i className="fa-solid fa-eye me-1" />
                          MONITORING CONVERSATION
                        </span>
                      )}
                    </div>

                    <h2 className={styles.chatParticipantHeading}>
                      {activeConversation._category === 'student_support' &&
                        `Cadet: ${activeConversation.student?.name || 'Student'}`}
                      {activeConversation._category === 'instructor_support' &&
                        `Faculty: ${activeConversation.instructor?.name || 'Instructor'}`}
                      {activeConversation._category === 'student_instructor' &&
                        `${activeConversation.student?.name || 'Student'} ↔ ${activeConversation.instructor?.name || 'Instructor'}`}
                    </h2>

                    <div className={styles.chatSubDetails}>
                      {activeConversation.subject && (
                        <span>Subject: <strong>{activeConversation.subject}</strong></span>
                      )}
                      {activeConversation.course?.name && (
                        <span>· Course: <strong>{activeConversation.course.name}</strong></span>
                      )}
                      {activeConversation.cohort?.name && (
                        <span>· Cohort: <strong>{activeConversation.cohort.name}</strong></span>
                      )}
                      {activeConversation.student?.email && (
                        <span>· Student Email: <code>{activeConversation.student.email}</code></span>
                      )}
                      {activeConversation.instructor?.email && (
                        <span>· Instructor Email: <code>{activeConversation.instructor.email}</code></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Header Actions: Status Dropdown & Realtime Indicator */}
                <div className="d-flex align-items-center gap-2 flex-wrap ms-auto">
                  {!isMonitoredConversation && (
                    <div className="d-flex align-items-center gap-1">
                      <label htmlFor="ticketStatusSelect" className="small fw-semibold text-muted mb-0 me-1">
                        Status:
                      </label>
                      <select
                        id="ticketStatusSelect"
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
                  )}

                  {connected ? (
                    <span className="badge bg-success-subtle text-success border border-success-subtle small px-2 py-1">
                      <i className="fa-solid fa-bolt me-1" />Live
                    </span>
                  ) : (
                    <span className="badge bg-warning-subtle text-warning border border-warning-subtle small px-2 py-1">
                      Offline
                    </span>
                  )}
                </div>
              </div>

              {/* Monitored Conversation Notice Banner */}
              {isMonitoredConversation && (
                <div className={styles.monitoringBanner} role="status">
                  <i className="fa-solid fa-shield-halved" style={{ fontSize: '1.1rem' }} />
                  <div>
                    <strong>Administrative Oversight Mode:</strong> You are reviewing an academic thread between Cadet <strong>{activeConversation.student?.name || 'Student'}</strong> and Faculty Instructor <strong>{activeConversation.instructor?.name || 'Instructor'}</strong>. Direct administrative replies are restricted to preserve direct participant dialogue.
                  </div>
                </div>
              )}

              {/* Message Feed */}
              <div className={styles.chatFeed} ref={feedContainerRef}>
                {loadingMessages ? (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary mb-2" role="status" />
                    <span className="small">Loading conversation history...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center my-auto text-muted p-4">
                    <i className="fa-regular fa-comment-dots mb-2" style={{ fontSize: '2.5rem', opacity: 0.3 }} />
                    <h5 className="fw-semibold text-dark">No messages recorded in this conversation</h5>
                    <p className="small">Conversation opened without initial message records.</p>
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isAdmin = m.senderRole === 'admin';
                    const isStudent = m.senderRole === 'student';
                    const isInstructor = m.senderRole === 'instructor';

                    return (
                      <div
                        key={m._id || `msg-${idx}`}
                        className={`${styles.messageRow} ${
                          isAdmin
                            ? styles.messageRowAdmin
                            : isStudent
                            ? styles.messageRowStudent
                            : styles.messageRowInstructor
                        }`}
                      >
                        <div
                          className={`${styles.messageBubble} ${
                            isAdmin
                              ? styles.messageBubbleAdmin
                              : isStudent
                              ? styles.messageBubbleStudent
                              : styles.messageBubbleInstructor
                          }`}
                        >
                          <div className={styles.messageSender}>
                            {isAdmin
                              ? m.senderName || 'EGSA Administrator'
                              : isStudent
                              ? `Cadet: ${m.senderName || 'Student'}`
                              : `Faculty: ${m.senderName || 'Instructor'}`}
                          </div>

                          <div className={styles.messageBody}>{m.body}</div>

                          {m.attachments && m.attachments.length > 0 && (
                            <div className="mt-2 pt-2 border-top border-light border-opacity-25 d-flex flex-column gap-1">
                              {m.attachments.map((att, attIdx) => (
                                <a
                                  key={attIdx}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-decoration-none small d-inline-flex align-items-center gap-1 text-truncate"
                                  style={{ color: isAdmin ? '#bae6fd' : '#0284c7' }}
                                >
                                  <i className="fa-solid fa-paperclip" />
                                  <span>{att.name || 'Attachment'}</span>
                                </a>
                              ))}
                            </div>
                          )}

                          <div className={styles.messageTime}>
                            <span>
                              {m.createdAt
                                ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : ''}
                            </span>
                            {isAdmin && (
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

              {/* Message Composer (Only shown when admin is authorized to send messages) */}
              {isMonitoredConversation ? (
                <div className={styles.monitoringComposerDisabled}>
                  <i className="fa-solid fa-lock" />
                  <span>
                    Administrative Monitoring Mode — Direct messaging is disabled in student–instructor conversations.
                  </span>
                </div>
              ) : (
                <div className={styles.chatComposer}>
                  {sendError && (
                    <div className="alert alert-danger py-1 px-2 mb-2 small d-flex align-items-center justify-content-between">
                      <span>{sendError}</span>
                      <button
                        type="button"
                        className="btn-close small"
                        onClick={() => setSendError(null)}
                        aria-label="Dismiss send error"
                      />
                    </div>
                  )}
                  <form onSubmit={handleSendMessage} className="d-flex align-items-center gap-2">
                    <textarea
                      ref={textareaRef}
                      className="form-control"
                      placeholder={`Type official reply to ${
                        activeConversation._category === 'student_support' ? 'Cadet' : 'Faculty'
                      } (Enter to send)...`}
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
              )}
            </>
          ) : (
            <div className={styles.emptyStateContainer}>
              <div
                className={`${styles.emptyStateIcon} ${
                  selectedTab === 'student_support'
                    ? styles.avatarStudent
                    : selectedTab === 'instructor_support'
                    ? styles.avatarInstructor
                    : styles.avatarMonitored
                }`}
              >
                <i className={`fa-solid ${activeTabDef.icon}`} />
              </div>
              <h3 className="fw-bold text-dark mb-1">{activeTabDef.title}</h3>
              <p className="small text-muted" style={{ maxWidth: '440px' }}>
                {selectedTab === 'student_support'
                  ? 'Select an active Cadet support conversation from the list to review messages and provide administrative guidance in real time.'
                  : selectedTab === 'instructor_support'
                  ? 'Select an active Faculty support inquiry from the list to review questions, coordinate curricula, and respond in real time.'
                  : 'Select a student–instructor conversation from the list to monitor academic interactions, check student progress, and ensure institutional compliance.'}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
