import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'EXPERT'];

/**
 * Skill verification: prove a claimed proficiency level is real.
 *  - Quiz: auto-graded question bank per skill, instant verdict.
 *  - Certificate: link an external certificate, an admin reviews it.
 * Approved levels show as ✓ badges wherever skills are displayed.
 */
export default function Verify() {
  const { user } = useAuth();
  const [skills, setSkills] = useState([]);
  const [offered, setOffered] = useState([]);
  const [mine, setMine] = useState([]);
  const [pending, setPending] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Quiz state
  const [quizSkill, setQuizSkill] = useState('');
  const [quizLevel, setQuizLevel] = useState('INTERMEDIATE');
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  // Certificate form
  const [certSkill, setCertSkill] = useState('');
  const [certLevel, setCertLevel] = useState('INTERMEDIATE');
  const [certUrl, setCertUrl] = useState('');
  const [certIssuer, setCertIssuer] = useState('');
  const [certNote, setCertNote] = useState('');

  const load = async () => {
    setLoadError('');
    try {
      const [{ data: s }, { data: p }, { data: m }] = await Promise.all([
        api.get('/skills'),
        api.get('/profile'),
        api.get('/verify/mine'),
      ]);
      setSkills(s.skills);
      setOffered(p.user.offered || []);
      setMine(m.verifications);
      if (user?.isAdmin) {
        const { data: q } = await api.get('/verify/pending');
        setPending(q.verifications);
      }
    } catch {
      setLoadError('Could not load verification data. Check your connection and retry.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const statusOf = (skillId, method) => mine.find((v) => v.skillId === skillId && v.method === method);
  const approvedFor = (skillId) => mine.find((v) => v.skillId === skillId && v.status === 'approved');

  const startQuiz = async () => {
    if (!quizSkill) return;
    setError('');
    setNotice('');
    setResult(null);
    setBusy(true);
    try {
      const { data } = await api.get(`/verify/quiz/${quizSkill}`);
      setQuestions(data.questions);
      setAnswers({});
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load the quiz');
      setQuestions(null);
    } finally {
      setBusy(false);
    }
  };

  const submitQuiz = async () => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const answerList = questions.map((_, i) => answers[i] ?? -1);
      const { data } = await api.post(`/verify/quiz/${quizSkill}/submit`, {
        answers: answerList,
        claimedLevel: quizLevel,
      });
      setResult(data);
      setNotice(
        data.passed
          ? `Passed ${data.score}/${data.total} — ${quizLevel} verified ✓`
          : `Scored ${data.score}/${data.total} — below the ${quizLevel} bar. Try again!`
      );
      const { data: m } = await api.get('/verify/mine');
      setMine(m.verifications);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit the quiz');
    } finally {
      setBusy(false);
    }
  };

  const submitCertificate = async () => {
    if (!certSkill || !certUrl.trim()) {
      setError('Pick a skill and paste the certificate link.');
      return;
    }
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await api.post('/verify/certificate', {
        skillId: Number(certSkill),
        claimedLevel: certLevel,
        evidenceUrl: certUrl.trim(),
        issuer: certIssuer.trim() || undefined,
        note: certNote.trim() || undefined,
      });
      setNotice('Certificate submitted — an admin will review it soon.');
      setCertSkill('');
      setCertUrl('');
      setCertIssuer('');
      setCertNote('');
      const { data: m } = await api.get('/verify/mine');
      setMine(m.verifications);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit the certificate');
    } finally {
      setBusy(false);
    }
  };

  const review = async (id, approve) => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await api.post(`/verify/${id}/review`, { approve });
      setNotice(approve ? 'Certificate approved — badge unlocked for the user.' : 'Certificate rejected — user notified.');
      const { data: q } = await api.get('/verify/pending');
      setPending(q.verifications);
    } catch (err) {
      setError(err.response?.data?.error || 'Review failed');
    } finally {
      setBusy(false);
    }
  };

  const card = 'bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4';
  const inputCls =
    'w-full bg-indigo-900/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-indigo-400/50 outline-none focus:border-indigo-400/60';
  const selectCls = `${inputCls} cursor-pointer`;

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-bold text-white">Verify skills</h1>
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

  const quizSkillName = skills.find((s) => s.id === Number(quizSkill))?.name;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Verify skills</h1>
        <p className="text-indigo-200 text-sm mt-1">
          Prove your claimed level is real — pass a short quiz for an instant badge, or link a
          certificate for admin review. Verified levels show as ✓ wherever your skills appear.
        </p>
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

      {/* My verification status per offered skill */}
      <div className={card}>
        <h2 className="text-white font-semibold">Your offered skills</h2>
        {offered.length === 0 ? (
          <p className="text-indigo-300/70 text-sm">
            You have not offered any skills yet.{' '}
            <Link to="/skills" className="text-indigo-300 underline">Pick skills first</Link>.
          </p>
        ) : (
          <ul className="space-y-2">
            {offered.map((o) => {
              const v = approvedFor(o.id);
              const quiz = statusOf(o.id, 'QUIZ');
              const cert = statusOf(o.id, 'CERTIFICATE');
              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center gap-2 text-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2"
                >
                  <span className="text-white font-medium">{o.name}</span>
                  <span className="text-indigo-300/70 text-xs">claimed {o.level}</span>
                  {v ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">
                      ✓ Verified {v.claimedLevel}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-indigo-300">
                      Unverified
                    </span>
                  )}
                  {quiz && quiz.status === 'rejected' && (
                    <span className="text-xs text-rose-300">quiz {quiz.score}/{quiz.total}</span>
                  )}
                  {cert && cert.status === 'pending' && (
                    <span className="text-xs text-amber-300">certificate pending review</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Quiz */}
      <div className={card}>
        <h2 className="text-white font-semibold">Take a quiz → instant badge</h2>
        <p className="text-indigo-300/70 text-xs">
          Quizzes exist for popular skills (Python, JavaScript, Guitar, Photography, Piano,
          Spanish, Cooking, Excel). Score at least 40% for Beginner, 60% for Intermediate, 80%
          for Expert.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <select value={quizSkill} onChange={(e) => { setQuizSkill(e.target.value); setQuestions(null); setResult(null); }} className={selectCls}>
            <option value="">Select an offered skill…</option>
            {offered.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <select value={quizLevel} onChange={(e) => setQuizLevel(e.target.value)} className={selectCls}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        {!questions ? (
          <button
            onClick={startQuiz}
            disabled={busy || !quizSkill}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            {busy ? 'Loading…' : `Start ${quizSkillName || ''} quiz`}
          </button>
        ) : (
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                <p className="text-sm text-white font-medium">
                  {i + 1}. {q.q} <span className="text-indigo-400/60 text-xs">({q.level})</span>
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => setAnswers((a) => ({ ...a, [i]: oi }))}
                      className={`text-left text-sm px-3 py-2 rounded-lg border cursor-pointer ${
                        answers[i] === oi
                          ? 'bg-indigo-500/30 border-indigo-400/60 text-white'
                          : 'bg-indigo-900/40 border-white/10 text-indigo-100 hover:border-indigo-400/40'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={submitQuiz}
              disabled={busy || Object.keys(answers).length < questions.length}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer"
            >
              {busy ? 'Grading…' : `Submit (${Object.keys(answers).length}/${questions.length} answered)`}
            </button>
            {result && (
              <p className={`text-sm font-semibold ${result.passed ? 'text-emerald-300' : 'text-amber-300'}`}>
                {result.passed
                  ? `✓ Passed — ${result.score}/${result.total} verifies ${quizLevel}`
                  : `✗ ${result.score}/${result.total} — below the ${quizLevel} bar`}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Certificate */}
      <div className={card}>
        <h2 className="text-white font-semibold">Link a certificate → admin review</h2>
        <p className="text-indigo-300/70 text-xs">
          Got a course certificate (Coursera, Udemy, NPTEL…)? Paste its public verification link
          and an admin will approve it. No file uploads needed.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <select value={certSkill} onChange={(e) => setCertSkill(e.target.value)} className={selectCls}>
            <option value="">Select an offered skill…</option>
            {offered.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <select value={certLevel} onChange={(e) => setCertLevel(e.target.value)} className={selectCls}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <input
          value={certUrl}
          onChange={(e) => setCertUrl(e.target.value)}
          placeholder="https://coursera.org/verify/…"
          className={inputCls}
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            value={certIssuer}
            onChange={(e) => setCertIssuer(e.target.value)}
            placeholder="Issuer (e.g. NPTEL)"
            className={inputCls}
          />
          <input
            value={certNote}
            onChange={(e) => setCertNote(e.target.value)}
            placeholder="Optional note"
            className={inputCls}
          />
        </div>
        <button
          onClick={submitCertificate}
          disabled={busy || !certSkill || !certUrl.trim()}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer"
        >
          Submit for review
        </button>
      </div>

      {/* Attempt history */}
      {mine.length > 0 && (
        <div className={card}>
          <h2 className="text-white font-semibold">My attempts</h2>
          <ul className="space-y-2">
            {mine.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2 text-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                <span className="text-white font-medium">{v.skill.name}</span>
                <span className="text-indigo-300/70 text-xs">{v.method === 'QUIZ' ? 'quiz' : 'certificate'} · claimed {v.claimedLevel}</span>
                {v.method === 'QUIZ' && v.score != null && (
                  <span className="text-indigo-300/70 text-xs">{v.score}/{v.total}</span>
                )}
                <span
                  className={`ml-auto px-2 py-0.5 rounded-full text-xs font-semibold ${
                    v.status === 'approved'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : v.status === 'pending'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-rose-500/15 text-rose-300'
                  }`}
                >
                  {v.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Admin review queue */}
      {user?.isAdmin && (
        <div className={card}>
          <h2 className="text-white font-semibold">Review queue {pending.length > 0 && `(${pending.length})`}</h2>
          {pending.length === 0 ? (
            <p className="text-indigo-300/70 text-sm">Nothing waiting for review.</p>
          ) : (
            <ul className="space-y-2">
              {pending.map((v) => (
                <li key={v.id} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm space-y-1">
                  <p className="text-white font-medium">
                    {v.user.name} <span className="text-indigo-300/70 font-normal">claims {v.claimedLevel} in {v.skill.name}</span>
                  </p>
                  <p className="text-indigo-300/70 text-xs">
                    {v.method}
                    {v.evidenceUrl && (
                      <> · <a href={v.evidenceUrl} target="_blank" rel="noreferrer" className="text-sky-300 underline break-all">{v.evidenceUrl}</a></>
                    )}
                    {v.issuer && <> · {v.issuer}</>}
                    {v.note && <> · “{v.note}”</>}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => review(v.id, true)}
                      disabled={busy}
                      className="px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => review(v.id, false)}
                      disabled={busy}
                      className="px-3 py-1 rounded-lg bg-rose-500/15 border border-rose-400/40 text-rose-300 text-xs font-semibold hover:bg-rose-500/25 disabled:opacity-40 cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
