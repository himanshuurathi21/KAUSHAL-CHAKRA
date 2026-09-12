import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function genCaptcha() {
  const a = Math.floor(Math.random() * 8) + 2;
  const b = Math.floor(Math.random() * 8) + 2;
  return { q: `${a} + ${b} = ?`, a: a + b };
}

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '', consent: false });
  const [captcha, setCaptcha] = useState(() => genCaptcha());
  const [captchaInput, setCaptchaInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    if (mode === 'login' && Number(captchaInput) !== captcha.a) {
      setError('Incorrect CAPTCHA answer. Try again.');
      setCaptcha(genCaptcha());
      setCaptchaInput('');
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await signup(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
      if (mode === 'login') {
        setCaptcha(genCaptcha());
        setCaptchaInput('');
      }
    } finally {
      setBusy(false);
    }
  };

  const input = 'kc-input py-3.5 text-[15px]';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-paper">
      {/* LEFT — 60% branding / information */}
      <div className="w-full lg:w-[60%] flex flex-col justify-between bg-paper lg:border-r border-line relative overflow-hidden">
        {/* subtle decorative background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-[520px] h-[520px] rounded-full bg-maroon/[0.04]" />
          <div className="absolute top-1/2 -left-32 w-[420px] h-[420px] rounded-full bg-marigold/[0.06]" />
          <div className="absolute bottom-0 right-0 w-full h-[1px] bg-gradient-to-r from-transparent via-line to-transparent lg:hidden" />
        </div>

        <div className="relative px-6 sm:px-10 lg:px-14 xl:px-16 pt-10 lg:pt-12 pb-8 flex-1 flex flex-col">
          {/* top branding */}
          <div className="flex items-start gap-4">
            <img
              src="/k-logo.png"
              alt="KaushalChakra Logo"
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain bg-white rounded-xl p-1.5 shadow-sm border border-line shrink-0"
            />
            <div className="pt-1">
              <h1 className="kc-display text-[28px] sm:text-3xl font-bold text-ink tracking-tight leading-none">
                KaushalChakra
              </h1>
              <p className="text-maroon text-[11px] font-bold uppercase tracking-[0.14em] mt-1">
                Trade skills, not money
              </p>
            </div>
          </div>

          {/* main message */}
          <div className="mt-10 lg:mt-14 max-w-[560px]">
            <p className="kc-display text-3xl sm:text-[34px] lg:text-[38px] font-bold text-ink leading-[1.05] tracking-tight">
              Learn what you want.<br />
              <span className="text-maroon">Teach what you know.</span>
            </p>
            <p className="text-muted mt-4 text-[15px] leading-6">
              KaushalChakra is a skill-bartering platform that builds fair <span className="text-ink font-medium">2–5 person exchange cycles</span> — no money involved.
              You teach Python to someone, they teach Photography to the next, and it loops back to you.
            </p>

            <div className="kc-rule my-8 max-w-[520px]"><span /></div>

            <div className="grid sm:grid-cols-3 gap-4 max-w-[560px]">
              <div className="bg-white border border-line rounded-xl p-4">
                <p className="text-maroon text-xs font-bold uppercase tracking-wide">Smart cycles</p>
                <p className="text-ink text-sm leading-5 mt-1.5">2–5 person loops where everyone gives and receives.</p>
              </div>
              <div className="bg-white border border-line rounded-xl p-4">
                <p className="text-leaf text-xs font-bold uppercase tracking-wide">Credit fallback</p>
                <p className="text-ink text-sm leading-5 mt-1.5">No match? Teach now, earn a credit, redeem to learn.</p>
              </div>
              <div className="bg-white border border-line rounded-xl p-4">
                <p className="text-maroon text-xs font-bold uppercase tracking-wide">Verified levels</p>
                <p className="text-ink text-sm leading-5 mt-1.5">Quiz + certificate badges keep levels honest.</p>
              </div>
            </div>

            <p className="text-muted text-xs mt-6 leading-5 max-w-[520px]">
              Built for students and communities — list what you can teach, what you want to learn, and when you are free.
              Matching runs automatically and prefers the best fit.
            </p>
          </div>

          {/* spacer to push footer down on desktop */}
          <div className="hidden lg:block flex-1" />
        </div>

        {/* footer — only branding side */}
        <div className="relative px-6 sm:px-10 lg:px-14 xl:px-16 pb-6 lg:pb-8">
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted border-t border-line pt-4 max-w-[560px]">
            <Link to="/privacy" className="hover:text-maroon underline underline-offset-4">
              Privacy Policy
            </Link>
            <span className="text-line">•</span>
            <Link to="/terms" className="hover:text-maroon underline underline-offset-4">
              Terms &amp; Conditions
            </Link>
            <span className="text-line">•</span>
            <span>© {new Date().getFullYear()} KaushalChakra</span>
          </div>
          <p className="text-[11px] text-muted/70 mt-2">DPDP Act, 2023 compliant · Skill data used only for matching</p>
        </div>
      </div>

      {/* RIGHT — 40% login panel */}
      <div className="w-full lg:w-[40%] flex items-center justify-center p-4 sm:p-6 lg:p-8 xl:p-10 bg-parchment/30 lg:bg-paper">
        <div className="w-full max-w-md">
          {/* mobile: small brand hint above card (hidden on desktop where left side already shows it) */}
          <div className="lg:hidden text-center mb-6">
            <p className="text-muted text-xs">Get matched in fair multi-person cycles.</p>
          </div>

          <div className={`kc-card p-7 sm:p-8 lg:p-8 shadow-sm flex flex-col ${mode === 'signup' ? 'min-h-[600px]' : 'min-h-[540px]'}`}>
            <div className="mb-7 pt-1">
              <h2 className="kc-display text-[22px] font-bold text-ink">
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-muted text-[14px] mt-1.5">
                {mode === 'login' ? 'Log in to continue your exchanges.' : 'Join and start trading skills.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1 bg-parchment rounded-lg p-1 mb-7">
              {['login', 'signup'].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setError('');
                    setCaptcha(genCaptcha());
                    setCaptchaInput('');
                  }}
                  className={`py-2.5 rounded-md text-sm font-semibold capitalize transition-colors cursor-pointer ${
                    mode === m ? 'bg-maroon text-white shadow-sm' : 'text-muted hover:text-ink'
                  }`}
                >
                  {m === 'login' ? 'Log in' : 'Sign up'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-5 flex-1 flex flex-col">
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
              <div className="relative">
                <input
                  className={`${input} pr-12`}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password (min 6 characters)"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-muted hover:text-ink hover:bg-parchment transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5" aria-hidden="true">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.1A10.5 10.5 0 0 1 12 4c4.5 0 8 5 8 8a10 10 0 0 1-2.3 4.2" />
                      <path d="M14.8 14.8A10 10 0 0 1 12 20c-4.5 0-8-5-8-8a10 10 0 0 1 3.7-5.1" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5" aria-hidden="true">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

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
                    <Link to="/privacy" target="_blank" className="kc-link">
                      Privacy Policy
                    </Link>
                    {' '} (DPDP Act, 2023)
                  </span>
                </label>
              )}

              {/* CAPTCHA — login only */}
              {mode === 'login' && (
                <div className="bg-parchment/60 border border-line rounded-lg p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted">CAPTCHA</p>
                    <p className="text-ink font-mono text-lg font-bold tracking-wide select-none">{captcha.q}</p>
                  </div>
                  <input
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value.replace(/[^0-9-]/g, ''))}
                    placeholder="Answer"
                    className="kc-input w-24 py-2.5 text-center font-mono text-[15px]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCaptcha(genCaptcha());
                      setCaptchaInput('');
                    }}
                    className="text-muted hover:text-maroon text-lg leading-none px-1"
                    title="Refresh CAPTCHA"
                  >
                    ↻
                  </button>
                </div>
              )}

              {error && <p className="kc-alert-error">{error}</p>}

              <button
                disabled={busy || (mode === 'signup' && !form.consent)}
                className="kc-btn w-full py-3.5 text-[15px] mt-auto"
              >
                {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
              </button>
            </form>
          </div>

          <p className="text-center text-muted text-xs mt-4 leading-5">
            Demo accounts: aarav@demo.com · simran@demo.com · rohan@demo.com · priya@demo.com (admin)<br />
            Password: <span className="text-ink font-medium">password123</span>
          </p>

          {/* right side footer hint on mobile only */}
          <p className="lg:hidden text-center text-[11px] text-muted/60 mt-6">
            © {new Date().getFullYear()} KaushalChakra · <Link to="/privacy" className="underline">Privacy</Link> · <Link to="/terms" className="underline">Terms</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
