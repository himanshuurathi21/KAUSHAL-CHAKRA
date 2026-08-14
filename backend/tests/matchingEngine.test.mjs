/**
 * Unit tests for the cyclic matching engine.
 * These run purely in memory (no database) — `npm test`.
 */
import { describe, it, expect } from 'vitest';
import { buildGraph, findCycles, matchUsers } from '../src/services/matchingEngine.js';

// Helper: compact user shape used by the engine
const u = (id, offered, wanted) => ({ id, offered, wanted });

describe('buildGraph', () => {
  it('creates an edge U -> V when V offers a skill U wants', () => {
    const users = [
      u(1, [10], [20]), // wants skill 20
      u(2, [20], []),   // offers skill 20
    ];
    const graph = buildGraph(users);
    expect(graph.get(1).get(2)).toBe(20);
    expect(graph.get(2).size).toBe(0); // no outgoing edge from 2
  });

  it('does not create self-loops', () => {
    const users = [u(1, [10], [10])];
    const graph = buildGraph(users);
    expect(graph.get(1).size).toBe(0);
  });

  it('excludes blocked edges', () => {
    const users = [u(1, [10], [20]), u(2, [20], [])];
    const graph = buildGraph(users, { blockedEdges: [{ fromUserId: 1, toUserId: 2 }] });
    expect(graph.get(1).size).toBe(0);
  });

  it('excludes users in skipUserIds (already matched)', () => {
    const users = [u(1, [10], [20]), u(2, [20], [])];
    const graph = buildGraph(users, { skipUserIds: new Set([2]) });
    expect(graph.get(1).size).toBe(0); // 2 skipped -> no outgoing edge from 1
  });
});

describe('findCycles — the heart of the project', () => {
  // Classic clean 3-way cycle:
  //   1 wants 30 <- offered by 3
  //   2 wants 10 <- offered by 1
  //   3 wants 20 <- offered by 2
  const threeWay = [
    u(1, [10], [30]),
    u(2, [20], [10]),
    u(3, [30], [20]),
  ];

  it('detects a 3-user cycle and records who teaches what', () => {
    const cycles = findCycles(buildGraph(threeWay));
    expect(cycles).toHaveLength(1);
    const cycle = cycles[0];
    expect(cycle.userIds.sort()).toEqual([1, 2, 3]);

    // Edge semantics: fromUserId is the LEARNER, toUserId is the TEACHER.
    // For user 1: teaches skill 10 (to user 2), learns skill 30 (from user 3).
    const teach1 = cycle.edges.find((e) => e.toUserId === 1);
    const learn1 = cycle.edges.find((e) => e.fromUserId === 1);
    expect(teach1.skillId).toBe(10);
    expect(learn1.skillId).toBe(30);
  });

  it('finds multiple independent 3-way cycles', () => {
    const users = [
      u(1, [10], [30]), u(2, [20], [10]), u(3, [30], [20]),
      u(4, [40], [60]), u(5, [50], [40]), u(6, [60], [50]),
    ];
    const cycles = findCycles(buildGraph(users));
    expect(cycles).toHaveLength(2);
  });

  it('finds a direct 1-to-1 swap as a valid 2-person cycle', () => {
    const directSwap = [u(1, [10], [20]), u(2, [20], [10])];
    const cycles = findCycles(buildGraph(directSwap));
    expect(cycles).toHaveLength(1);
    const cycle = cycles[0];
    expect(cycle.userIds.sort()).toEqual([1, 2]);

    // Edge semantics: fromUserId is the LEARNER, toUserId is the TEACHER.
    // User 1 learns skill 20 from user 2 and teaches skill 10 to user 2.
    const teach1 = cycle.edges.find((e) => e.toUserId === 1);
    const learn1 = cycle.edges.find((e) => e.fromUserId === 1);
    expect(teach1.skillId).toBe(10);
    expect(learn1.skillId).toBe(20);
  });

  it('respects the maxLength depth bound', () => {
    const fourWay = [
      u(1, [10], [40]), u(2, [20], [10]),
      u(3, [30], [20]), u(4, [40], [30]),
    ];
    expect(findCycles(buildGraph(fourWay), { maxLength: 3 })).toHaveLength(0);
    expect(findCycles(buildGraph(fourWay), { maxLength: 4 })).toHaveLength(1);
  });

  it('de-duplicates the same cycle found from different start nodes', () => {
    const users = [
      u(1, [10], [30]), u(2, [20], [10]), u(3, [30], [20]),
    ];
    const cycles = findCycles(buildGraph(users));
    expect(cycles).toHaveLength(1);
  });

  it('does not reuse a user twice inside one cycle', () => {
    const users = [u(1, [10, 11], [30]), u(2, [20], [10]), u(3, [30, 10], [20])];
    const cycles = findCycles(buildGraph(users));
    for (const cycle of cycles) {
      const ids = cycle.userIds;
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('matchUsers (greedy selection)', () => {
  it('picks shorter cycles first and never double-assigns a user', () => {
    const users = [
      // 3-way cycle on [1,2,3]:  1 wants 30 <- 3, 3 wants 20 <- 2, 2 wants 10 <- 1
      u(1, [10], [30, 70]),
      u(2, [20], [10]),
      u(3, [30], [20]),
      // 4-way cycle [1,4,5,6] overlapping user 1:
      //   1 wants 70 <- 6, 6 wants 50 <- 5, 5 wants 40 <- 4, 4 wants 10 <- 1
      u(4, [40], [10]),
      u(5, [50], [40]),
      u(6, [70], [50]),
    ];
    const chosen = matchUsers(users);
    const assigned = chosen.flatMap((c) => c.userIds);
    expect(new Set(assigned).size).toBe(assigned.length); // no overlap
    expect(chosen[0].userIds).toContain(1); // shortest cycle wins
    expect(chosen).toHaveLength(1);          // 4-way blocked by overlap
  });

  it('uses proficiency levels as a tie-breaker between overlapping cycles', () => {
    const LEVEL_RANK = { BEGINNER: 1, INTERMEDIATE: 2, EXPERT: 3 };
    // Two overlapping 3-cycles on user 1:
    //   [1,3,2]: user 3 offers skill 30 at BEGINNER   (poor fit for 1)
    //   [1,5,4]: user 5 offers skill 30 at EXPERT     (good fit for 1)
    const users = [
      u(1, [10], [30]),
      u(2, [20], [10]),
      u(3, [30], [20]),
      u(4, [40], [10]),
      u(5, [30], [40]),
    ];
    const offered = new Map([
      ['1:10', 'EXPERT'], ['2:20', 'INTERMEDIATE'], ['3:30', 'BEGINNER'],
      ['4:40', 'INTERMEDIATE'], ['5:30', 'EXPERT'],
    ]);
    const wanted = new Map([
      ['1:30', 'INTERMEDIATE'], ['2:10', 'BEGINNER'], ['3:20', 'BEGINNER'],
      ['4:10', 'BEGINNER'], ['5:40', 'BEGINNER'],
    ]);
    // Score = number of edges where offered level >= wanted level
    const levelScore = (cycle) =>
      cycle.edges.filter(
        (e) =>
          LEVEL_RANK[offered.get(`${e.toUserId}:${e.skillId}`)] >=
          LEVEL_RANK[wanted.get(`${e.fromUserId}:${e.skillId}`)]
      ).length;

    // Without the tie-breaker the first-found cycle wins
    expect(matchUsers(users)[0].userIds.sort()).toEqual([1, 2, 3]);
    // With the tie-breaker the better-fit cycle wins
    expect(matchUsers(users, { levelScore })[0].userIds.sort()).toEqual([1, 4, 5]);
  });
});
