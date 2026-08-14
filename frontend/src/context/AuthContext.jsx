import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kc_user'));
    } catch {
      return null;
    }
  });

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    applySession(data);
    return data.user;
  };

  const signup = async (payload) => {
    const { data } = await api.post('/auth/signup', payload);
    applySession(data);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('kc_token');
    localStorage.removeItem('kc_user');
    setUser(null);
  };

  const refresh = async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    localStorage.setItem('kc_user', JSON.stringify(data.user));
    return data.user;
  };

  const applySession = (data) => {
    localStorage.setItem('kc_token', data.token);
    localStorage.setItem('kc_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  // Restore profile (skills included) when the app loads
  useEffect(() => {
    if (localStorage.getItem('kc_token')) refresh().catch(() => logout());
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
