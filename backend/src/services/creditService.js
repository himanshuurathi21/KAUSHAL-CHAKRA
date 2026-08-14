/**
 * Credit fallback service (Phase 3).
 * Pure helpers + the DB-facing logic for one-off "teach now / redeem"
 * sessions between an unmatched user and a willing partner.
 *
 * Ledger semantics:
 *   +1 'teach_now' — the teacher completes a one-off lesson (no cycle)
 *   -1 'redeem'    — the learner reserves a credit when requesting a lesson
 */
const prisma = require('../lib/prisma');

/** Balance = sum of every ledger delta for a user. */
function computeBalance(entries) {
  return entries.reduce((sum, entry) => sum + entry.delta, 0);
}

/** A redemption is only possible when the user actually has a credit. */
function canRedeem(balance) {
  return balance >= 1;
}

/**
 * Pick the best available partner for a one-sided session:
 *   role 'teacher' -> a user who OFFERS the skill (they will teach it)
 *   role 'learner' -> a user who WANTS the skill (they will learn it)
 *
 * Users already inside a proposed/confirmed cycle are excluded, as is
 * the caller themselves. Returns the first available user id or null.
 */
async function findAvailablePartner(role, skillId, excludeUserId) {
  const wantsOrOffers = role === 'teacher' ? 'wanted' : 'offered';
  const candidates = await prisma.user.findMany({
    where: { [wantsOrOffers]: { some: { skillId } } },
    select: { id: true },
  });

  const activeRows = await prisma.matchCycleParticipant.findMany({
    where: { cycle: { status: { in: ['proposed', 'confirmed'] } } },
    select: { userId: true },
  });
  const busy = new Set(activeRows.map((r) => r.userId));
  busy.add(excludeUserId);

  return candidates.find((u) => !busy.has(u.id))?.id ?? null;
}

/** True when the caller has an open proposed/confirmed cycle (is "matched"). */
async function hasActiveCycle(userId) {
  const participant = await prisma.matchCycleParticipant.findFirst({
    where: { userId, cycle: { status: { in: ['proposed', 'confirmed'] } } },
    select: { id: true },
  });
  return participant !== null;
}

/** A user must have waited this many days since signup before using credits. */
function hasWaitedLongEnough(user, minWaitDays) {
  if (!minWaitDays || minWaitDays <= 0) return true;
  const ageMs = Date.now() - new Date(user.createdAt).getTime();
  return ageMs >= minWaitDays * 24 * 60 * 60 * 1000;
}

module.exports = {
  computeBalance,
  canRedeem,
  findAvailablePartner,
  hasActiveCycle,
  hasWaitedLongEnough,
};
