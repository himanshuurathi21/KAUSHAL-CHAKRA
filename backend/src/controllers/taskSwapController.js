const prisma = require('../lib/prisma');
const { notify } = require('../services/notificationService');
const { rewardTaskSwapComplete } = require('../services/creditRewardService');

const swapInclude = {
  requester: { select: { id: true, name: true } },
  helper: { select: { id: true, name: true } },
  requestedTask: { include: { poster: { select: { id: true, name: true } } } },
  offeredTask: { include: { poster: { select: { id: true, name: true } } } },
};

/** POST /api/task-swaps — requester offers a swap: my offeredTask for helper's requestedTask */
async function createSwap(req, res, next) {
  try {
    const { requestedTaskId, offeredTaskId, offeredDeliverableLink, requestedDeliverableLink } = req.body || {};
    const reqId = Number(requestedTaskId);
    const offId = offeredTaskId ? Number(offeredTaskId) : null;
    if (!Number.isInteger(reqId)) return res.status(400).json({ error: 'requestedTaskId is required' });
    if (offId !== null && !Number.isInteger(offId)) return res.status(400).json({ error: 'Invalid offeredTaskId' });

    const requestedTask = await prisma.task.findUnique({ where: { id: reqId } });
    if (!requestedTask) return res.status(404).json({ error: 'Requested task not found' });
    if (requestedTask.status !== 'OPEN') return res.status(400).json({ error: 'Requested task is not open' });
    if (requestedTask.posterId === req.userId) return res.status(400).json({ error: 'You cannot request your own task' });

    let offeredTask = null;
    if (offId) {
      offeredTask = await prisma.task.findUnique({ where: { id: offId } });
      if (!offeredTask) return res.status(404).json({ error: 'Offered task not found' });
      if (offeredTask.posterId !== req.userId) return res.status(400).json({ error: 'Offered task must be yours' });
      if (offeredTask.status !== 'OPEN') return res.status(400).json({ error: 'Offered task is not open' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (user.creditsFrozen) return res.status(403).json({ error: 'Your credits are frozen' });
    if (!user.isActive) return res.status(403).json({ error: 'Your account is deactivated' });

    const helperId = requestedTask.posterId;

    // Prevent self-swap and duplicate pending swap
    const existing = await prisma.taskSwap.findFirst({
      where: {
        requesterId: req.userId,
        requestedTaskId: reqId,
        status: { in: ['requested', 'accepted', 'in_progress', 'submitted'] },
      },
    });
    if (existing) return res.status(409).json({ error: 'You already have a pending swap for this task' });

    const swap = await prisma.taskSwap.create({
      data: {
        requesterId: req.userId,
        helperId,
        requestedTaskId: reqId,
        offeredTaskId: offId,
        status: 'requested',
        requestedDeliverableLink: requestedDeliverableLink || null,
        offeredDeliverableLink: offeredDeliverableLink || null,
      },
      include: swapInclude,
    });

    await notify(helperId, 'credit_session', `${user.name} requested a task swap: "${requestedTask.title}" ↔ "${offeredTask ? offeredTask.title : 'your task'}"`, `/task-swaps/${swap.id}`);
    res.status(201).json({ swap });
  } catch (err) { next(err); }
}

async function listSwaps(req, res, next) {
  try {
    const swaps = await prisma.taskSwap.findMany({
      where: { OR: [{ requesterId: req.userId }, { helperId: req.userId }] },
      include: swapInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ swaps });
  } catch (err) { next(err); }
}

async function getSwap(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const swap = await prisma.taskSwap.findUnique({ where: { id }, include: swapInclude });
    if (!swap) return res.status(404).json({ error: 'TaskSwap not found' });
    if (swap.requesterId !== req.userId && swap.helperId !== req.userId) return res.status(403).json({ error: 'Not your swap' });
    const messages = await prisma.message.findMany({ where: { taskSwapId: id }, include: { sender: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' }, take: 100 });
    res.json({ swap, messages });
  } catch (err) { next(err); }
}

async function acceptSwap(req, res, next) {
  try {
    const id = Number(req.params.id);
    const swap = await prisma.taskSwap.findUnique({ where: { id }, include: { requestedTask: true, offeredTask: true } });
    if (!swap) return res.status(404).json({ error: 'Not found' });
    if (swap.helperId !== req.userId) return res.status(403).json({ error: 'Only helper can accept' });
    if (swap.status !== 'requested') return res.status(400).json({ error: `Cannot accept, status is ${swap.status}` });

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.taskSwap.update({ where: { id }, data: { status: 'accepted' } });
      // Lock tasks to IN_PROGRESS
      await tx.task.updateMany({ where: { id: swap.requestedTaskId, status: 'OPEN' }, data: { status: 'IN_PROGRESS' } });
      if (swap.offeredTaskId) await tx.task.updateMany({ where: { id: swap.offeredTaskId, status: 'OPEN' }, data: { status: 'IN_PROGRESS' } });
      // Set to in_progress immediately after accept (no extra step)
      return tx.taskSwap.update({ where: { id }, data: { status: 'in_progress' }, include: swapInclude });
    });

    await notify(swap.requesterId, 'credit_session', `Your task swap was accepted — work started!`, `/task-swaps/${id}`);
    res.json({ swap: updated });
  } catch (err) { next(err); }
}

async function rejectSwap(req, res, next) {
  try {
    const id = Number(req.params.id);
    const swap = await prisma.taskSwap.findUnique({ where: { id } });
    if (!swap) return res.status(404).json({ error: 'Not found' });
    if (swap.helperId !== req.userId) return res.status(403).json({ error: 'Only helper can reject' });
    if (swap.status !== 'requested') return res.status(400).json({ error: `Cannot reject, status is ${swap.status}` });
    const updated = await prisma.taskSwap.update({ where: { id }, data: { status: 'rejected' }, include: swapInclude });
    await notify(swap.requesterId, 'credit_session', `Your task swap was rejected`, `/task-swaps/${id}`);
    res.json({ swap: updated });
  } catch (err) { next(err); }
}

async function submitSwap(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { link, note } = req.body || {};
    if (link && typeof link !== 'string') return res.status(400).json({ error: 'link must be string' });
    const swap = await prisma.taskSwap.findUnique({ where: { id } });
    if (!swap) return res.status(404).json({ error: 'Not found' });
    if (swap.requesterId !== req.userId && swap.helperId !== req.userId) return res.status(403).json({ error: 'Not your swap' });
    if (!['accepted', 'in_progress', 'submitted'].includes(swap.status)) return res.status(400).json({ error: `Cannot submit, status is ${swap.status}` });

    const isRequester = swap.requesterId === req.userId;
    const fieldLink = isRequester ? 'offeredDeliverableLink' : 'requestedDeliverableLink';
    const fieldAt = isRequester ? 'offeredSubmittedAt' : 'requestedSubmittedAt';
    const deliverable = link ? link.trim().slice(0, 500) : (note ? note.trim().slice(0, 500) : null);
    if (!deliverable) return res.status(400).json({ error: 'Provide link or note' });

    const updated = await prisma.taskSwap.update({
      where: { id },
      data: {
        [fieldLink]: deliverable,
        [fieldAt]: new Date(),
        status: 'submitted',
      },
      include: swapInclude,
    });

    const otherId = isRequester ? swap.helperId : swap.requesterId;
    if (otherId) await notify(otherId, 'credit_session', `Deliverable submitted for task swap #${id} — please review`, `/task-swaps/${id}`);
    res.json({ swap: updated });
  } catch (err) { next(err); }
}

async function approveSwap(req, res, next) {
  try {
    const id = Number(req.params.id);
    const swap = await prisma.taskSwap.findUnique({ where: { id } });
    if (!swap) return res.status(404).json({ error: 'Not found' });
    if (swap.requesterId !== req.userId && swap.helperId !== req.userId) return res.status(403).json({ error: 'Not your swap' });
    if (swap.status !== 'submitted' && swap.status !== 'in_progress') return res.status(400).json({ error: `Cannot approve, status is ${swap.status}` });

    const isRequester = swap.requesterId === req.userId;
    // Requester approves helper's work (requested task), helper approves requester's work (offered task)
    const approveField = isRequester ? 'requestedApprovedAt' : 'offeredApprovedAt';
    // If offeredTask is null (one-way), helper approving is not needed
    if (!swap.offeredTaskId && !isRequester) {
      // Helper has no offered task to approve, just approve requested
    }

    // Check if side already approved
    if (swap[approveField]) return res.status(400).json({ error: 'Already approved this side' });

    const updated = await prisma.taskSwap.update({
      where: { id },
      data: { [approveField]: new Date() },
      include: swapInclude,
    });

    // Check if both sides approved (or one-way where only requester needs to approve)
    const fresh = await prisma.taskSwap.findUnique({ where: { id } });
    const needRequesterApproval = !!fresh.requestedTaskId; // helper's deliverable needs requester's approval
    const needHelperApproval = !!fresh.offeredTaskId; // requester's deliverable needs helper's approval

    const bothApproved = 
      (!needRequesterApproval || fresh.requestedApprovedAt) &&
      (!needHelperApproval || fresh.offeredApprovedAt);

    if (bothApproved) {
      const final = await prisma.$transaction(async (tx) => {
        const s = await tx.taskSwap.update({ where: { id }, data: { status: 'completed', completedAt: new Date() }, include: swapInclude });
        if (s.requestedTaskId) await tx.task.update({ where: { id: s.requestedTaskId }, data: { status: 'COMPLETED' } });
        if (s.offeredTaskId) await tx.task.update({ where: { id: s.offeredTaskId }, data: { status: 'COMPLETED' } });
        return s;
      });
      // Reward both parties
      try {
        await rewardTaskSwapComplete(swap.requesterId, id);
        if (swap.helperId) await rewardTaskSwapComplete(swap.helperId, id);
      } catch (e) { console.error('task_swap reward failed', e); }
      if (swap.helperId) await notify(swap.helperId, 'credit_session', `Task swap #${id} completed — you earned credits!`, `/task-swaps/${id}`);
      await notify(swap.requesterId, 'credit_session', `Task swap #${id} completed — you earned credits!`, `/task-swaps/${id}`);
      return res.json({ swap: final });
    }

    const otherId = isRequester ? swap.helperId : swap.requesterId;
    if (otherId) await notify(otherId, 'credit_session', `Task swap #${id} got an approval — waiting for other side`, `/task-swaps/${id}`);
    res.json({ swap: updated });
  } catch (err) { next(err); }
}

async function cancelSwap(req, res, next) {
  try {
    const id = Number(req.params.id);
    const swap = await prisma.taskSwap.findUnique({ where: { id } });
    if (!swap) return res.status(404).json({ error: 'Not found' });
    if (swap.requesterId !== req.userId && swap.helperId !== req.userId) return res.status(403).json({ error: 'Not your swap' });
    if (['completed', 'rejected', 'cancelled'].includes(swap.status)) return res.status(400).json({ error: `Cannot cancel, status is ${swap.status}` });
    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.taskSwap.update({ where: { id }, data: { status: 'cancelled' }, include: swapInclude });
      if (swap.requestedTaskId) await tx.task.updateMany({ where: { id: swap.requestedTaskId, status: 'IN_PROGRESS' }, data: { status: 'OPEN' } });
      if (swap.offeredTaskId) await tx.task.updateMany({ where: { id: swap.offeredTaskId, status: 'IN_PROGRESS' }, data: { status: 'OPEN' } });
      return s;
    });
    const otherId = swap.requesterId === req.userId ? swap.helperId : swap.requesterId;
    if (otherId) await notify(otherId, 'credit_session', `Task swap #${id} was cancelled`, `/task-swaps/${id}`);
    res.json({ swap: updated });
  } catch (err) { next(err); }
}

async function sendMessage(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { content } = req.body || {};
    const trimmed = String(content || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'Content required' });
    if (trimmed.length > 1000) return res.status(400).json({ error: 'Max 1000 chars' });
    const swap = await prisma.taskSwap.findUnique({ where: { id } });
    if (!swap) return res.status(404).json({ error: 'Not found' });
    if (swap.requesterId !== req.userId && swap.helperId !== req.userId) return res.status(403).json({ error: 'Not your swap' });
    const msg = await prisma.message.create({ data: { taskSwapId: id, senderId: req.userId, content: trimmed }, include: { sender: { select: { id: true, name: true } } } });
    const otherId = swap.requesterId === req.userId ? swap.helperId : swap.requesterId;
    if (otherId) await notify(otherId, 'new_message', `New message in task swap #${id}`, `/task-swaps/${id}`);
    res.status(201).json({ message: msg });
  } catch (err) { next(err); }
}

async function getMessages(req, res, next) {
  try {
    const id = Number(req.params.id);
    const swap = await prisma.taskSwap.findUnique({ where: { id } });
    if (!swap) return res.status(404).json({ error: 'Not found' });
    if (swap.requesterId !== req.userId && swap.helperId !== req.userId) return res.status(403).json({ error: 'Not your swap' });
    const messages = await prisma.message.findMany({ where: { taskSwapId: id }, include: { sender: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' }, take: 100 });
    res.json({ messages });
  } catch (err) { next(err); }
}

module.exports = { createSwap, listSwaps, getSwap, acceptSwap, rejectSwap, submitSwap, approveSwap, cancelSwap, sendMessage, getMessages };
