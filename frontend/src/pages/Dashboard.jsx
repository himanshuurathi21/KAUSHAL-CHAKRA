import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [exchangeType, setExchangeType] = useState(() => localStorage.getItem('kc_exchangeType') || 'SKILL');
  const [creditProgress, setCreditProgress] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    setLoadError('');
    api.get('/match/status').then(({ data }) => setStatus(data)).catch(() => setLoadError('Could not reach the server.'));
  };

  useEffect(() => {
    load();
    api.get('/credits/progress').then(({ data }) => setCreditProgress(data)).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem('kc_exchangeType', exchangeType);
  }, [exchangeType]);

  const runMatching = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/match/run');
      if (data.cycles.length > 0) {
        const { data: fresh } = await api.get('/match/status');
        setStatus(fresh);
      } else {
        setError('No new cycles could be formed with the current skills.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Matching failed');
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="kc-alert-error inline-block">{loadError}</p>
        <div>
          <button onClick={load} className="kc-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-muted">
        Checking your match status…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Exchange type toggle — Phase 1 */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex bg-parchment rounded-full p-1 border border-line">
          <button onClick={() => setExchangeType('SKILL')} className={`px-5 py-2 rounded-full text-sm font-semibold ${exchangeType==='SKILL'?'bg-maroon text-white':'text-muted'}`}>Learn a Skill</button>
          <button onClick={() => setExchangeType('TASK')} className={`px-5 py-2 rounded-full text-sm font-semibold ${exchangeType==='TASK'?'bg-maroon text-white':'text-muted'}`}>Get a Task Done</button>
        </div>
      </div>

      {/* Credit progress to 100 */}
      {creditProgress && (
        <div className="kc-card p-4 mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Credits → 100</span>
            <span className="text-sm font-bold text-maroon">{creditProgress.balance} / 100</span>
          </div>
          <div className="w-full bg-parchment rounded-full h-2">
            <div className="bg-maroon h-2 rounded-full" style={{ width: `${Math.min(100, creditProgress.balance)}%` }} />
          </div>
          <p className="text-xs text-muted mt-2">{creditProgress.nextAction}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {creditProgress.tiers.map(t => (
              <span key={t.name} className={`kc-badge ${t.earned?'kc-badge-leaf':'kc-badge-neutral'} text-[11px]`}>{t.name} {t.earned?'✓':`+${t.credits}`}</span>
            ))}
          </div>
        </div>
      )}

      <div className="text-center mb-10">
        <p className="text-maroon text-xs font-bold uppercase tracking-[0.2em] mb-2">कौशलचक्र</p>
        <h1 className="kc-display text-4xl font-bold text-ink">
          {status.status === 'proposed' && 'Match found!'}
          {status.status === 'confirmed' && 'Exchange confirmed'}
          {status.status === 'completed' && 'Exchange completed'}
          {status.status === 'waiting' && 'You are in the waiting pool'}
          {status.status === 'no-profile' && 'Set up your skills first'}
        </h1>
        <p className="text-muted mt-2">
          {status.status === 'proposed' &&
            'A fair multi-person cycle is waiting for everyone to accept it.'}
          {status.status === 'confirmed' &&
            'Everyone accepted — contact details are now visible to all participants.'}
          {status.status === 'completed' &&
            'Both sides of the exchange are done. Rate your partners and leave a review.'}
          {status.status === 'waiting' &&
            'No cycle fits you right now. You will be matched automatically when someone new joins or skills change.'}
          {status.status === 'no-profile' && 'Pick the skills you can teach and want to learn.'}
        </p>
      </div>

      {status.status === 'no-profile' && (
        <div className="text-center">
          <button onClick={() => navigate('/skills')} className="kc-btn">
            Choose skills
          </button>
        </div>
      )}

      {status.status === 'waiting' && (
        <div className="kc-card p-8 text-center space-y-4">
          <div className="kc-seal mx-auto w-14 h-14 text-maroon text-2xl">↻</div>
          <p className="text-muted text-sm">
            {exchangeType==='TASK' ? (
              <>No task swap found. <Link to="/tasks" className="kc-link">Browse tasks</Link> or <Link to="/tasks" className="kc-link">post one</Link> to get work done.</>
            ) : (
              <>Meanwhile, <Link to="/skills" className="kc-link">tune your skills</Link> to unlock more cycles, or{' '}<Link to="/credits" className="kc-link">teach now and earn a credit</Link> instead of waiting.</>
            )}
          </p>
          <button onClick={runMatching} disabled={busy} className="kc-btn">
            {busy ? 'Searching for cycles…' : 'Run matching now'}
          </button>
          {error && (
            <p className="kc-alert-error">{error}</p>
          )}
        </div>
      )}

      {(status.status === 'proposed' || status.status === 'confirmed' || status.status === 'completed') && (
        <div className="space-y-6">
          <div className="kc-card p-6">
            <div className="kc-rule mb-4"><em className="not-italic text-xs font-semibold uppercase tracking-widest text-muted">Your part in this cycle</em><span /></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl p-4 border border-line bg-maroon/[0.04]">
                <p className="text-xs text-maroon font-bold uppercase tracking-wide">You teach</p>
                <p className="kc-display text-2xl font-bold text-ink mt-1">{status.myParticipant.teachesSkill.name}</p>
                <p className="text-sm text-muted mt-1">
                  to {status.cycle.participants.find((p) => p.learnsSkillId === status.myParticipant.teachesSkillId)?.user?.name ?? 'your partner'}
                </p>
              </div>
              <div className="rounded-xl p-4 border border-line bg-leaf/[0.06]">
                <p className="text-xs text-leaf font-bold uppercase tracking-wide">You learn</p>
                <p className="kc-display text-2xl font-bold text-ink mt-1">{status.myParticipant.learnsSkill.name}</p>
                <p className="text-sm text-muted mt-1">
                  from {status.cycle.participants.find((p) => p.teachesSkillId === status.myParticipant.learnsSkillId)?.user?.name ?? 'your partner'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted">
              <span
                className={`kc-badge ${
                  status.cycle.status === 'completed' || status.cycle.status === 'confirmed'
                    ? 'kc-badge-leaf'
                    : 'kc-badge-amber'
                }`}
              >
                {status.cycle.status === 'completed'
                  ? '✓ Completed'
                  : status.cycle.status === 'confirmed'
                    ? '✓ Confirmed'
                    : '⏳ Proposed — awaiting acceptances'}
              </span>
            </div>
          </div>

          <div className="text-center">
            <Link to={`/match/${status.cycle.id}`} className="kc-btn">
              {status.cycle.status === 'proposed' ? 'Review the full cycle' : 'View exchange details'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
