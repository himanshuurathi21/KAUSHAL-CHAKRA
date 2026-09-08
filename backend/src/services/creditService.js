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
 * Users already inside a proposed/confirmed cycle, users with an open
 * (proposed/active) credit session, and the caller themselves are excluded.
 * Returns the first available user id or null.
 */
async function findAvailablePartner(role, skillId, excludeUserId) {
  const wantsOrOffers = role === 'teacher' ? 'wanted' : 'offered';
  const candidates = await prisma.user.findMany({
    where: { [wantsOrOffers]: { some: { skillId } } },
    select: { id: true },
  });

  const [activeRows, creditSessions] = await Promise.all([
    prisma.matchCycleParticipant.findMany({
      where: { cycle: { status: { in: ['proposed', 'confirmed'] } } },
      select: { userId: true },
    }),
    prisma.creditSession.findMany({
      select: { teacherId: true, learnerId: true, status: true },
    }),
  ]);
  const busy = computeBusySet(activeRows, creditSessions, excludeUserId);

  return candidates.find((u) => !busy.has(u.id))?.id ?? null;
}

/**
 * Build the set of users who cannot be auto-assigned to a new credit
 * session: everyone with an open cycle, everyone already booked in a
 * proposed/active credit session, and the caller themselves.
 */
function computeBusySet(activeRows, creditSessions, excludeUserId) {
  const busy = new Set(activeRows.map((r) => r.userId));
  for (const s of creditSessions) {
    if (!['proposed', 'active'].includes(s.status)) continue;
    busy.add(s.teacherId);
    busy.add(s.learnerId);
  }
  busy.add(excludeUserId);
  return busy;
}

/**
 * The partner who was auto-assigned to a session (the one who did NOT
 * initiate it) — only they may accept or decline it:
 *   createdBy 'teacher' -> the learner responds
 *   createdBy 'learner' -> the teacher responds
 */
function invitedPartnerId(session) {
  return session.createdBy === 'teacher' ? session.learnerId : session.teacherId;
}

/** True when a session may move to the given status. */
function canTransition(session, nextStatus) {
  if (session.status === 'proposed') {
    return nextStatus === 'active' || nextStatus === 'declined';
  }
  if (session.status === 'active') {
    return nextStatus === 'completed';
  }
  return false;
}

/**
 * Compensating ledger entry for a declined session that originated from
 * `redeem`: the learner already had a -1 reservation, so refund it.
 * Sessions created by a teacher have no up-front reservation -> null.
 */
function refundEntryFor(session) {
  if (session.createdBy !== 'learner') return null;
  return { userId: session.learnerId, delta: 1, reason: 'refund', sessionId: session.id };
}

/** True when the caller has an open proposed/confirmed cycle (is "matched"). */
async function hasActiveCycle(userId) {
  const participant = await prisma.matchCycleParticipant.findFirst({
    where: { userId, cycle: { status: { in: ['proposed', 'confirmed'] } } },
    select: { id: true },
  });
  return participant !== null;
}

/**
 * True when the caller is already booked in a proposed/active credit
 * session (as teacher or learner) — prevents double-booking the
 * initiator while they are also waiting on someone else's session.
 */
async function hasOpenCreditSession(userId) {
  const session = await prisma.creditSession.findFirst({
    where: {
      OR: [{ teacherId: userId }, { learnerId: userId }],
      status: { in: ['proposed', 'active'] },
    },
    select: { id: true },
  });
  return session !== null;
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
  computeBusySet,
  invitedPartnerId,
  canTransition,
  refundEntryFor,
  hasActiveCycle,
  hasOpenCreditSession,
  hasWaitedLongEnough,
};
