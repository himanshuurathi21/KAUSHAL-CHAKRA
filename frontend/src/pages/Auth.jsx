import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { user, login, signup } = useAuth();
  const navigate = useNavigate();

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

  const input =
    'w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400/60';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[radial-gradient(ellipse_at_top_left,#312e81_0%,transparent_55%),radial-gradient(ellipse_at_bottom_right,#701a75_0%,transparent_55%)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-400 to-fuchsia-500 flex items-center justify-center text-2xl font-black text-white shadow-2xl shadow-indigo-500/40 mb-4">
            KC
          </div>
          <h1 className="text-3xl font-bold text-white">
            Kaushal<span className="text-indigo-300">Chakra</span>
          </h1>
          <p className="text-indigo-200 mt-2 text-sm">
            Trade skills, not money. Get matched in fair multi-person cycles.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
          <div className="grid grid-cols-2 gap-1 bg-white/5 rounded-lg p-1 mb-6">
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError('');
                }}
                className={`py-2 rounded-md text-sm font-semibold capitalize transition-colors cursor-pointer ${
                  mode === m ? 'bg-indigo-500 text-white' : 'text-indigo-200 hover:text-white'
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

            {error && (
              <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              disabled={busy}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
            >
              {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-indigo-300/70 text-xs mt-6">
          Demo accounts: aarav@demo.com · simran@demo.com · rohan@demo.com · priya@demo.com (password: password123)
        </p>
      </div>
    </div>
  );
}
