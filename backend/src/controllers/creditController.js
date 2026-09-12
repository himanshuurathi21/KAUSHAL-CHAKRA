const prisma = require('../lib/prisma');
const { notify } = require('../services/notificationService');
const {
  canRedeem,
  withCreditLock,
  findAvailablePartner,
  invitedPartnerId,
  canTransition,
  refundEntryFor,
  hasActiveCycle,
  hasOpenCreditSession,
  hasWaitedLongEnough,
} = require('../services/creditService');

const MIN_WAIT_DAYS = Number(process.env.CREDIT_MIN_WAIT_DAYS || 0);

/** Reject non-integer / non-positive skill ids with 400 (not a Prisma 500). */
function parseSkillId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Abort a locked transaction with an HTTP-status-carrying error. */
function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

const sessionInclude = {
  teacher: { select: { id: true, name: true } },
  learner: { select: { id: true, name: true } },
  skill: true,
  task: true,
};

/** GET /api/credits — my balance, ledger entries and credit sessions. */
async function getMyCredits(req, res, next) {
  try {
    // Balance must be summed over the FULL ledger — the returned list is
    // only the 50 most recent entries for display.
    const [ledger, sessions, balanceAgg] = await Promise.all([
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
      prisma.credit.aggregate({
        where: { userId: req.userId },
        _sum: { delta: true },
      }),
    ]);
    res.json({ balance: balanceAgg._sum.delta ?? 0, ledger, sessions });
  } catch (err) {
    next(err);
  }
}

/** POST /api/credits/teach — unmatched user teaches now, earns a credit on completion. */
async function teachNow(req, res, next) {
  try {
    const skillId = parseSkillId(req.body?.skillId);
    if (!skillId) return res.status(400).json({ error: 'A valid skillId is required' });

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { offered: { select: { skillId: true } } },
    });
    if (user.creditsFrozen) return res.status(403).json({ error: "Your credits are frozen due to a report" });
    if (!user.isActive) return res.status(403).json({ error: "Your account is deactivated" });
    if (!user.offered.some((o) => o.skillId === skillId)) {
      return res.status(400).json({ error: 'You must offer this skill to teach it' });
    }
    if (!hasWaitedLongEnough(user, MIN_WAIT_DAYS)) {
      return res.status(400).json({ error: `Credit teaching unlocks after ${MIN_WAIT_DAYS} day(s) without a match` });
    }

    // Check + create run inside one locked transaction so two concurrent
    // teach requests can't double-book the same teacher.
    let session;
    try {
      session = await prisma.$transaction(async (tx) => {
        await withCreditLock(tx, req.userId);
        const freshUser = await tx.user.findUnique({ where: { id: req.userId } });
        if (freshUser.creditsFrozen) fail(403, "Your credits are frozen due to a report");
        if (!freshUser.isActive) fail(403, "Your account is deactivated");
        if (await hasActiveCycle(req.userId, tx)) {
          fail(400, 'You are already in an active cycle — no credit session needed');
        }
        if (await hasOpenCreditSession(req.userId, tx)) {
          fail(400, 'You already have an open credit session — resolve it before starting another');
        }
        const learnerId = await findAvailablePartner('teacher', skillId, req.userId, tx);
        if (!learnerId) {
          fail(404, 'No one currently wants this skill — try another skill');
        }
        return tx.creditSession.create({
          data: { teacherId: req.userId, learnerId, skillId, createdBy: 'teacher' },
          include: sessionInclude,
        });
      });
    } catch (err) {
      if (err?.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }
    const skillLabel = session.skill ? session.skill.name : (session.task ? session.task.title : 'skill');
    await notify(session.learnerId, 'credit_session', `A teacher wants to teach you ${skillLabel} — accept the session in Credits.`, '/credits');

    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
}

/** POST /api/credits/redeem — spend a credit to be taught a wanted skill now. */
async function redeem(req, res, next) {
  try {
    const skillId = parseSkillId(req.body?.skillId);
    if (!skillId) return res.status(400).json({ error: 'A valid skillId is required' });

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { wanted: { select: { skillId: true } } },
    });
    if (user.creditsFrozen) return res.status(403).json({ error: "Your credits are frozen due to a report" });
    if (!user.isActive) return res.status(403).json({ error: "Your account is deactivated" });
    if (!user.wanted.some((w) => w.skillId === skillId)) {
      return res.status(400).json({ error: 'You must want this skill to redeem a credit for it' });
    }

    // Balance check + reservation happen inside one locked transaction:
    // two concurrent redeems on a balance of 1 can't both succeed.
    let session;
    try {
      session = await prisma.$transaction(async (tx) => {
        await withCreditLock(tx, req.userId);
        const freshUser = await tx.user.findUnique({ where: { id: req.userId } });
        if (freshUser.creditsFrozen) fail(403, "Your credits are frozen due to a report");
        if (!freshUser.isActive) fail(403, "Your account is deactivated");
        if (await hasActiveCycle(req.userId, tx)) {
          fail(400, 'You are already in an active cycle — no need to redeem');
        }
        if (await hasOpenCreditSession(req.userId, tx)) {
          fail(400, 'You already have an open credit session — resolve it before redeeming another');
        }
        const agg = await tx.credit.aggregate({
          where: { userId: req.userId },
          _sum: { delta: true },
        });
        if (!canRedeem(agg._sum.delta ?? 0)) {
          fail(400, 'You need at least 1 credit to redeem a lesson');
        }
        const teacherId = await findAvailablePartner('learner', skillId, req.userId, tx);
        if (!teacherId) {
          fail(404, 'No one currently teaches this skill — try another skill');
        }
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
    } catch (err) {
      if (err?.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }

    const skillLabel2 = session.skill ? session.skill.name : (session.task ? session.task.title : 'skill');
    await notify(session.teacherId, 'credit_session', `${user.name} redeemed a credit to learn ${skillLabel2} from you.`, '/credits');

    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
}

/** POST /api/credits/sessions/:id/accept — the auto-assigned partner accepts the session. */
async function acceptSession(req, res, next) {
  try {
    const found = await findRespondableSession(req.params.id, req.userId);
    if (found.error) return res.status(found.error).json({ error: found.message });
    const session = found.session;

    const updated = await prisma.creditSession.update({
      where: { id: session.id },
      data: { status: 'active' },
      include: sessionInclude,
    });

    const label = session.skill ? session.skill.name : (session.task ? session.task.title : 'session');
    await notifyInitiator(session, `${responderName(session)} accepted your credit session on ${label}.`, '/credits');

    res.json({ session: updated });
  } catch (err) {
    next(err);
  }
}

/** POST /api/credits/sessions/:id/decline — the auto-assigned partner declines. */
async function declineSession(req, res, next) {
  try {
    const found = await findRespondableSession(req.params.id, req.userId);
    if (found.error) return res.status(found.error).json({ error: found.message });
    const session = found.session;

    await prisma.$transaction(async (tx) => {
      await tx.creditSession.update({
        where: { id: session.id },
        data: { status: 'declined' },
      });
      // If task session was in_progress, reopen the task
      if (session.type === 'TASK' && session.taskId) {
        await tx.task.update({ where: { id: session.taskId }, data: { status: 'OPEN' } });
      }
      // A redeem reserves -1 up front; give the credit back when the
      // session never happens. Teacher-initiated sessions have no
      // up-front reservation, so there is nothing to refund.
      const refund = refundEntryFor(session);
      if (refund) await tx.credit.create({ data: refund });
    });

    const label = session.skill ? session.skill.name : (session.task ? session.task.title : 'session');
    await notifyInitiator(session, `${responderName(session)} declined your credit session on ${label}.`, '/credits');

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** POST /api/credits/sessions/:id/complete — mark MY side done, settle when both sides agree. */
async function completeSession(req, res, next) {
  try {
    const sessionId = Number(req.params.id);
    if (!Number.isInteger(sessionId)) return res.status(400).json({ error: 'Invalid session id' });
    const session = await prisma.creditSession.findUnique({
      where: { id: sessionId },
      include: { skill: true, task: true },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.teacherId !== req.userId && session.learnerId !== req.userId) {
      return res.status(403).json({ error: 'You are not part of this session' });
    }
    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Only active sessions can be completed' });
    }

    const sideField = session.teacherId === req.userId ? 'teacherDoneAt' : 'learnerDoneAt';
    if (session[sideField]) {
      const current = await prisma.creditSession.findUnique({ where: { id: session.id }, include: sessionInclude });
      return res.json({ session: current });
    }
    await prisma.creditSession.update({
      where: { id: session.id },
      data: { [sideField]: new Date() },
    });

    // Settle only when BOTH sides marked done. The atomic flip guarantees a
    // single mint no matter how the two completions interleave.
    const flipped = await prisma.creditSession.updateMany({
      where: { id: session.id, status: 'active', teacherDoneAt: { not: null }, learnerDoneAt: { not: null } },
      data: { status: 'completed', completedAt: new Date() },
    });
    if (flipped.count === 1) {
      if (session.type === 'TASK' && session.taskId) {
        // Task: move credits from poster (learner) to helper (teacher) using task.creditValue
        const task = await prisma.task.findUnique({ where: { id: session.taskId } });
        const amount = task ? task.creditValue : 1;
        // Ensure poster still has enough balance (poster could have spent since claim)
        const posterBal = await prisma.credit.aggregate({ where: { userId: session.learnerId }, _sum: { delta: true } });
        if ((posterBal._sum.delta ?? 0) < amount) {
          // Not enough credits — revert completion and inform
          await prisma.creditSession.update({ where: { id: session.id }, data: { status: 'active', completedAt: null } });
          return res.status(400).json({ error: `Poster has insufficient credits to pay ${amount} (has ${posterBal._sum.delta ?? 0})` });
        }
        // Deduct from poster, credit helper
        await prisma.$transaction(async (tx) => {
          await tx.credit.create({ data: { userId: session.learnerId, delta: -amount, reason: 'task_post', sessionId: session.id } });
          await tx.credit.create({ data: { userId: session.teacherId, delta: amount, reason: 'task_complete', sessionId: session.id } });
          await tx.task.update({ where: { id: session.taskId }, data: { status: 'COMPLETED' } });
        });
        const labelTask = session.task ? session.task.title : 'task';
        await notify(
          session.teacherId === req.userId ? session.learnerId : session.teacherId,
          'credit_session',
          `Your task "${labelTask}" is complete — ${amount} credit(s) moved.`,
          '/tasks'
        );
      } else {
        await prisma.credit.create({
          data: { userId: session.teacherId, delta: 1, reason: 'teach_now', sessionId: session.id },
        });
        const labelSkill = session.skill ? session.skill.name : 'skill';
        await notify(
          session.teacherId === req.userId ? session.learnerId : session.teacherId,
          'credit_session',
          `Your credit session on ${labelSkill} is complete.`,
          '/credits'
        );
      }
    }

    const updated = await prisma.creditSession.findUnique({ where: { id: session.id }, include: sessionInclude });
    res.json({ session: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * Load a session the caller is allowed to respond to (accept/decline).
 * Only the auto-assigned partner (the one who did NOT initiate the
 * session) may respond, and only while the session is still `proposed`.
 */
async function findRespondableSession(rawId, userId) {
  const sessionId = Number(rawId);
  if (!Number.isInteger(sessionId)) return { error: 400, message: 'Invalid session id' };
  const session = await prisma.creditSession.findUnique({
    where: { id: sessionId },
    include: sessionInclude,
  });
  if (!session) return { error: 404, message: 'Session not found' };
  if (!canTransition(session, 'active') && !canTransition(session, 'declined')) {
    return { error: 400, message: `This session is already ${session.status}` };
  }
  if (invitedPartnerId(session) !== userId) {
    return { error: 403, message: 'Only the invited partner can respond to this session' };
  }
  return { session };
}

/** Name of the partner who just accepted/declined the session. */
function responderName(session) {
  return session.createdBy === 'teacher' ? session.learner.name : session.teacher.name;
}

/** Notify the initiator (the user who created the session) about a response. */
async function notifyInitiator(session, content, link = '/credits') {
  const initiatorId = session.createdBy === 'teacher' ? session.teacherId : session.learnerId;
  await notify(initiatorId, 'credit_session', content, link);
}

module.exports = { getMyCredits, teachNow, redeem, acceptSession, declineSession, completeSession };
