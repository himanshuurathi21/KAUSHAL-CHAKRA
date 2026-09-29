/**
 * Canonical status values — single source of truth for all String status
 * columns (MatchCycle, CreditSession, TaskSwap, SkillVerification).
 *
 * The DB columns are still `String` (see schema.prisma TODO) so a Prisma enum
 * migration is a post-viva step. Until then, import these constants instead
 * of sprinkling string literals — typos become ReferenceErrors, not silent
 * DB mismatches.
 */
const MatchCycleStatus = Object.freeze({
  PROPOSED: 'proposed',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
});

const CreditSessionStatus = Object.freeze({
  PROPOSED: 'proposed',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DECLINED: 'declined',
});

const TaskSwapStatus = Object.freeze({
  REQUESTED: 'requested',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
});

const VerificationStatusValue = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

const ACTIVE_CYCLE_STATUSES = Object.freeze([
  MatchCycleStatus.PROPOSED,
  MatchCycleStatus.CONFIRMED,
]);

function isValidStatus(enumObj, value) {
  return Object.values(enumObj).includes(value);
}

module.exports = {
  MatchCycleStatus,
  CreditSessionStatus,
  TaskSwapStatus,
  VerificationStatusValue,
  ACTIVE_CYCLE_STATUSES,
  isValidStatus,
};
