import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoadError('');
    api.get('/match/status').then(({ data }) => setStatus(data)).catch(() => setLoadError('Could not reach the server.'));
  };

  useEffect(() => {
    load();
  }, []);

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
        <p className="text-rose-300">{loadError}</p>
        <button
          onClick={load}
          className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold hover:opacity-90 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-indigo-200">
        Checking your match status…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-white">
          {status.status === 'proposed' && 'Match found!'}
          {status.status === 'confirmed' && 'Exchange confirmed'}
          {status.status === 'completed' && 'Exchange completed'}
          {status.status === 'waiting' && 'You are in the waiting pool'}
          {status.status === 'no-profile' && 'Set up your skills first'}
        </h1>
        <p className="text-indigo-200 mt-2">
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
          <button
            onClick={() => navigate('/skills')}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold hover:opacity-90 cursor-pointer"
          >
            Choose skills
          </button>
        </div>
      )}

      {status.status === 'waiting' && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full border-2 border-dashed border-indigo-400 animate-spin [animation-duration:3s] flex items-center justify-center text-indigo-300 text-2xl">
            ↻
          </div>
          <p className="text-indigo-200 text-sm">
            Meanwhile, <Link to="/skills" className="text-indigo-300 underline">tune your skills</Link> to unlock more cycles, or{' '}
            <Link to="/credits" className="text-indigo-300 underline">teach now and earn a credit</Link> instead of waiting.
          </p>
          <button
            onClick={runMatching}
            disabled={busy}
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {busy ? 'Searching for cycles…' : 'Run matching now'}
          </button>
          {error && (
            <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
      )}

      {(status.status === 'proposed' || status.status === 'confirmed' || status.status === 'completed') && (
        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <p className="text-sm text-indigo-200 mb-4">
              Your part in this cycle:
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-4">
                <p className="text-xs text-emerald-300/80 uppercase tracking-wide">You teach</p>
                <p className="text-xl font-bold text-white mt-1">{status.myParticipant.teachesSkill.name}</p>
                <p className="text-sm text-indigo-200 mt-1">
                  to {status.cycle.participants.find((p) => p.learnsSkillId === status.myParticipant.teachesSkillId)?.user?.name ?? 'your partner'}
                </p>
              </div>
              <div className="bg-sky-500/10 border border-sky-400/30 rounded-xl p-4">
                <p className="text-xs text-sky-300/80 uppercase tracking-wide">You learn</p>
                <p className="text-xl font-bold text-white mt-1">{status.myParticipant.learnsSkill.name}</p>
                <p className="text-sm text-indigo-200 mt-1">
                  from {status.cycle.participants.find((p) => p.teachesSkillId === status.myParticipant.learnsSkillId)?.user?.name ?? 'your partner'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-indigo-200">
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  status.cycle.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : status.cycle.status === 'confirmed'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
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
            <Link
              to={`/match/${status.cycle.id}`}
              className="inline-block px-8 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold hover:opacity-90"
            >
              {status.cycle.status === 'proposed' ? 'Review the full cycle' : 'View exchange details'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
