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

  return (
    <ol className="flex flex-col gap-3">
      {chain.map((p, i) => {
        const next = chain[(i + 1) % chain.length];
        const isMe = p.userId === myUserId;
        return (
          <li key={p.id} className="flex items-center gap-3">
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3">
              <span className="flex items-center gap-2 min-w-40">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {initials(p.user.name)}
                </span>
                <span className={`font-semibold ${isMe ? 'text-amber-300' : 'text-white'}`}>
                  {isMe ? 'You' : p.user.name}
                </span>
                {!isMe && p.user.avgRating != null && (
                  <span className="text-xs text-amber-300" title={`${p.user.ratingCount} rating(s)`}>
                    ⭐ {p.user.avgRating.toFixed(1)}
                  </span>
                )}
              </span>
              <span className="text-indigo-300 text-sm whitespace-nowrap hidden sm:block">teaches</span>
              <span className="flex items-center gap-2 w-fit">
                <span className="px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-sm font-medium">
                  {p.teachesSkill.name}
                </span>
                {p.teachesLevel && (
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-indigo-200 text-[10px] font-semibold uppercase tracking-wide">
                    {p.teachesLevel}
                  </span>
                )}
              </span>
            </div>
            <span className="text-indigo-400 shrink-0">→</span>
            <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3 justify-end">
              <span className="text-indigo-300 text-sm whitespace-nowrap hidden sm:block">to</span>
              <span className="px-3 py-1 rounded-lg bg-sky-500/15 border border-sky-400/30 text-sky-300 text-sm font-medium w-fit">
                {next.userId === myUserId ? 'You' : next.user.name}
              </span>
              {next.learnsLevel && (
                <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-indigo-200 text-[10px] font-semibold uppercase tracking-wide">
                  {next.learnsLevel}
                </span>
              )}
            </div>
            {i === chain.length - 1 && <span className="text-amber-300 shrink-0">↺</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Order participants as [me -> who I teach -> who they teach -> ...] */
function buildChain(participants, myUserId) {
  const byLearns = new Map();
  for (const p of participants) byLearns.set(p.learnsSkillId, p);

  let start = participants.find((p) => p.userId === myUserId) ?? participants[0];
  const chain = [];
  const seen = new Set();
  while (start && !seen.has(start.id)) {
    seen.add(start.id);
    chain.push(start);
    start = byLearns.get(start.teachesSkillId);
  }
  return chain;
}

function initials(name) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}