/**
 * Multi-select chip grid over the fixed skill taxonomy.
 * - skills:  [{id, name}, ...] full taxonomy
 * - selected: Set of skill ids
 * - onToggle: (skillId) => void
 */
export default function SkillPicker({ skills = [], selected = new Set(), onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => {
        const isOn = selected.has(skill.id);
        return (
          <button
            key={skill.id}
            type="button"
            onClick={() => onToggle(skill.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all cursor-pointer ${
              isOn
                ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/30 scale-105'
                : 'bg-white/5 border-white/10 text-indigo-100 hover:border-indigo-400/60'
            }`}
          >
            {isOn ? '✓ ' : ''}
            {skill.name}
          </button>
        );
      })}
    </div>
  );
}
