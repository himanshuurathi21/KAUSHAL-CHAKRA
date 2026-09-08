/**
 * Unit tests for the rating adjacency rule.
 * In a 4-person cycle A -> B -> C -> D -> A each user only directly
 * exchanges with their immediate neighbors (A with B and D, never with C),
 * so ratings must be restricted to adjacent pairs. Pure logic — no DB.
 */
import { describe, it, expect } from 'vitest';
import { canRateEachOther } from '../src/services/ratingService.js';

// 4-person chain: A teaches 10 to B, B teaches 20 to C, C teaches 30 to D,
// D teaches 40 to A. Each row: { userId, teachesSkillId, learnsSkillId }.
const cycle = [
  { userId: 1, teachesSkillId: 10, learnsSkillId: 40 }, // A
  { userId: 2, teachesSkillId: 20, learnsSkillId: 10 }, // B
  { userId: 3, teachesSkillId: 30, learnsSkillId: 20 }, // C
  { userId: 4, teachesSkillId: 40, learnsSkillId: 30 }, // D
];

describe('rating adjacency — 4-person cycle', () => {
  it('allows adjacent pairs to rate each other', () => {
    // A taught B / B learned from A
    expect(canRateEachOther(cycle, 1, 2)).toBe(true);
    expect(canRateEachOther(cycle, 2, 1)).toBe(true);
    // A learned from D / D taught A
    expect(canRateEachOther(cycle, 1, 4)).toBe(true);
    expect(canRateEachOther(cycle, 4, 1)).toBe(true);
    // B <-> C
    expect(canRateEachOther(cycle, 2, 3)).toBe(true);
    expect(canRateEachOther(cycle, 3, 2)).toBe(true);
    // C <-> D
    expect(canRateEachOther(cycle, 3, 4)).toBe(true);
    expect(canRateEachOther(cycle, 4, 3)).toBe(true);
  });

  it('blocks non-adjacent users in the same cycle', () => {
    // A never directly exchanges with C (nor B with D)
    expect(canRateEachOther(cycle, 1, 3)).toBe(false);
    expect(canRateEachOther(cycle, 3, 1)).toBe(false);
    expect(canRateEachOther(cycle, 2, 4)).toBe(false);
    expect(canRateEachOther(cycle, 4, 2)).toBe(false);
  });

  it('blocks users outside the cycle', () => {
    expect(canRateEachOther(cycle, 1, 99)).toBe(false);
    expect(canRateEachOther(cycle, 99, 1)).toBe(false);
  });

  it('blocks self-rating', () => {
    expect(canRateEachOther(cycle, 1, 1)).toBe(false);
  });

  it('blocks pairs with no direct edge even when a skill id coincides', () => {
    // B learns Python(10) from A, but D also teaches Python(10) to C.
    // Old skill-equality logic let B rate D; edge resolution blocks it
    // because B's actual teacher is A.
    const tricky = [
      { userId: 1, teachesSkillId: 10, learnsSkillId: 40 }, // A teaches Python to B
      { userId: 2, teachesSkillId: 20, learnsSkillId: 10 }, // B learns Python from A
      { userId: 3, teachesSkillId: 30, learnsSkillId: 10 }, // C learns Python from D
      { userId: 4, teachesSkillId: 10, learnsSkillId: 30 }, // D teaches Python to C
    ];
    expect(canRateEachOther(tricky, 2, 4)).toBe(false);
    expect(canRateEachOther(tricky, 2, 3)).toBe(false);
    // Real edges still work: A<->B, C<->D
    expect(canRateEachOther(tricky, 1, 2)).toBe(true);
    expect(canRateEachOther(tricky, 2, 1)).toBe(true);
    expect(canRateEachOther(tricky, 3, 4)).toBe(true);
    expect(canRateEachOther(tricky, 4, 3)).toBe(true);
  });
});
