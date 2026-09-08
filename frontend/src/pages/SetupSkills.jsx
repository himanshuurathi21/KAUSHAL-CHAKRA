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
          className="flex items-center gap-2 bg-white border border-line rounded-lg pl-3 pr-1.5 py-1.5 text-sm text-ink"
        >
          {skill.name}
          {verifiedIds?.has(skill.id) && (
            <span className="text-leaf text-xs font-bold" title="Level verified">✓</span>
          )}
          <select
            value={levels[skill.id] || fallback}
            onChange={(e) => onLevel(skill.id, e.target.value)}
            className="bg-parchment border border-line rounded-md text-xs text-ink px-1.5 py-1 cursor-pointer"
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

  const section = 'kc-card p-6 space-y-4';
  const sectionTitle = 'kc-display text-lg text-ink font-bold flex items-center gap-2';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="kc-display text-3xl font-bold text-ink">Pick your skills</h1>
        <p className="text-muted text-sm mt-1">
          Choose from the fixed taxonomy — no free-text, so matching stays precise.
          Set your proficiency level for each skill; it is used to pick the
          best-fit cycle when several are possible. Saving re-runs matching.
        </p>
      </div>

      {user && user.name && (
        <p className="text-muted text-sm">
          Signed in as <span className="text-ink font-semibold">{user.name}</span>
        </p>
      )}

      {skillsError && (
        <p className="kc-alert-error">
          {skillsError} Nothing is selectable until the list loads.
        </p>
      )}
      {skillsLoading && (
        <p className="text-muted text-sm">Loading the skill taxonomy…</p>
      )}

      <div className={section}>
        <h2 className={sectionTitle}>
          <span className="kc-seal w-7 h-7 text-maroon text-sm">→</span>
          Skills you can teach
        </h2>
        <SkillPicker skills={skills} selected={offered} onToggle={(id) => toggle(setOffered, setOfferedLevels, 'INTERMEDIATE', id)} />
        <LevelEditor skills={skills} selected={offered} levels={offeredLevels} fallback="INTERMEDIATE" verifiedIds={verifiedIds} onLevel={(id, l) => setLevel(setOfferedLevels, id, l)} />
        <p className="text-muted text-xs">
          Prove a level with a quiz or certificate in <Link to="/verify" className="kc-link">Verify Skills</Link> to earn a ✓ badge.
        </p>
      </div>

      <div className={section}>
        <h2 className={sectionTitle}>
          <span className="kc-seal w-7 h-7 text-leaf text-sm">←</span>
          Skills you want to learn
        </h2>
        <SkillPicker skills={skills} selected={wanted} onToggle={(id) => toggle(setWanted, setWantedLevels, 'BEGINNER', id)} />
        <LevelEditor skills={skills} selected={wanted} levels={wantedLevels} fallback="BEGINNER" onLevel={(id, l) => setLevel(setWantedLevels, id, l)} />
      </div>

      {error && (
        <p className="kc-alert-error">{error}</p>
      )}
      {notice && (
        <p className="kc-alert-ok">{notice}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="kc-btn"
        >
          {busy ? 'Saving…' : 'Save skills'}
        </button>
        <button
          onClick={() => navigate('/')}
          className="kc-btn kc-btn-ghost"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
