const prisma = require('../lib/prisma');

/** Create a notification row for one user. */
async function notify(userId, type, content) {
  return prisma.notification.create({ data: { userId, type, content } });
}

/** Create a notification row for many users. */
async function notifyMany(userIds, type, content) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return [];
  return prisma.notification.createMany({
    data: unique.map((userId) => ({ userId, type, content })),
  });
}

module.exports = { notify, notifyMany };
