const prisma = require('../lib/prisma');

/** Create a notification row for one user. `link` is an optional deep-link path. */
async function notify(userId, type, content, link = null, db = prisma) {
  return db.notification.create({ data: { userId, type, content, link } });
}

/** Create a notification row for many users. */
async function notifyMany(userIds, type, content, linkOrDb = null, db = prisma) {
  // Backwards-compatible: 4th arg may be the link string or a txn client.
  const link = typeof linkOrDb === 'string' ? linkOrDb : null;
  const client = typeof linkOrDb === 'string' ? db : linkOrDb || prisma;
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return [];
  return client.notification.createMany({
    data: unique.map((userId) => ({ userId, type, content, link })),
  });
}

module.exports = { notify, notifyMany };
