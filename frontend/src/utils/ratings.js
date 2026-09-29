// Pure rating helpers (extracted from Exchanges.jsx so they are unit-testable).
// `canRate` mirrors the backend rule (ratingService.canRateEachOther): you may
// only rate the participant who teaches what you learn, or learns what you teach.

// Rated flags are per-user: two accounts sharing a browser must not see
// each other's "Rated ✓" state.
export const ratedKeyFor = (userId) => `kc_rated:${userId ?? 'anon'}`;

export const canRate = (me, other, participants) => {
  if (!me || !other || me.userId === other.userId) return false;
  const list = participants || [];
  const myTeacher = list.find((p) => p.teachesSkillId === me.learnsSkillId);
  const myLearner = list.find((p) => p.learnsSkillId === me.teachesSkillId);
  return myTeacher?.userId === other.userId || myLearner?.userId === other.userId;
};

// `storage` is injectable so tests don't touch window.localStorage.
export function loadRated(userId, storage) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return new Set();
    return new Set(JSON.parse(store.getItem(ratedKeyFor(userId))) || []);
  } catch {
    return new Set();
  }
}

export function serializeRated(ratedSet) {
  return JSON.stringify([...ratedSet]);
}
