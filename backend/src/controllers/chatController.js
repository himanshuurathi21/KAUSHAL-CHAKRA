const prisma = require('../lib/prisma');
const { notifyMany } = require('../services/notificationService');

const MAX_MESSAGE_LENGTH = 1000;

/** Check the caller is a participant of a confirmed/completed cycle. */
async function assertChatAccess(cycleId, userId) {
  const cycle = await prisma.matchCycle.findUnique({
    where: { id: cycleId },
    include: { participants: true },
  });
  if (!cycle) return { error: 'Cycle not found', status: 404 };
  if (!['confirmed', 'completed'].includes(cycle.status)) {
    return { error: 'Chat is only available on confirmed exchanges', status: 400 };
  }
  if (!cycle.participants.some((p) => p.userId === userId)) {
    return { error: 'You are not part of this cycle', status: 403 };
  }
  return { cycle };
}

/** POST /api/cycles/:id/messages — send a message to the exchange chat. */
async function sendMessage(req, res, next) {
  try {
    const cycleId = Number(req.params.id);
    if (!Number.isInteger(cycleId)) return res.status(400).json({ error: 'Invalid cycle id' });
    const { content } = req.body || {};
    const trimmed = String(content || '').trim();
    if (!trimmed) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message must be at most ${MAX_MESSAGE_LENGTH} characters` });
    }

    const access = await assertChatAccess(cycleId, req.userId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const message = await prisma.message.create({
      data: { cycleId, senderId: req.userId, content: trimmed },
      include: { sender: { select: { id: true, name: true } } },
    });

    // Notify the other participants a new message arrived
    await notifyMany(
      access.cycle.participants.filter((p) => p.userId !== req.userId).map((p) => p.userId),
      'new_message',
      `New message in your exchange chat.`
    );

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

/** GET /api/cycles/:id/messages — list chat messages, oldest to newest. */
async function getMessages(req, res, next) {
  try {
    const cycleId = Number(req.params.id);
    if (!Number.isInteger(cycleId)) return res.status(400).json({ error: 'Invalid cycle id' });
    const access = await assertChatAccess(cycleId, req.userId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const messages = await prisma.message.findMany({
      where: { cycleId },
      include: { sender: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendMessage, getMessages };
