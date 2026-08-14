import { useEffect, useState } from 'react';
import api from '../api/client';

/**
 * Phase 3 — Credit fallback page.
 * Unmatched users can teach now and earn a credit, or redeem a credit to
 * be taught a wanted skill, instead of waiting for a cycle to form.
 */
export default function Credits() {
  const [data, setData] = useState(null);
  const [skills, setSkills] = useState([]);
  const [teachSkill, setTeachSkill] = useState('');
  const [redeemSkill, setRedeemSkill] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get('/credits')
      .then(({ data }) => setData(data))
      .catch(() => {});

  useEffect(() => {
    load();
    api.get('/skills').then(({ data }) => setSkills(data.skills)).catch(() => {});
  }, []);

  const act = async (fn) => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const teach = () =>
    act(async () => {
      const { data } = await api.post('/credits/teach', { skillId: Number(teachSkill) });
      setNotice(`Session proposed — ${data.session.learner.name} will learn from you.`);
      setTeachSkill('');
    });

  const redeem = () =>
    act(async () => {
      const { data } = await api.post('/credits/redeem', { skillId: Number(redeemSkill) });
      setNotice(`Session created — ${data.session.teacher.name} will teach you.`);
      setRedeemSkill('');
    });

  const complete = (sessionId) =>
    act(async () => {
      await api.post(`/credits/sessions/${sessionId}/complete`);
      setNotice('Session completed — the teacher earned a credit.');
    });

  if (!data) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-indigo-200">Loading credits…</div>;
  }

  const { balance, ledger, sessions } = data;
  const openSessions = sessions.filter((s) => s.status === 'proposed');

  const card = 'bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Credits</h1>
        <p className="text-indigo-200 text-sm mt-1">
          No cycle around your skill? Teach now and earn a credit, or spend a credit to
          learn a wanted skill — no waiting for a full exchange cycle.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card}>
          <p className="text-indigo-300 text-xs uppercase tracking-wider">Your balance</p>
          <p className="text-4xl font-bold text-white">{balance}</p>
          <p className="text-indigo-300/70 text-xs">
            Earn 1 credit per one-off lesson taught · spend 1 to redeem a lesson
          </p>
        </div>
        <div className={card}>
          <p className="text-indigo-300 text-xs uppercase tracking-wider">Open sessions</p>
          <p className="text-4xl font-bold text-white">{openSessions.length}</p>
          <p className="text-indigo-300/70 text-xs">
            {sessions.length} session(s) total
          </p>
        </div>
      </div>

      {(error || notice) && (
        <p
          className={`text-sm border rounded-lg px-3 py-2 ${
            error
              ? 'text-rose-300 bg-rose-500/10 border-rose-400/30'
              : 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30'
          }`}
        >
          {error || notice}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card}>
          <h2 className="text-white font-semibold">Teach now → earn 1 credit</h2>
          <p className="text-indigo-300/70 text-xs">
            Pick a skill you offer. We pair you with someone who wants it — you teach,
            they learn, and you earn a credit once the session is complete.
          </p>
          <select
            value={teachSkill}
            onChange={(e) => setTeachSkill(e.target.value)}
            className="w-full bg-indigo-900/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-400/60 cursor-pointer"
          >
            <option value="">Select a skill you can teach…</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={teach}
            disabled={busy || !teachSkill}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            Start teaching
          </button>
        </div>

        <div className={card}>
          <h2 className="text-white font-semibold">Redeem 1 credit → learn now</h2>
          <p className="text-indigo-300/70 text-xs">
            Pick a skill you want to learn. We pair you with a teacher who offers it —
            your credit is spent when the lesson is requested.
          </p>
          <select
            value={redeemSkill}
            onChange={(e) => setRedeemSkill(e.target.value)}
            className="w-full bg-indigo-900/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-400/60 cursor-pointer"
          >
            <option value="">Select a skill you want to learn…</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={redeem}
            disabled={busy || !redeemSkill}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            Redeem for a lesson
          </button>
        </div>
      </div>

      <div className={card}>
        <h2 className="text-white font-semibold">Credit sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-indigo-300/70 text-sm">No credit sessions yet.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-2 text-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2"
                >                  <span className="text-indigo-100">
                    <b className="text-white">{s.teacher.name}</b> teaches{' '}
                    <span className="text-emerald-300">{s.skill.name}</span> to{' '}
                    <b className="text-white">{s.learner.name}</b>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      s.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {s.status === 'completed' ? 'Completed' : 'Proposed'}
                  </span>
                  {s.status === 'proposed' && (
                    <button
                      onClick={() => complete(s.id)}
                      disabled={busy}
                      className="ml-auto px-3 py-1 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer"
                    >
                      Mark complete
                    </button>
                  )}
                </li>
            ))}
          </ul>
        )}
      </div>

      {ledger.length > 0 && (
        <div className={card}>
          <h2 className="text-white font-semibold">Credit history</h2>
          <ul className="space-y-1 text-sm">
            {ledger.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between text-indigo-200">
                <span>
                  {entry.delta > 0 ? 'Earned' : 'Spent'} — {entry.reason}
                </span>
                <span className={`font-bold ${entry.delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
