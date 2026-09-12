import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

/**
 * Phase 3 — Credit fallback page.
 * Unmatched users can teach now and earn a credit, or redeem a credit to
 * be taught a wanted skill, instead of waiting for a full exchange cycle.
 */
export default function Credits() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [teachSkill, setTeachSkill] = useState('');
  const [redeemSkill, setRedeemSkill] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoadError('');
    try {
      const [{ data: c }, { data: p }] = await Promise.all([
        api.get('/credits'),
        api.get('/profile'),
      ]);
      setData(c);
      setProfile(p.user);
    } catch {
      setLoadError('Could not load credits. Check your connection and retry.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id, fn, doneMsg) => {
    setError('');
    setNotice('');
    setBusyId(id);
    try {
      const msg = await fn();
      setNotice(doneMsg || msg);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const teach = () =>
    act('teach', async () => {
      const { data } = await api.post('/credits/teach', { skillId: Number(teachSkill) });
      setTeachSkill('');
      return `Session proposed — ${data.session.learner.name} will learn from you.`;
    });

  const redeem = () =>
    act('redeem', async () => {
      const { data } = await api.post('/credits/redeem', { skillId: Number(redeemSkill) });
      setRedeemSkill('');
      return `Session created — ${data.session.teacher.name} will teach you.`;
    });

  const accept = (sessionId) =>
    act(`accept-${sessionId}`, async () => {
      await api.post(`/credits/sessions/${sessionId}/accept`);
      return 'Session accepted — you can now complete it.';
    });

  const decline = (sessionId) =>
    act(`decline-${sessionId}`, async () => {
      await api.post(`/credits/sessions/${sessionId}/decline`);
      return 'Session declined — credit refunded if you redeemed.';
    });

  const complete = (sessionId) =>
    act(`complete-${sessionId}`, async () => {
      const { data } = await api.post(`/credits/sessions/${sessionId}/complete`);
      return data.session.status === 'completed'
        ? 'Session completed — the teacher earned a credit.'
        : 'Marked done — waiting for the other side to confirm.';
    });

  const isResponder = (s) =>
    (s.createdBy === 'teacher' && s.learnerId === user?.id) ||
    (s.createdBy === 'learner' && s.teacherId === user?.id);

  const mySideDone = (s) =>
    (s.teacherId === user?.id && s.teacherDoneAt) || (s.learnerId === user?.id && s.learnerDoneAt);

  const canComplete = (s) => s.status === 'active' && !mySideDone(s) &&
    (s.teacherId === user?.id || s.learnerId === user?.id);

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="kc-display text-3xl font-bold text-ink">Credits</h1>
        <p className="kc-alert-error inline-block">{loadError}</p>
        <div>
          <button onClick={load} className="kc-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-muted">Loading credits…</div>;
  }

  const { balance, ledger, sessions } = data;
  const safeSessions = sessions ?? [];
  const safeLedger = ledger ?? [];
  // Proposed AND active sessions both need attention.
  const openSessions = safeSessions.filter((s) => s.status === 'proposed' || s.status === 'active');
  const teachOptions = profile?.offered ?? [];
  const redeemOptions = profile?.wanted ?? [];

  const card = 'kc-card p-5 space-y-4';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="kc-display text-3xl font-bold text-ink">Credits</h1>
        <p className="text-muted text-sm mt-1">
          No cycle around your skill? Teach now and earn a credit, or spend a credit to
          learn a wanted skill — no waiting for a full exchange cycle.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card}>
          <p className="text-muted text-xs uppercase tracking-wider">Your balance</p>
          <p className="kc-display text-5xl font-bold text-maroon">{balance}</p>
          <p className="text-muted text-xs">
            Earn 1 credit per one-off lesson taught · spend 1 to redeem a lesson
          </p>
        </div>
        <div className={card}>
          <p className="text-muted text-xs uppercase tracking-wider">Open sessions</p>
          <p className="kc-display text-5xl font-bold text-ink">{openSessions.length}</p>
          <p className="text-muted text-xs">
            {safeSessions.length} session(s) total
          </p>
        </div>
      </div>

      {openSessions.length > 0 && (
        <p className="kc-alert-warn">
          You have an open session — finish or decline it before starting another.
        </p>
      )}

      {(error || notice) && (
        <p className={error ? 'kc-alert-error' : 'kc-alert-ok'}>
          {error || notice}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card}>
          <h2 className="kc-display text-lg text-ink font-bold">Teach now → earn 1 credit</h2>
          <p className="text-muted text-xs">
            Pick a skill you offer. We pair you with someone who wants it — you teach,
            they learn, and you earn a credit once both sides mark the session done.
          </p>
          <select
            value={teachSkill}
            onChange={(e) => setTeachSkill(e.target.value)}
            className="kc-select"
          >
            <option value="">Select a skill you can teach…</option>
            {teachOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.level})
              </option>
            ))}
          </select>
          {teachOptions.length === 0 && (
            <p className="text-muted text-xs">
              You offer no skills yet. <Link to="/skills" className="kc-link">Add some in Edit Skills</Link> first.
            </p>
          )}
          <button
            onClick={teach}
            disabled={busyId !== null || !teachSkill}
            className="kc-btn kc-btn-leaf w-full"
          >
            {busyId === 'teach' ? 'Working…' : 'Start teaching'}
          </button>
        </div>

        <div className={card}>
          <h2 className="kc-display text-lg text-ink font-bold">Redeem 1 credit → learn now</h2>
          <p className="text-muted text-xs">
            Pick a skill you want to learn. We pair you with a teacher who offers it —
            your credit is spent when the lesson is requested.
          </p>
          <select
            value={redeemSkill}
            onChange={(e) => setRedeemSkill(e.target.value)}
            className="kc-select"
          >
            <option value="">Select a skill you want to learn…</option>
            {redeemOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.level})
              </option>
            ))}
          </select>
          {redeemOptions.length === 0 && (
            <p className="text-muted text-xs">
              You want to learn nothing yet. <Link to="/skills" className="kc-link">Add some in Edit Skills</Link> first.
            </p>
          )}
          {balance < 1 && (
            <p className="text-muted text-xs">Balance is 0 — teach a lesson first to earn a credit.</p>
          )}
          <button
            onClick={redeem}
            disabled={busyId !== null || !redeemSkill || balance < 1}
            className="kc-btn w-full"
          >
            {busyId === 'redeem' ? 'Working…' : 'Redeem for a lesson'}
          </button>
        </div>
      </div>

      <div className={card}>
        <h2 className="kc-display text-lg text-ink font-bold">Credit sessions</h2>
        {safeSessions.length === 0 ? (
          <p className="text-muted text-sm">No credit sessions yet.</p>
        ) : (
          <ul className="space-y-2">
            {safeSessions.map((s) => {
              const responder = isResponder(s);
              const initiatorWaiting = s.status === 'proposed' && !responder;
              const partnerName = s.createdBy === 'teacher' ? s.learner.name : s.teacher.name;
              const skillLabel = s.skill ? s.skill.name : (s.task ? s.task.title : 'Task');
              const isTask = s.type === 'TASK';
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-2 text-sm bg-white border border-line rounded-xl px-3 py-2"
                >
                  <span className="text-muted">
                    <b className="text-ink">{s.teacher.name}</b> {isTask ? 'helps' : 'teaches'}{' '}
                    <span className="text-leaf font-medium">{skillLabel}</span> {isTask ? `(${s.task.creditValue}c)` : ''} to{' '}
                    <b className="text-ink">{s.learner.name}</b>
                    {isTask && <span className="ml-1 kc-badge kc-badge-neutral text-[10px]">TASK</span>}
                  </span>
                  <span
                    className={`kc-badge ${
                      s.status === 'completed'
                        ? 'kc-badge-leaf'
                        : s.status === 'active'
                          ? 'kc-badge-sky'
                          : s.status === 'declined'
                            ? 'kc-badge-clay'
                            : 'kc-badge-amber'
                    }`}
                  >
                    {s.status === 'completed'
                      ? 'Completed'
                      : s.status === 'active'
                        ? 'Active'
                        : s.status === 'declined'
                          ? 'Declined'
                          : 'Proposed'}
                  </span>
                  {s.status === 'proposed' && responder && (
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => accept(s.id)}
                        disabled={busyId !== null}
                        className="kc-btn kc-btn-leaf kc-btn-sm"
                      >
                        {busyId === `accept-${s.id}` ? '…' : 'Accept'}
                      </button>
                      <button
                        onClick={() => decline(s.id)}
                        disabled={busyId !== null}
                        className="kc-btn kc-btn-sm bg-clay border-[#7c2424] hover:bg-[#8a2a2a]"
                      >
                        {busyId === `decline-${s.id}` ? '…' : 'Decline'}
                      </button>
                    </div>
                  )}
                  {initiatorWaiting && (
                    <span className="ml-auto text-xs text-muted">
                      Waiting for {partnerName} to accept…
                    </span>
                  )}
                  {s.status === 'active' && mySideDone(s) && (
                    <span className="ml-auto text-xs text-muted">
                      You marked done — waiting for {partnerName} to confirm…
                    </span>
                  )}
                  {canComplete(s) && (
                    <button
                      onClick={() => complete(s.id)}
                      disabled={busyId !== null}
                      className="kc-btn kc-btn-sm ml-auto"
                    >
                      {busyId === `complete-${s.id}` ? '…' : 'Mark complete'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {safeLedger.length > 0 && (
        <div className={card}>
          <h2 className="kc-display text-lg text-ink font-bold">Credit history</h2>
          <ul className="space-y-1 text-sm">
            {safeLedger.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between text-muted">
                <span>
                  {entry.delta > 0 ? 'Earned' : 'Spent'} — {entry.reason}
                </span>
                <span className={`font-bold ${entry.delta > 0 ? 'text-leaf' : 'text-clay'}`}>
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
