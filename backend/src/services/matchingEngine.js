/**
 * =====================================================================
 * KaushalChakra — Cyclic Matching Engine
 * =====================================================================
 * This module is the CORE of the project. It is intentionally pure —
 * no database, no framework dependencies — so it can be unit-tested
 * in isolation and reused anywhere.
 *
 * The problem it solves:
 *   A and B both want something. Direct matching only works when
 *   "A wants what B offers AND B wants what A offers" — which is a
 *   2-node cycle and is found too. Beyond that we look for a CYCLE of
 *   2+ users where every user's "wanted" skill is taught by the NEXT
 *   user in the cycle, forming a closed loop:
 *
 *   You teach Python to Simran
 *   Simran teaches Photography to Rohan
 *   Rohan teaches Guitar to You        <- closed loop, everyone wins
 *
 * Algorithm overview (bounded-depth DFS):
 *   1. Build a directed graph: node = user, edge U -> V exists when
 *      V offers a skill that U wants (edge carries the skill id).
 *   2. From each user run a DFS with a depth bound (max cycle length).
 *      A cycle is found when the DFS returns to the start node with
 *      path length >= 3.
 *   3. Duplicate cycles (same user set, found from different starts)
 *      are de-duplicated with a canonical signature.
 *   4. A greedy pass picks the shortest disjoint cycles so each user
 *      participates in at most one match at a time.
 * =====================================================================
 */

/** Default bounds for the DFS. Cycle length = number of users involved. */
const DEFAULTS = { minLength: 2, maxLength: 5 };

/**
 * Build the directed graph.
 *
 * @param {Array<{id: number, offered: number[], wanted: number[]}>} users
 *   Each user exposes their skill ids as `offered` (can teach) and
 *   `wanted` (want to learn).
 * @param {Object} [options]
 * @param {Array<{fromUserId: number, toUserId: number}>} [options.blockedEdges]
 *   Edges a user has previously rejected — they are excluded from the
 *   graph so we never re-propose the same swap.
 * @param {Set<number>} [options.skipUserIds]
 *   Users already inside a proposed/confirmed cycle are excluded from
 *   matching until that cycle resolves.
 * @returns {Map<number, Map<number, number>>}
 *   adjacency map: userId -> (neighborId -> skillId taught by neighbor)
 */
function buildGraph(users, { blockedEdges = [], skipUserIds = new Set() } = {}) {
  // index: skillId -> list of userIds who OFFER that skill
  const offeredBySkill = new Map();
  for (const user of users) {
    if (skipUserIds.has(user.id)) continue;
    for (const skillId of user.offered) {
      if (!offeredBySkill.has(skillId)) offeredBySkill.set(skillId, []);
      offeredBySkill.get(skillId).push(user.id);
    }
  }

  const blocked = new Set();
  for (const { fromUserId, toUserId } of blockedEdges) {
    blocked.add(`${fromUserId}->${toUserId}`);
  }

  // adjacency: for every wanted skill, connect the user to everyone offering it
  const adjacency = new Map();
  for (const user of users) {
    if (skipUserIds.has(user.id)) continue;
    adjacency.set(user.id, new Map());
    for (const skillId of user.wanted) {
      for (const teacherId of offeredBySkill.get(skillId) ?? []) {
        if (teacherId === user.id) continue;                 // can't teach yourself
        if (blocked.has(`${user.id}->${teacherId}`)) continue; // rejected edge
        if (!adjacency.get(user.id).has(teacherId)) {
          adjacency.get(user.id).set(teacherId, skillId);
        }
      }
    }
  }
  return adjacency;
}

/**
 * Find all cycles of length in [minLength, maxLength].
 *
 * Bounded-depth DFS: from every start node we walk the graph, never
 * revisiting a node inside the current path, and record a cycle when
 * we can step back to the start. The depth bound keeps the search
 * polynomial and configurable (default max length 5).
 *
 * @param {Map<number, Map<number, number>>} graph adjacency from buildGraph
 * @returns {Array<{userIds: number[], edges: Array<{fromUserId: number, toUserId: number, skillId: number}>}>}
 */
function findCycles(graph, { minLength = DEFAULTS.minLength, maxLength = DEFAULTS.maxLength } = {}) {
  const cycles = [];
  const seenSignatures = new Set();

  for (const start of graph.keys()) {
    const path = [start];        // current walk: path[0] is always `start`
    const inPath = new Set([start]);
    const pathSkills = [];       // pathSkills[i] = skill id for edge path[i] -> path[i+1]

    const dfs = (current) => {
      const neighbors = graph.get(current);
      if (!neighbors) return;

      for (const [next, skillId] of neighbors) {
        if (next === start) {
          // Back at the starting node: valid cycle only if it has
          // enough members (>= 2 users — a direct swap counts too).
          if (path.length >= minLength && path.length <= maxLength) {
            recordCycle(path, pathSkills, skillId);
          }
          continue;
        }
        // Keep exploring only while the depth bound allows
        if (!inPath.has(next) && path.length < maxLength) {
          path.push(next);
          pathSkills.push(skillId);
          inPath.add(next);
          dfs(next);
          inPath.delete(next);
          pathSkills.pop();
          path.pop();
        }
      }
    };

    dfs(start);
  }

  return cycles;

  /** De-duplicate: the same user set found from different start nodes. */
  function recordCycle(userIds, walkSkills, closingSkill) {
    const signature = [...userIds].sort((a, b) => a - b).join(',');
    if (seenSignatures.has(signature)) return;
    seenSignatures.add(signature);

    // walkSkills has one entry per hop ALONG the path (n-1 entries);
    // closingSkill is the skill on the final hop back to the start node.
    const edges = [];
    for (let i = 0; i < userIds.length; i++) {
      edges.push({
        fromUserId: userIds[i],
        toUserId: userIds[(i + 1) % userIds.length],
        skillId: i < walkSkills.length ? walkSkills[i] : closingSkill,
      });
    }
    cycles.push({ userIds: [...userIds], edges });
  }
}

/**
 * End-to-end matching: build the graph, find cycles, and greedily pick
 * the shortest disjoint cycles so every user is in at most one match.
 *
 * Optional tie-breaker (used by the DB-facing service for proficiency):
 * pass `options.levelScore(cycle) -> number` and, among cycles of the
 * same length, the higher-scoring cycle wins the greedy pick.
 *
 * @returns {Array} chosen cycles (same shape as findCycles output)
 */
function matchUsers(users, options = {}) {
  const graph = buildGraph(users, options);
  const allCycles = findCycles(graph, options);
  const levelScore = typeof options.levelScore === 'function' ? options.levelScore : null;
  const availabilityScore = typeof options.availabilityScore === 'function' ? options.availabilityScore : null;

  // Prefer shorter cycles (fewer people to co-ordinate), then the
  // optional proficiency tie-breaker, then a deterministic user-id order.
  allCycles.sort(
    (a, b) =>
      a.userIds.length - b.userIds.length ||
      (levelScore ? levelScore(b) - levelScore(a) : 0) ||
        (availabilityScore ? availabilityScore(b) - availabilityScore(a) : 0) ||
      a.userIds[0] - b.userIds[0]
  );

  const chosen = [];
  const used = new Set();
  for (const cycle of allCycles) {
    if (cycle.userIds.some((id) => used.has(id))) continue; // user already matched
    cycle.userIds.forEach((id) => used.add(id));
    chosen.push(cycle);
  }
  return chosen;
}

module.exports = { buildGraph, findCycles, matchUsers, DEFAULTS };
