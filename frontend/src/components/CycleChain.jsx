/**
 * Renders a match cycle as a readable closed chain, e.g.:
 *   You teach Python to Simran → Simran teaches Photography to Rohan
 *   → Rohan teaches Guitar to you
 *
 * Each skill shows the participant's proficiency level, and each user's
 * average rating is displayed as a small badge.
 *
 * Ordering is derived from the data (who teaches which skill is learned
 * by whom), so it is correct regardless of DB row order.
 */
export default function CycleChain({ participants, myUserId }) {
  const chain = buildChain(participants, myUserId);
  if (chain.length === 0) return null;

  // Check if two adjacent users share an availability slot (tie-breaker display)
  const hasOverlap = (a, b) => {
    const aSlots = new Set(a.user?.availabilitySlots || []);
    const bSlots = new Set(b.user?.availabilitySlots || []);
    for (const s of aSlots) if (bSlots.has(s)) return true;
    return false;
  };
  return (
    <ol className="flex flex-col gap-3">
      {chain.map((p, i) => {
        const next = chain[(i + 1) % chain.length];
        const isMe = p.userId === myUserId;
        const overlap = hasOverlap(p, next);
        return (
          <li key={p.id} className="flex flex-wrap items-center gap-3">
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 bg-white border border-line rounded-xl p-3">
              <span className="flex items-center gap-2 min-w-40">
                <span className="kc-seal w-8 h-8 text-maroon text-xs font-bold shrink-0">
                  {initials(p.user.name)}
                </span>
                <span className={`font-semibold ${isMe ? 'text-maroon' : 'text-ink'}`}>
                  {isMe ? 'You' : p.user.name}
                </span>
                {!isMe && p.user.avgRating != null && (
                  <span className="text-xs text-[#8a5c0e]" title={`${p.user.ratingCount} rating(s)`}>
                    ★ {p.user.avgRating.toFixed(1)}
                  </span>
                )}
              </span>
              <span className="text-muted text-sm whitespace-nowrap hidden sm:block">teaches</span>
              <span className="flex items-center gap-2 w-fit">
                <span className="px-3 py-1 rounded-lg bg-maroon/10 border border-maroon/25 text-maroon text-sm font-medium">
                  {p.teachesSkill.name}
                </span>
                {p.teachesLevel && (
                  <span className="px-2 py-0.5 rounded-md bg-parchment border border-line text-muted text-[10px] font-semibold uppercase tracking-wide">
                    {p.teachesLevel}
                  </span>
                )}
                {isVerified(p.user?.verifiedLevels, p.teachesSkillId, p.teachesLevel) && (
                  <span className="text-leaf text-xs font-bold" title="Level verified by quiz or certificate">
                    ✓
                  </span>
                )}
              </span>
            </div>
            <span className="text-maroon/60 shrink-0">→</span>
            <div className="flex-1 flex items-center gap-2 bg-white border border-line rounded-xl p-3 justify-end relative">
              <span className="text-muted text-sm whitespace-nowrap hidden sm:block">to</span>
              <span className="px-3 py-1 rounded-lg bg-leaf/10 border border-leaf/25 text-leaf text-sm font-medium w-fit">
                {next.userId === myUserId ? 'You' : next.user.name}
              </span>
              {next.learnsLevel && (
                <span className="px-2 py-0.5 rounded-md bg-parchment border border-line text-muted text-[10px] font-semibold uppercase tracking-wide">
                  {next.learnsLevel}
                </span>
              )}
              {overlap && (
                <span className="absolute -bottom-2 right-2 text-[10px] text-leaf bg-leaf/10 border border-leaf/20 px-1.5 py-0.5 rounded-full" title="You share a free slot">
                  ✓ Compatible availability
                </span>
              )}
            </div>
            {i === chain.length - 1 && <span className="text-marigold shrink-0">↺</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Order participants as [me -> who I teach -> who they teach -> ...] */
function buildChain(participants, myUserId) {
  // A skill can be learned by more than one participant (dense graphs), so
  // index by skill -> candidates instead of skill -> single participant.
  const byLearns = new Map();
  for (const p of participants) {
    const list = byLearns.get(p.learnsSkillId) ?? [];
    list.push(p);
    byLearns.set(p.learnsSkillId, list);
  }

  let start = participants.find((p) => p.userId === myUserId) ?? participants[0];
  const chain = [];
  const seen = new Set();
  while (start && !seen.has(start.id)) {
    seen.add(start.id);
    chain.push(start);
    const candidates = (byLearns.get(start.teachesSkillId) ?? []).filter((p) => !seen.has(p.id));
    start = candidates[0] ?? null;
  }

  // Ambiguous duplicate-skill cycles may not form a single closed loop —
  // append anyone we did not reach so nobody is left out of the view.
  for (const p of participants) {
    if (!seen.has(p.id)) chain.push(p);
  }
  return chain;
}

function initials(name) {
  return (name ?? '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** True when the user holds an approved verification covering this skill+level. */
function isVerified(verifiedLevels, skillId, level) {
  if (!Array.isArray(verifiedLevels)) return false;
  return verifiedLevels.some((v) => v.skillId === skillId && (!level || v.level === level));
}