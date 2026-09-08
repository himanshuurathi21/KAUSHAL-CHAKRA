const prisma = require('../lib/prisma');
const { canRateEachOther } = require('../services/ratingService');

/** POST /api/ratings — rate a participant on a completed exchange. */
async function createRating(req, res, next) {
  try {
    const { cycleId, rateeId, score, comment } = req.body || {};
    const raterId = req.userId;

    if (!cycleId || !rateeId || !Number.isInteger(score)) {
      return res.status(400).json({ error: 'cycleId, rateeId and score are required' });
    }
    if (score < 1 || score > 5) {
      return res.status(400).json({ error: 'Score must be between 1 and 5' });
    }
    if (rateeId === raterId) {
      return res.status(400).json({ error: 'You cannot rate yourself' });
    }
    if (!Number.isInteger(Number(cycleId)) || !Number.isInteger(Number(rateeId))) {
      return res.status(400).json({ error: 'cycleId and rateeId must be numbers' });
    }

    const cycle = await prisma.matchCycle.findUnique({
      where: { id: Number(cycleId) },
      include: { participants: true },
    });
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
    if (cycle.status !== 'completed') {
      return res.status(400).json({ error: 'Ratings are only allowed after the exchange is completed' });
    }

    const raterParticipant = cycle.participants.find((p) => p.userId === raterId);
    const rateeParticipant = cycle.participants.find((p) => p.userId === Number(rateeId));
    if (!raterParticipant || !rateeParticipant) {
      return res.status(403).json({ error: 'Both users must be participants in this cycle' });
    }
    if (!canRateEachOther(cycle.participants, raterId, Number(rateeId))) {
      return res.status(403).json({ error: 'You can only rate someone you directly taught or learned from in this exchange' });
    }

    const existing = await prisma.rating.findUnique({
      where: { cycleId_raterId_rateeId: { cycleId: cycle.id, raterId, rateeId: Number(rateeId) } },
    });
    if (existing) return res.status(409).json({ error: 'You already rated this user for this cycle' });

    const rating = await prisma.rating.create({
      data: {
        cycleId: cycle.id,
        raterId,
        rateeId: Number(rateeId),
        score,
        comment: comment || null,
      },
    });
    res.status(201).json({ rating });
  } catch (err) {
    next(err);
  }
}

/** GET /api/users/:id/ratings — average score + recent ratings for a user. */
async function getUserRatings(req, res, next) {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) return res.status(400).json({ error: 'Invalid user id' });
    const ratings = await prisma.rating.findMany({
      where: { rateeId: userId },
      include: { rater: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const aggregate = await prisma.rating.aggregate({
      where: { rateeId: userId },
      _avg: { score: true },
      _count: { score: true },
    });

    res.json({
      average: aggregate._avg.score ?? null,
      count: aggregate._count.score,
      ratings,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createRating, getUserRatings };
