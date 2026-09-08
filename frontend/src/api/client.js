import axios from 'axios';

const api = axios.create({
  // VITE_API_URL lets `vite preview` or static hosts point at the API
  // directly; dev (proxy) and docker/prod (same origin) keep using /api.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  // The session lives in an httpOnly cookie — the browser attaches it
  // automatically (required for cross-origin dev: :5173 -> :4000).
  withCredentials: true,
});

// On 401, bounce to the auth page (the session cookie is gone/invalid).
// Login/signup failures (already on /auth) surface their own messages.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      if (!window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
