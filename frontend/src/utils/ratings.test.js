import { describe, it, expect } from 'vitest';
import { ratedKeyFor, canRate, loadRated, serializeRated } from './ratings';

// 3-way cycle: me(1) teaches 10, learns 30. Teacher of 30 is user 3,
// learner of 10 is user 2 — only those two are rateable.
const participants = [
  { userId: 1, teachesSkillId: 10, learnsSkillId: 30 },
  { userId: 2, teachesSkillId: 20, learnsSkillId: 10 },
  { userId: 3, teachesSkillId: 30, learnsSkillId: 20 },
];
const me = participants[0];

describe('ratedKeyFor', () => {
  it('scopes flags per user id', () => {
    expect(ratedKeyFor(7)).toBe('kc_rated:7');
    expect(ratedKeyFor(null)).toBe('kc_rated:anon');
    expect(ratedKeyFor(undefined)).toBe('kc_rated:anon');
  });
});

describe('canRate (mirrors backend ratingService.canRateEachOther)', () => {
  it('allows rating my teacher and my learner', () => {
    expect(canRate(me, participants[2], participants)).toBe(true); // teaches what I learn
    expect(canRate(me, participants[1], participants)).toBe(true); // learns what I teach
  });

  it('rejects self-rating and nulls', () => {
    expect(canRate(me, me, participants)).toBe(false);
    expect(canRate(null, participants[1], participants)).toBe(false);
    expect(canRate(me, null, participants)).toBe(false);
  });

  it('rejects non-adjacent users in larger cycles', () => {
    const five = [
      { userId: 1, teachesSkillId: 10, learnsSkillId: 50 },
      { userId: 2, teachesSkillId: 20, learnsSkillId: 10 },
      { userId: 3, teachesSkillId: 30, learnsSkillId: 20 },
      { userId: 4, teachesSkillId: 40, learnsSkillId: 30 },
      { userId: 5, teachesSkillId: 50, learnsSkillId: 40 },
    ];
    expect(canRate(five[0], five[2], five)).toBe(false);
    expect(canRate(five[0], five[3], five)).toBe(false);
  });
});

describe('loadRated', () => {
  const mem = (initial = {}) => {
    const store = { ...initial };
    return {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    };
  };

  it('reads per-user flags and isolates accounts', () => {
    const storage = mem({ 'kc_rated:1': '[3]', 'kc_rated:2': '[4]' });
    expect([...loadRated(1, storage)]).toEqual([3]);
    expect([...loadRated(2, storage)]).toEqual([4]);
    expect([...loadRated(9, storage)]).toEqual([]);
  });

  it('returns an empty set on corrupt JSON', () => {
    const storage = mem({ 'kc_rated:1': 'not-json{{' });
    expect(loadRated(1, storage).size).toBe(0);
  });

  it('round-trips through serializeRated', () => {
    const storage = mem();
    storage.setItem('kc_rated:5', serializeRated(new Set([2, 3])));
    expect([...loadRated(5, storage)].sort()).toEqual([2, 3]);
  });
});
