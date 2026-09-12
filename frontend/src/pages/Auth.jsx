import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '', consent: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { user, loading, login, signup } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>;
  }
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await signup(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const input = 'kc-input';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-paper">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/k-logo.png" alt="KaushalChakra Logo" className="w-20 h-20 mx-auto mb-4 object-contain bg-white rounded-2xl p-2 shadow-sm border border-line" />
          <h1 className="kc-display text-4xl font-bold text-ink">
            KaushalChakra
          </h1>
          <p className="text-muted mt-1 text-sm tracking-wide">Trade skills, not money</p>
          <p className="text-muted mt-2 text-sm">
            Get matched in fair multi-person cycles.
          </p>
        </div>

        <div className="kc-card p-6">
          <div className="grid grid-cols-2 gap-1 bg-parchment rounded-lg p-1 mb-6">
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError('');
                }}
                className={`py-2 rounded-md text-sm font-semibold capitalize transition-colors cursor-pointer ${
                  mode === m ? 'bg-maroon text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {m === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <input
                  className={input}
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <input
                  className={input}
                  placeholder="Department (optional)"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </>
            )}
            <input
              className={input}
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <input
              className={input}
              type="password"
              placeholder="Password (min 6 characters)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />

            {mode === 'signup' && (
              <label className="flex items-start gap-2 text-xs text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                  className="mt-0.5 accent-[var(--color-maroon)]"
                  required
                />
                <span>
                  I consent to KaushalChakra storing my profile, skill, and exchange data as described in the{' '}
                  <a href="/PRIVACY_POLICY.md" target="_blank" rel="noreferrer" className="kc-link">
                    Privacy Policy
                  </a>
                  {' '} (DPDP Act, 2023)
                </span>
              </label>
            )}

            {error && (
              <p className="kc-alert-error">
                {error}
              </p>
            )}

            <button
              disabled={busy || (mode === 'signup' && !form.consent)}
              className="kc-btn w-full"
            >
              {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-muted text-xs mt-6">
          Demo accounts: aarav@demo.com · simran@demo.com · rohan@demo.com · priya@demo.com (password: password123)
        </p>
      </div>
    </div>
  );
}
