/**
 * Unit tests for the Phase 3 credit fallback service.
 * Pure logic only — no database required.
 */
import { describe, it, expect } from 'vitest';
import {
  computeBalance,
  canRedeem,
  hasWaitedLongEnough,
  computeBusySet,
  invitedPartnerId,
  canTransition,
  refundEntryFor,
} from '../src/services/creditService.js';

describe('computeBalance', () => {
  it('sums all ledger deltas', () => {
    const entries = [
      { delta: 1 }, { delta: 1 }, { delta: -1 },
    ];
    expect(computeBalance(entries)).toBe(1);
  });

  it('returns 0 for an empty ledger', () => {
    expect(computeBalance([])).toBe(0);
  });

  it('allows negative balances only when overspent', () => {
    const entries = [{ delta: -1 }, { delta: -1 }];
    expect(computeBalance(entries)).toBe(-2);
  });
});

describe('canRedeem', () => {
  it('requires at least 1 credit', () => {
    expect(canRedeem(0)).toBe(false);
    expect(canRedeem(1)).toBe(true);
    expect(canRedeem(3)).toBe(true);
  });
});

describe('hasWaitedLongEnough', () => {
  const days = 1000 * 60 * 60 * 24;

  it('is immediate when the wait is disabled', () => {
    expect(hasWaitedLongEnough({ createdAt: new Date() }, 0)).toBe(true);
  });

  it('rejects users younger than the grace period', () => {
    const user = { createdAt: new Date(Date.now() - 2 * days) };
    expect(hasWaitedLongEnough(user, 7)).toBe(false);
  });

  it('accepts users older than the grace period', () => {
    const user = { createdAt: new Date(Date.now() - 10 * days) };
    expect(hasWaitedLongEnough(user, 7)).toBe(true);
  });
});

describe('credit session consent flow', () => {
  const teacherSession = { id: 1, status: 'proposed', createdBy: 'teacher', teacherId: 10, learnerId: 20 };
  const learnerSession = { id: 2, status: 'proposed', createdBy: 'learner', teacherId: 10, learnerId: 20 };

  it('only the auto-assigned partner is invited to respond', () => {
    expect(invitedPartnerId(teacherSession)).toBe(20); // teacher initiated -> learner responds
    expect(invitedPartnerId(learnerSession)).toBe(10); // learner initiated -> teacher responds
  });

  it('proposed sessions can be accepted or declined, nothing else', () => {
    expect(canTransition(teacherSession, 'active')).toBe(true);
    expect(canTransition(teacherSession, 'declined')).toBe(true);
    expect(canTransition(teacherSession, 'completed')).toBe(false);
  });

  it('active sessions can only be completed', () => {
    const active = { ...teacherSession, status: 'active' };
    expect(canTransition(active, 'completed')).toBe(true);
    expect(canTransition(active, 'declined')).toBe(false);
    expect(canTransition(active, 'active')).toBe(false);
  });

  it('completed/declined sessions are terminal', () => {
    expect(canTransition({ ...teacherSession, status: 'completed' }, 'completed')).toBe(false);
    expect(canTransition({ ...teacherSession, status: 'declined' }, 'active')).toBe(false);
    expect(canTransition({ ...teacherSession, status: 'declined' }, 'completed')).toBe(false);
  });

  it('refunds the reserved credit only when the learner initiated the session', () => {
    expect(refundEntryFor(learnerSession)).toEqual({
      userId: 20, delta: 1, reason: 'refund', sessionId: 2,
    });
    expect(refundEntryFor(teacherSession)).toBeNull();
  });
});

describe('double-booking exclusion', () => {
  const cycleRows = (userIds) => userIds.map((userId) => ({ userId }));
  const sessions = (list) =>
    list.map(([teacherId, learnerId, status]) => ({ teacherId, learnerId, status }));

  it('excludes users with an open cycle or a proposed/active credit session', () => {
    const busy = computeBusySet(
      cycleRows([1, 2]),
      sessions([[3, 4, 'proposed'], [5, 6, 'active'], [7, 8, 'completed']]),
      99
    );
    for (const id of [1, 2, 3, 4, 5, 6, 99]) expect(busy.has(id)).toBe(true);
    // completed sessions free their users again
    for (const id of [7, 8]) expect(busy.has(id)).toBe(false);
  });

  it('ignores declined credit sessions when picking partners', () => {
    const busy = computeBusySet(cycleRows([]), sessions([[2, 3, 'declined']]), 99);
    expect(busy.has(2)).toBe(false);
    expect(busy.has(3)).toBe(false);
  });
});
