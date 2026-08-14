/**
 * Unit tests for the Phase 3 credit fallback service.
 * Pure logic only — no database required.
 */
import { describe, it, expect } from 'vitest';
import { computeBalance, canRedeem, hasWaitedLongEnough } from '../src/services/creditService.js';

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
