import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // The session is an httpOnly cookie (JS can't see it); `user` is the only
  // client-side session state. `loading` gates route guards until /auth/me
  // settles, so a valid session never bounces through /auth on reload.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = async (email, password) => {
    await api.post('/auth/login', { email, password });
    return refresh();
  };

  const signup = async (payload) => {
    await api.post('/auth/signup', payload);
    return refresh();
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Server already forgot us — still clear local state.
    }
    setUser(null);
  };

  const refresh = async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    return data.user;
  };

  // Restore the session when the app loads (cookie -> user, or null).
  useEffect(() => {
    refresh().catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
