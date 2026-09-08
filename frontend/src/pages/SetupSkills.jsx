import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import SkillPicker from '../components/SkillPicker';
import { useAuth } from '../context/AuthContext';

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'EXPERT'];

// Hoisted (stable identity): defining this inside the page remounts every
// <select> on each parent render, killing focus and open dropdowns.
function LevelEditor({ skills, selected, levels, fallback, onLevel, verifiedIds }) {
  const chosen = skills.filter((s) => selected.has(s.id));
  if (chosen.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {chosen.map((skill) => (
        <label
          key={skill.id}
          className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg pl-3 pr-1.5 py-1.5 text-sm text-indigo-100"
        >
          {skill.name}
          {verifiedIds?.has(skill.id) && (
            <span className="text-emerald-300 text-xs font-bold" title="Level verified">✓</span>
          )}
          <select
            value={levels[skill.id] || fallback}
            onChange={(e) => onLevel(skill.id, e.target.value)}
            className="bg-indigo-900/60 border border-white/10 rounded-md text-xs text-white px-1.5 py-1 cursor-pointer"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

export default function SetupSkills() {
  const [skills, setSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState('');
  const [offered, setOffered] = useState(new Set());
  const [wanted, setWanted] = useState(new Set());
  const [offeredLevels, setOfferedLevels] = useState({});
  const [wantedLevels, setWantedLevels] = useState({});
  const [verifiedIds, setVerifiedIds] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const timerRef = useRef(null);

  useEffect(() => {
    api
      .get('/skills')
      .then(({ data }) => setSkills(data.skills))
      .catch(() => setSkillsError('Could not load the skill list.'))
      .finally(() => setSkillsLoading(false));
    // prefill from the current profile if it exists
    api
      .get('/profile')
      .then(({ data }) => {
        setOffered(new Set(data.user.offered.map((s) => s.id)));
        setWanted(new Set(data.user.wanted.map((s) => s.id)));
        setOfferedLevels(
          Object.fromEntries(data.user.offered.map((s) => [s.id, s.level ?? 'INTERMEDIATE']))
        );
        setWantedLevels(
          Object.fromEntries(data.user.wanted.map((s) => [s.id, s.level ?? 'BEGINNER']))
        );
      })
      .catch(() => {});
    api
      .get('/verify/mine')
      .then(({ data }) =>
        setVerifiedIds(
          new Set(data.verifications.filter((v) => v.status === 'approved').map((v) => v.skillId))
        )
      )
      .catch(() => {});
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const toggle = (setter, setLevels, defaultLevel, id) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLevels((prev) => (prev[id] ? prev : { ...prev, [id]: defaultLevel }));
  };

  const setLevel = (setLevels, id, level) => setLevels((prev) => ({ ...prev, [id]: level }));

  const save = async () => {
    setError('');
    if (skillsLoading) return;
    if (offered.size === 0 || wanted.size === 0) {
      setError('Pick at least one skill to teach and one to learn.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.put('/profile/skills', {
        offered: [...offered].map((id) => ({ id, level: offeredLevels[id] || 'INTERMEDIATE' })),
        wanted: [...wanted].map((id) => ({ id, level: wantedLevels[id] || 'BEGINNER' })),
      });
      await refresh();
      setNotice(`Saved. Matching engine proposed ${data.newCyclesProposed} new cycle(s).`);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => navigate('/'), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save skills');
    } finally {
      setBusy(false);
    }
  };

  const section = 'bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4';
  const sectionTitle = 'text-white font-semibold flex items-center gap-2';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Pick your skills</h1>
        <p className="text-indigo-200 text-sm mt-1">
          Choose from the fixed taxonomy — no free-text, so matching stays precise.
          Set your proficiency level for each skill; it is used to pick the
          best-fit cycle when several are possible. Saving re-runs matching.
        </p>
      </div>

      {user && user.name && (
        <p className="text-indigo-200 text-sm">
          Signed in as <span className="text-white font-semibold">{user.name}</span>
        </p>
      )}

      {skillsError && (
        <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">
          {skillsError} Nothing is selectable until the list loads.
        </p>
      )}
      {skillsLoading && (
        <p className="text-indigo-200 text-sm">Loading the skill taxonomy…</p>
      )}

      <div className={section}>
        <h2 className={sectionTitle}>
          <span className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 text-sm">→</span>
          Skills you can teach
        </h2>
        <SkillPicker skills={skills} selected={offered} onToggle={(id) => toggle(setOffered, setOfferedLevels, 'INTERMEDIATE', id)} />
        <LevelEditor skills={skills} selected={offered} levels={offeredLevels} fallback="INTERMEDIATE" verifiedIds={verifiedIds} onLevel={(id, l) => setLevel(setOfferedLevels, id, l)} />
        <p className="text-indigo-300/70 text-xs">
          Prove a level with a quiz or certificate in <Link to="/verify" className="text-indigo-300 underline">Verify Skills</Link> to earn a ✓ badge.
        </p>
      </div>

      <div className={section}>
        <h2 className={sectionTitle}>
          <span className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 text-sm">←</span>
          Skills you want to learn
        </h2>
        <SkillPicker skills={skills} selected={wanted} onToggle={(id) => toggle(setWanted, setWantedLevels, 'BEGINNER', id)} />
        <LevelEditor skills={skills} selected={wanted} levels={wantedLevels} fallback="BEGINNER" onLevel={(id, l) => setLevel(setWantedLevels, id, l)} />
      </div>

      {error && (
        <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">{error}</p>
      )}
      {notice && (
        <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-lg px-3 py-2">{notice}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {busy ? 'Saving…' : 'Save skills'}
        </button>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 text-indigo-200 hover:text-white cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
