import axios from 'axios';

const api = axios.create({
  // VITE_API_URL lets `vite preview` or static hosts point at the API
  // directly; dev (proxy) and docker/prod (same origin) keep using /api.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // Render free tier sleeps after 15 min idle — first request can take 30-50s
  // to wake the service. 60s avoids a false "Could not reach the server".
  timeout: 60000,
  // The session lives in an httpOnly cookie — the browser attaches it
  // automatically (required for cross-origin dev: :5173 -> :4000).
  withCredentials: true,
});

// Retry once on cold-start timeouts / network blips for idempotent GETs.
async function retryOnceOnTimeout(err) {
  const cfg = err.config;
  const isTimeout = err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout');
  const isNetwork = !err.response && err.request;
  if ((isTimeout || isNetwork) && cfg && !cfg._retried && (cfg.method || 'get').toLowerCase() === 'get') {
    cfg._retried = true;
    return api(cfg);
  }
  throw err;
}

// On 401, bounce to the auth page (the session cookie is gone/invalid).
// Login/signup failures (already on /auth) surface their own messages.
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      if (!window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth';
      }
      return Promise.reject(err);
    }
    return retryOnceOnTimeout(err);
  }
);

export default api;
