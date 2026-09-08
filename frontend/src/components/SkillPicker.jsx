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
            className={`kc-chip transition-all cursor-pointer ${
              isOn
                ? 'bg-maroon border-maroon-deep text-white shadow-md shadow-maroon/25'
                : 'hover:border-maroon/50'
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
