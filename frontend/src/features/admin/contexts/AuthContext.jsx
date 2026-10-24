import { createContext, useCallback, useEffect, useState } from 'react';
import authService from '../services/api/authService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const token = localStorage.getItem('esa_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const { user: me } = await authService.getMe();
      setUser(me);
    } catch (err) {
      localStorage.removeItem('esa_token');
      localStorage.removeItem('esa_user');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (credentials) => {
    const { user: loggedInUser, token } = await authService.login(credentials);
    localStorage.setItem('esa_token', token);
    localStorage.setItem('esa_user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return loggedInUser;
  };

  const register = async (payload) => {
    const { user: newUser, token } = await authService.register(payload);
    localStorage.setItem('esa_token', token);
    localStorage.setItem('esa_user', JSON.stringify(newUser));
    setUser(newUser);
    return newUser;
  };

  const logout = () => {
    localStorage.removeItem('esa_token');
    localStorage.removeItem('esa_user');
    localStorage.removeItem('egsa_access_token');
    localStorage.removeItem('egsa_token');
    localStorage.removeItem('egsa_refresh_token');
    localStorage.removeItem('egsa_refresh');
    localStorage.removeItem('egsa_user');
    localStorage.removeItem('agency_role');
    localStorage.removeItem('agency_email');
    setUser(null);
    window.location.href = '/admin/login';
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
