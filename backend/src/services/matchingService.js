/**
 * Matching service — the DB-facing wrapper around the pure matching engine.
 * Responsibilities:
 *   - load users + their skills (with proficiency levels) from the database
 *   - load previously rejected (blocked) edges
 *   - run the engine, apply the proficiency tie-breaker, persist proposals
 *   - enforce "one active cycle per user"
 *   - fire `match_found` notifications when a cycle is proposed
 */
const prisma = require('../lib/prisma');
const { matchUsers } = require('./matchingEngine');
const { notifyMany } = require('./notificationService');

const LEVEL_RANK = { BEGINNER: 1, INTERMEDIATE: 2, EXPERT: 3 };

/** Don't re-propose a cycle whose exact user set completed recently. */
const RECENT_COMPLETION_WINDOW_HOURS = 24;

/** Users who are currently in a proposed/confirmed cycle stay out of matching. */
async function loadActiveUserIds() {
  const rows = await prisma.matchCycleParticipant.findMany({
    where: { cycle: { status: { in: ['proposed', 'confirmed'] } } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

/**
 * Signatures of cycles completed in the last N hours, e.g. "1,2,3".
 * The engine never re-proposes the same user set within the window, so a
 * completed exchange doesn't instantly produce an identical duplicate.
 */
async function loadRecentlyCompletedSignatures(hours = RECENT_COMPLETION_WINDOW_HOURS) {
  const rows = await prisma.matchCycle.findMany({
    where: { status: 'completed', completedAt: { gte: new Date(Date.now() - hours * 60 * 60 * 1000) } },
    include: { participants: { select: { userId: true } } },
  });
  return new Set(rows.map((c) => c.participants.map((p) => p.userId).sort((a, b) => a - b).join(',')));
}

/** Load all users with their skill ids + levels, plus blocked edges. */
async function loadGraphData() {
  const [users, blocked] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        offered: { select: { skillId: true, level: true } },
        wanted: { select: { skillId: true, level: true } },
      },
    }),
    prisma.blockedEdge.findMany(),
  ]);

  const offeredLevels = new Map();
  const wantedLevels = new Map();
  for (const u of users) {
    offeredLevels.set(u.id, new Map(u.offered.map((o) => [o.skillId, o.level])));
    wantedLevels.set(u.id, new Map(u.wanted.map((w) => [w.skillId, w.level])));
  }

  return {
    users: users.map((u) => ({
      id: u.id,
      offered: u.offered.map((o) => o.skillId),
      wanted: u.wanted.map((w) => w.skillId),
    })),
    offeredLevels,
    wantedLevels,
    blockedEdges: blocked.map((e) => ({ fromUserId: e.fromUserId, toUserId: e.toUserId })),
  };
}

/**
 * Proficiency tie-breaker (Phase 2a): score a cycle by how many edges are a
 * "good fit" — the teacher's offered level is >= the learner's wanted level.
 */
function levelScoreFor({ offeredLevels, wantedLevels }) {
  return (cycle) => {
    let good = 0;
    for (const edge of cycle.edges) {
      const offered = offeredLevels.get(edge.toUserId)?.get(edge.skillId);
      const wanted = wantedLevels.get(edge.fromUserId)?.get(edge.skillId);
      if (offered && wanted && LEVEL_RANK[offered] >= LEVEL_RANK[wanted]) good++;
    }
    return good;
  };
}

/**
 * Translate an engine cycle (userIds + edges) into MatchCycleParticipant rows.
 *
 * For a cycle [a, b, c] with edges:
 *   a -> b teaches skill S1   (a learns S1)
 *   b -> c teaches skill S2   (b learns S2)
 *   c -> a teaches skill S3   (c learns S3)
 *
 * Then:
 *   a: teaches S3, learns S1
 *   b: teaches S1, learns S2
 *   c: teaches S2, learns S3
 */
function participantsFromCycle(cycle) {
  const { userIds, edges } = cycle;
  return userIds.map((userId, i) => ({
    userId,
    teachesSkillId: edges[(i - 1 + userIds.length) % userIds.length].skillId,
    learnsSkillId: edges[i].skillId,
    accepted: null,
  }));
}

/** Persist one engine cycle as a proposed MatchCycle + notify participants. */
async function createCycleFromEngine(cycle) {
  const created = await prisma.matchCycle.create({
    data: {
      status: 'proposed',
      participants: { create: participantsFromCycle(cycle) },
    },
    include: { participants: true },
  });

  await notifyMany(
    cycle.userIds,
    'match_found',
    `A new ${cycle.userIds.length}-person exchange cycle has been proposed for you — review and accept it.`
  );

  return created;
}

/**
 * Run the cyclic matching engine against the current database state and
 * persist every proposed cycle it finds.
 *
 * @returns {Promise<Array>} the newly proposed cycles (already in the DB)
 */
async function runMatching() {
  const skipUserIds = await loadActiveUserIds();
  const data = await loadGraphData();
  const recentlyCompleted = await loadRecentlyCompletedSignatures();

  const cycles = matchUsers(data.users, {
    blockedEdges: data.blockedEdges,
    skipUserIds,
    levelScore: levelScoreFor(data),
  });

  const created = [];
  for (const cycle of cycles) {
    // A user may have been matched by another cycle in this same run
    const stillFree = cycle.userIds.every((id) => !skipUserIds.has(id));
    if (!stillFree) continue;

    // Do not re-propose a cycle that this exact user set just completed
    const signature = [...cycle.userIds].sort((a, b) => a - b).join(',');
    if (recentlyCompleted.has(signature)) continue;

    created.push(await createCycleFromEngine(cycle));
    cycle.userIds.forEach((id) => skipUserIds.add(id));
  }
  return created;
}

module.exports = { runMatching, createCycleFromEngine, loadActiveUserIds, loadGraphData, loadRecentlyCompletedSignatures };
