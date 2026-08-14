import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Attach the JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, drop the stale token and bounce to the auth page
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('kc_token');
      localStorage.removeItem('kc_user');
      if (!window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
