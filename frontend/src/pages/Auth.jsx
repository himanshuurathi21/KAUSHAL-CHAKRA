import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
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
    if (Number(captchaInput) !== captcha.a) {
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
      setCaptcha(genCaptcha());
      setCaptchaInput('');
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
            <a href="/PRIVACY_POLICY.md" target="_blank" rel="noreferrer" className="hover:text-maroon underline underline-offset-4">
              Privacy Policy
            </a>
            <span className="text-line">•</span>
            <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-maroon underline underline-offset-4">
              Terms &amp; Conditions
            </a>
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

          <div className={`kc-card p-7 sm:p-8 lg:p-8 shadow-sm flex flex-col ${mode === 'signup' ? 'min-h-[640px]' : 'min-h-[480px]'}`}>
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

              {/* CAPTCHA */}
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
            © {new Date().getFullYear()} KaushalChakra · <a href="/PRIVACY_POLICY.md" target="_blank" rel="noreferrer" className="underline">Privacy</a> · Terms
          </p>
        </div>
      </div>
    </div>
  );
}
