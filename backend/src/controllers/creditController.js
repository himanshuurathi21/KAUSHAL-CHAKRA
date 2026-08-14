const prisma = require('../lib/prisma');
const { notify } = require('../services/notificationService');
const {
  computeBalance,
  canRedeem,
  findAvailablePartner,
  hasActiveCycle,
  hasWaitedLongEnough,
} = require('../services/creditService');

const MIN_WAIT_DAYS = Number(process.env.CREDIT_MIN_WAIT_DAYS || 0);

const sessionInclude = {
  teacher: { select: { id: true, name: true } },
  learner: { select: { id: true, name: true } },
  skill: true,
};

/** GET /api/credits — my balance, ledger entries and credit sessions. */
async function getMyCredits(req, res, next) {
  try {
    const [ledger, sessions] = await Promise.all([
      prisma.credit.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.creditSession.findMany({
        where: { OR: [{ teacherId: req.userId }, { learnerId: req.userId }] },
        include: sessionInclude,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    res.json({ balance: computeBalance(ledger), ledger, sessions });
  } catch (err) {
    next(err);
  }
}

/** POST /api/credits/teach — unmatched user teaches now, earns a credit on completion. */
async function teachNow(req, res, next) {
  try {
    const skillId = Number(req.body?.skillId);
    if (!skillId) return res.status(400).json({ error: 'skillId is required' });

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { offered: { select: { skillId: true } } },
    });
    if (!user.offered.some((o) => o.skillId === skillId)) {
      return res.status(400).json({ error: 'You must offer this skill to teach it' });
    }
    if (await hasActiveCycle(req.userId)) {
      return res.status(400).json({ error: 'You are already in an active cycle — no credit session needed' });
    }
    if (!hasWaitedLongEnough(user, MIN_WAIT_DAYS)) {
      return res.status(400).json({ error: `Credit teaching unlocks after ${MIN_WAIT_DAYS} day(s) without a match` });
    }

    const learnerId = await findAvailablePartner('teacher', skillId, req.userId);
    if (!learnerId) {
      return res.status(404).json({ error: 'No one currently wants this skill — try another skill' });
    }

    const session = await prisma.creditSession.create({
      data: { teacherId: req.userId, learnerId, skillId, createdBy: 'teacher' },
      include: sessionInclude,
    });
    await notify(learnerId, 'credit_session', `A teacher wants to teach you ${session.skill.name} — accept the session in Credits.`);

    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
}

/** POST /api/credits/redeem — spend a credit to be taught a wanted skill now. */
async function redeem(req, res, next) {
  try {
    const skillId = Number(req.body?.skillId);
    if (!skillId) return res.status(400).json({ error: 'skillId is required' });

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { wanted: { select: { skillId: true } } },
    });
    if (!user.wanted.some((w) => w.skillId === skillId)) {
      return res.status(400).json({ error: 'You must want this skill to redeem a credit for it' });
    }
    if (await hasActiveCycle(req.userId)) {
      return res.status(400).json({ error: 'You are already in an active cycle — no need to redeem' });
    }

    const balance = await currentBalance(req.userId);
    if (!canRedeem(balance)) {
      return res.status(400).json({ error: 'You need at least 1 credit to redeem a lesson' });
    }

    const teacherId = await findAvailablePartner('learner', skillId, req.userId);
    if (!teacherId) {
      return res.status(404).json({ error: 'No one currently teaches this skill — try another skill' });
    }

    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.creditSession.create({
        data: { teacherId, learnerId: req.userId, skillId, createdBy: 'learner' },
        include: sessionInclude,
      });
      // The learner's credit is reserved when the request is made
      await tx.credit.create({
        data: { userId: req.userId, delta: -1, reason: 'redeem', sessionId: created.id },
      });
      return created;
    });

    await notify(teacherId, 'credit_session', `${user.name} redeemed a credit to learn ${session.skill.name} from you.`);

    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
}

/** POST /api/credits/sessions/:id/complete — finish a one-off session, settle the ledger. */
async function completeSession(req, res, next) {
  try {
    const sessionId = Number(req.params.id);
    if (!Number.isInteger(sessionId)) return res.status(400).json({ error: 'Invalid session id' });
    const session = await prisma.creditSession.findUnique({
      where: { id: sessionId },
      include: { skill: true },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.teacherId !== req.userId && session.learnerId !== req.userId) {
      return res.status(403).json({ error: 'You are not part of this session' });
    }
    if (session.status === 'completed') {
      return res.status(400).json({ error: 'This session is already completed' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.creditSession.update({
        where: { id: session.id },
        data: { status: 'completed', completedAt: new Date() },
      });
      // The teacher earns their credit once the lesson is delivered
      await tx.credit.create({
        data: { userId: session.teacherId, delta: 1, reason: 'teach_now', sessionId: session.id },
      });
    });

    await notify(
      session.teacherId === req.userId ? session.learnerId : session.teacherId,
      'credit_session',
      `Your credit session on ${session.skill.name} is complete.`
    );

    const updated = await prisma.creditSession.findUnique({ where: { id: session.id }, include: sessionInclude });
    res.json({ session: updated });
  } catch (err) {
    next(err);
  }
}

/** Sum of the user's ledger movements. */
async function currentBalance(userId) {
  const entries = await prisma.credit.findMany({ where: { userId }, select: { delta: true } });
  return computeBalance(entries);
}

module.exports = { getMyCredits, teachNow, redeem, completeSession };
