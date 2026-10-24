import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { publicPost, get, post, tokens, refreshSession } from '../services/api.js';

const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem('egsa_instructor_user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });
  const [booting, setBooting] = useState(() => !tokens.hasAccess() && !localStorage.getItem('egsa_instructor_user'));

  useEffect(() => {
    (async () => {
      if (tokens.hasAccess() && user) {
        setBooting(false);
        return;
      }
      try {
        if (tokens.getRefresh()) {
          const r = await refreshSession();
          setUser(r.user);
          try { localStorage.setItem('egsa_instructor_user', JSON.stringify(r.user)); } catch {}
        }
      } catch {
        tokens.clear();
        try { localStorage.removeItem('egsa_instructor_user'); } catch {}
        setUser(null);
      }
      setBooting(false);
    })();
    const onUnauth = () => {
      tokens.clear();
      try { localStorage.removeItem('egsa_instructor_user'); } catch {}
      setUser(null);
    };
    window.addEventListener('egsa:unauthorized', onUnauth);
    return () => window.removeEventListener('egsa:unauthorized', onUnauth);
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await publicPost('/auth/login', { email, password });
    tokens.set(r.accessToken, r.refreshToken);
    try { localStorage.setItem('egsa_instructor_user', JSON.stringify(r.user)); } catch {}
    setUser(r.user);
    return r.user;
  }, []);
  const logout = useCallback(async () => {
    try { await post('/auth/logout', { refreshToken: tokens.getRefresh() }); } catch { /* ignore */ }
    tokens.clear();
    try { localStorage.removeItem('egsa_instructor_user'); } catch {}
    setUser(null);
  }, []);
  const reloadUser = useCallback(async () => setUser(await get('/auth/me')), []);
  const value = useMemo(() => ({ user, booting, login, logout, setUser, reloadUser }), [user, booting, login, logout, reloadUser]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
