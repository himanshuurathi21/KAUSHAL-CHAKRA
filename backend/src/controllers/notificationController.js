const prisma = require('../lib/prisma');

/** GET /api/notifications — my notifications, newest first. */
async function getMine(req, res, next) {
  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.notification.count({ where: { userId: req.userId, read: false } }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
}

/** POST /api/notifications/:id/read — mark one notification as read. */
async function markRead(req, res, next) {
  try {
    const notificationId = Number(req.params.id);
    if (!Number.isInteger(notificationId)) return res.status(400).json({ error: 'Invalid notification id' });
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    if (notification.userId !== req.userId) {
      return res.status(403).json({ error: 'Not your notification' });
    }
    await prisma.notification.update({
      where: { id: notification.id },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** POST /api/notifications/read-all — mark every unread notification of mine as read. */
async function markAllRead(req, res, next) {
  try {
    const { count } = await prisma.notification.updateMany({
      where: { userId: req.userId, read: false },
      data: { read: true },
    });
    res.json({ ok: true, marked: count });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMine, markRead, markAllRead };
