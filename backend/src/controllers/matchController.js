const prisma = require('../lib/prisma');
const { runMatching } = require('../services/matchingService');
const { notifyMany } = require('../services/notificationService');

const cycleInclude = {
  participants: {
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
      teachesSkill: true,
      learnsSkill: true,
    },
    orderBy: { id: 'asc' },
  },
};

/**
 * POST /api/match/run — trigger the matching engine.
 * Exposed for demos/viva; the frontend never calls this directly.
 */
async function runMatch(req, res, next) {
  try {
    const cycles = await runMatching();
    const withDetails = await Promise.all(
      cycles.map((c) => prisma.matchCycle.findUnique({ where: { id: c.id }, include: cycleInclude }))
    );
    res.status(201).json({ cycles: withDetails });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/match/status — dashboard state for the current user:
 *   { status: 'no-profile' | 'waiting' | 'proposed' | 'confirmed', cycle?, exchange? }
 */
async function getMyStatus(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        offered: true,
        wanted: true,
        participants: {
          include: {
            cycle: {
              include: cycleInclude,
            },
          },
          orderBy: { id: 'desc' },
        },
      },
    });

    if (user.offered.length === 0 && user.wanted.length === 0) {
      return res.json({ status: 'no-profile' });
    }

    // Most recent non-rejected cycle first
    const active = user.participants.find((p) => ['proposed', 'confirmed'].includes(p.cycle.status));
    if (active) {
      const cycle = await enrichCycle(active.cycle);
      return res.json({
        status: cycle.status, // 'proposed' | 'confirmed'
        cycle,
        myParticipant: cycle.participants.find((p) => p.userId === req.userId),
      });
    }

    // No open proposal, but a completed exchange exists -> show it
    const done = user.participants.find((p) => p.cycle.status === 'completed');
    if (done) {
      const cycle = await enrichCycle(done.cycle);
      return res.json({
        status: 'completed',
        cycle,
        myParticipant: cycle.participants.find((p) => p.userId === req.userId),
      });
    }

    res.json({ status: 'waiting' });
  } catch (err) {
    next(err);
  }
}

/** GET /api/match/cycle/:id — full cycle detail for the match review page. */
async function getCycle(req, res, next) {
  try {
    const cycleId = Number(req.params.id);
    if (!Number.isInteger(cycleId)) return res.status(400).json({ error: 'Invalid cycle id' });
    const cycle = await prisma.matchCycle.findUnique({
      where: { id: cycleId },
      include: cycleInclude,
    });
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

    const isParticipant = cycle.participants.some((p) => p.userId === req.userId);
    if (!isParticipant) return res.status(403).json({ error: 'You are not part of this cycle' });

    res.json({ cycle: await enrichCycle(cycle) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/match/cycle/:id/accept — mark the current user's acceptance.
 * When every participant has accepted, the cycle becomes `confirmed`
 * and contact info (emails) is revealed to all participants.
 */
async function acceptCycle(req, res, next) {
  try {
    const cycleId = Number(req.params.id);
    if (!Number.isInteger(cycleId)) return res.status(400).json({ error: 'Invalid cycle id' });
    const cycle = await prisma.matchCycle.findUnique({
      where: { id: cycleId },
      include: cycleInclude,
    });
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
    if (cycle.status !== 'proposed') {
      return res.status(400).json({ error: `This cycle is already ${cycle.status}` });
    }
    if (!cycle.participants.some((p) => p.userId === req.userId)) {
      return res.status(403).json({ error: 'You are not part of this cycle' });
    }

    await prisma.matchCycleParticipant.update({
      where: { cycleId_userId: { cycleId, userId: req.userId } },
      data: { accepted: true },
    });

    // All accepted? -> confirmed. Contact info is revealed by the API
    // only when status is confirmed (see enrichCycle).
    const updated = await prisma.matchCycle.findUnique({
      where: { id: cycleId },
      include: { participants: true },
    });
    const my = cycle.participants.find((p) => p.userId === req.userId);
    const others = updated.participants.filter((p) => p.userId !== req.userId).map((p) => p.userId);

    if (updated.participants.every((p) => p.accepted === true)) {
      await prisma.matchCycle.update({
        where: { id: cycleId },
        data: { status: 'confirmed' },
      });
      await notifyMany(
        updated.participants.map((p) => p.userId),
        'match_accepted',
        'Everyone accepted the exchange — it is now confirmed.'
      );
    } else {
      await notifyMany(others, 'match_accepted', `${my.user.name} accepted the exchange.`);
    }

    res.json({ cycle: await getCycleFor(cycleId) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/match/cycle/:id/reject — reject the whole proposal.
 * The specific edge that made this cycle possible for the rejector is
 * blocked, the cycle is closed, and matching re-runs for everyone freed.
 */
async function rejectCycle(req, res, next) {
  try {
    const cycleId = Number(req.params.id);
    if (!Number.isInteger(cycleId)) return res.status(400).json({ error: 'Invalid cycle id' });
    const cycle = await prisma.matchCycle.findUnique({
      where: { id: cycleId },
      include: { participants: { include: { user: true } } },
    });
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
    if (cycle.status !== 'proposed') {
      return res.status(400).json({ error: `This cycle is already ${cycle.status}` });
    }
    const my = cycle.participants.find((p) => p.userId === req.userId);
    if (!my) return res.status(403).json({ error: 'You are not part of this cycle' });

    // Block the edge the rejector learns from: find the participant who teaches
    // the skill the rejector wanted (my.learnsSkillId). That participant is
    // the "next user" in the cycle order, regardless of DB row order.
    let teacher = cycle.participants.find((p) => p.teachesSkillId === my.learnsSkillId);
    if (!teacher) {
      // Fallback (should not happen in a valid cycle): use the first other participant
      const fallback = cycle.participants.find((p) => p.userId !== req.userId);
      if (!fallback) return res.status(400).json({ error: 'Cannot determine edge to block' });
      teacher = fallback;
    }

    await prisma.$transaction([
      prisma.blockedEdge.create({
        data: { fromUserId: req.userId, toUserId: teacher.userId },
      }),
      prisma.matchCycle.update({
        where: { id: cycleId },
        data: { status: 'rejected' },
      }),
    ]);

    // Tell the other participants the proposal was declined
    await notifyMany(
      cycle.participants.filter((p) => p.userId !== req.userId).map((p) => p.userId),
      'match_rejected',
      `${my.user.name} rejected the exchange proposal.`
    );

    // Everyone else in the cycle is now free again — re-run matching.
    await runMatching();

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** GET /api/match/exchanges — confirmed/completed match history + completion state. */
async function getExchanges(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const cycles = await prisma.matchCycle.findMany({
      where: { status: { in: ['confirmed', 'completed'] }, participants: { some: { userId: req.userId } } },
      include: cycleInclude,
      orderBy: { id: 'desc' },
      take: limit,
      skip: offset,
    });
    res.json({ exchanges: await enrichCycles(cycles) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/match/cycle/:id/complete (and /api/cycles/:id/complete)
 * Mark the calling user's side of the exchange as done. Once every
 * participant has a completedAt, the whole cycle becomes `completed`
 * and everyone is notified.
 */
async function completeExchange(req, res, next) {
  try {
    const cycleId = Number(req.params.id);
    if (!Number.isInteger(cycleId)) return res.status(400).json({ error: 'Invalid cycle id' });
    const cycle = await prisma.matchCycle.findUnique({
      where: { id: cycleId },
      include: { participants: { include: { user: { select: { id: true, name: true } } } } },
    });
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
    if (cycle.status !== 'confirmed') {
      return res.status(400).json({ error: 'Only confirmed exchanges can be completed' });
    }
    if (!cycle.participants.some((p) => p.userId === req.userId)) {
      return res.status(403).json({ error: 'You are not part of this cycle' });
    }

    await prisma.matchCycleParticipant.update({
      where: { cycleId_userId: { cycleId, userId: req.userId } },
      data: { completedAt: new Date() },
    });

    const updated = await prisma.matchCycle.findUnique({
      where: { id: cycleId },
      include: { participants: true },
    });

    if (updated.participants.every((p) => p.completedAt)) {
      await prisma.matchCycle.update({
        where: { id: cycleId },
        data: { status: 'completed', completedAt: new Date() },
      });
      await notifyMany(
        updated.participants.map((p) => p.userId),
        'session_completed',
        'All participants completed this exchange — it is now marked complete.'
      );
      // Everyone in the cycle is free again — re-run matching so they can
      // be proposed new cycles immediately (same as rejectCycle does).
      await runMatching();
    }

    res.json({ cycle: await getCycleFor(cycleId) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/debug/graph — raw adjacency list of the current matching graph. */
async function debugGraph(req, res, next) {
  try {
    const [users, blocked] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          offered: { select: { skill: { select: { id: true, name: true } } } },
          wanted: { select: { skill: { select: { id: true, name: true } } } },
        },
      }),
      prisma.blockedEdge.findMany(),
    ]);
    const active = await prisma.matchCycleParticipant.findMany({
      where: { cycle: { status: { in: ['proposed', 'confirmed'] } } },
      select: { userId: true },
    });
    const activeSet = new Set(active.map((a) => a.userId));

    const { buildGraph, findCycles } = require('../services/matchingEngine');
    const graphData = users.map((u) => ({
      id: u.id,
      offered: u.offered.map((o) => o.skill.id),
      wanted: u.wanted.map((w) => w.skill.id),
    }));
    const skipUserIds = activeSet;
    const adjacency = buildGraph(graphData, {
      blockedEdges: blocked.map((e) => ({ fromUserId: e.fromUserId, toUserId: e.toUserId })),
      skipUserIds,
    });

    const nameById = new Map(users.map((u) => [u.id, u.name]));
    const skillNameById = new Map(
      users.flatMap((u) => [
        ...u.offered.map((o) => [o.skill.id, o.skill.name]),
        ...u.wanted.map((w) => [w.skill.id, w.skill.name]),
      ])
    );

    const adjacencyList = {};
    for (const [fromId, neighbors] of adjacency) {
      adjacencyList[nameById.get(fromId)] = Array.from(neighbors, ([toId, skillId]) => ({
        to: nameById.get(toId),
        teaches: skillNameById.get(skillId),
      }));
    }

    res.json({
      userCount: users.length,
      waitingUsers: users.filter((u) => !activeSet.has(u.id)).map((u) => u.name),
      blockedEdges: blocked.map((e) => ({
        from: nameById.get(e.fromUserId),
        to: nameById.get(e.toUserId),
      })),
      cyclesCurrentlyFindable: findCycles(adjacency).map((c) =>
        c.userIds.map((id) => nameById.get(id))
      ),
      adjacencyList,
    });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------------
// helpers
// ------------------------------------------------------------------

/** Re-load a cycle with participant details for the response. */
async function getCycleFor(cycleId) {
  const cycle = await prisma.matchCycle.findUnique({
    where: { id: cycleId },
    include: cycleInclude,
  });
  return enrichCycle(cycle);
}

/**
 * Enrich cycles for the client (BATCHED — one query set for all cycles):
 *  - When confirmed, reveal contact info (emails) between participants;
 *    while proposed, emails stay hidden.
 *  - Attach each participant's proficiency levels for the skill they teach
 *    (teachesLevel) and the skill they learn (learnsLevel).
 *  - Flatten the user's average rating + rating count (from the relation
 *    aggregates in cycleInclude) into avgRating / ratingCount.
 */
async function enrichCycles(cycles) {
  if (cycles.length === 0) return [];

  const participantRows = cycles.flatMap((c) => c.participants);
  const hasRows = participantRows.length > 0;

  const [offeredLevels, wantedLevels, aggRows] = await Promise.all([
    hasRows
      ? prisma.userOfferedSkill.findMany({
          where: { OR: participantRows.map((p) => ({ userId: p.userId, skillId: p.teachesSkillId })) },
        })
      : [],
    hasRows
      ? prisma.userWantedSkill.findMany({
          where: { OR: participantRows.map((p) => ({ userId: p.userId, skillId: p.learnsSkillId })) },
        })
      : [],
    hasRows
      ? prisma.rating.groupBy({
          by: ['rateeId'],
          where: { rateeId: { in: participantRows.map((p) => p.userId) } },
          _avg: { score: true },
          _count: { _all: true },
        })
      : [],
  ]);

  const levelOf = (rows, userId, skillId) =>
    rows.find((r) => r.userId === userId && r.skillId === skillId)?.level ?? null;
  const aggByUser = new Map(
    aggRows.map((r) => [r.rateeId, { avgRating: r._avg.score, ratingCount: r._count._all }])
  );

  return cycles.map((cycle) => {
    const participants = cycle.participants.map((p) => {
      const agg = aggByUser.get(p.userId);
      return {
        ...p,
        teachesLevel: levelOf(offeredLevels, p.userId, p.teachesSkillId),
        learnsLevel: levelOf(wantedLevels, p.userId, p.learnsSkillId),
        user: {
          id: p.user.id,
          name: p.user.name,
          email: ['confirmed', 'completed'].includes(cycle.status) ? p.user.email : null,
          department: p.user.department,
          avgRating: agg?.avgRating ?? null,
          ratingCount: agg?.ratingCount ?? 0,
        },
      };
    });
    return { ...cycle, participants };
  });
}

/** Enrich a single cycle (batched helper, keeps call sites unchanged). */
async function enrichCycle(cycle) {
  const enriched = await enrichCycles([cycle]);
  return enriched[0];
}

module.exports = {
  runMatch,
  getMyStatus,
  getCycle,
  acceptCycle,
  rejectCycle,
  getExchanges,
  completeExchange,
  debugGraph,
};
