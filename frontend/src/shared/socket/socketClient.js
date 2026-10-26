import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_WS_URL || window.location.origin;

let globalSocket = null;
let currentToken = null;
const connectionListeners = new Set();

export function getActiveToken() {
  return (
    localStorage.getItem('instructor_token') ||
    localStorage.getItem('esa_token') ||
    localStorage.getItem('egsa_access_token') ||
    localStorage.getItem('egsa_token') ||
    null
  );
}

export function initGlobalSocket(tokenOverride = null) {
  const token = tokenOverride || getActiveToken();

  if (!token) {
    if (globalSocket) {
      globalSocket.disconnect();
      globalSocket = null;
      currentToken = null;
      notifyConnectionListeners(false, 'unauthenticated');
    }
    return null;
  }

  // If socket already active with same token, reuse
  if (globalSocket && currentToken === token) {
    return globalSocket;
  }

  // If token changed or socket disconnected, close prior socket
  if (globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
  }

  currentToken = token;

  globalSocket = io(SOCKET_URL, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  globalSocket.on('connect', () => {
    console.log('[Socket.IO] Connected to EGSA Real-Time Gateway, id:', globalSocket.id);
    notifyConnectionListeners(true, 'connected');
  });

  globalSocket.on('disconnect', (reason) => {
    console.warn('[Socket.IO] Disconnected from Gateway:', reason);
    notifyConnectionListeners(false, 'disconnected');
  });

  globalSocket.on('connect_error', (err) => {
    console.warn('[Socket.IO] Connection error:', err.message);
    notifyConnectionListeners(false, 'error', err.message);
  });

  return globalSocket;
}

function notifyConnectionListeners(connected, state, details = '') {
  connectionListeners.forEach((fn) => {
    try {
      fn(connected, state, details);
    } catch (_) {}
  });
}

/**
 * React hook for consuming real-time Socket.IO connection in any portal component.
 */
export function useRealTimeSocket(tokenOverride = null) {
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('connecting');
  const socketRef = useRef(null);

  useEffect(() => {
    const s = initGlobalSocket(tokenOverride);
    socketRef.current = s;

    if (s) {
      setConnected(s.connected);
      setConnectionState(s.connected ? 'connected' : 'connecting');
    } else {
      setConnected(false);
      setConnectionState('unauthenticated');
    }

    const onStateChange = (isConnected, state) => {
      setConnected(isConnected);
      setConnectionState(state);
    };

    connectionListeners.add(onStateChange);

    return () => {
      connectionListeners.delete(onStateChange);
    };
  }, [tokenOverride]);

  const joinConversation = useCallback((conversationId, callback) => {
    const s = socketRef.current || initGlobalSocket(tokenOverride);
    if (!s || !conversationId) return;

    s.emit('conversation:join', { conversationId }, (res) => {
      if (typeof callback === 'function') callback(res);
    });
  }, [tokenOverride]);

  const leaveConversation = useCallback((conversationId) => {
    const s = socketRef.current;
    if (!s || !conversationId) return;
    s.emit('conversation:leave', { conversationId });
  }, []);

  const sendMessage = useCallback(({ conversationId, body, attachments }, callback) => {
    const s = socketRef.current || initGlobalSocket(tokenOverride);
    if (!s || !conversationId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Socket disconnected' });
      return;
    }

    s.emit('message:send', { conversationId, body, attachments }, (res) => {
      if (typeof callback === 'function') callback(res);
    });
  }, [tokenOverride]);

  const markRead = useCallback((conversationId, callback) => {
    const s = socketRef.current || initGlobalSocket(tokenOverride);
    if (!s || !conversationId) return;
    s.emit('message:read', { conversationId }, (res) => {
      if (typeof callback === 'function') callback(res);
    });
  }, [tokenOverride]);

  return {
    socket: socketRef.current,
    connected,
    connectionState,
    joinConversation,
    leaveConversation,
    sendMessage,
    markRead,
  };
}
