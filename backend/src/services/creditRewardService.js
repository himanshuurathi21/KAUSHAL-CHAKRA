const prisma = require('../lib/prisma');

/**
 * Server-authoritative credit rewards — idempotent.
 * All amounts are fixed server-side, never trusted from client.
 */
const REWARDS = {
  welcome: 20,
  first_task: 5,
  task_swap_complete: 15,
  // future: profile:10, skill_add:5 etc
};

async function hasReward(userId, reason, refId = null, db = prisma) {
  const where = { userId, reason };
  if (refId !== null) {
    if (reason === 'task_swap_complete') where.taskSwapId = refId;
    else where.sessionId = refId;
  }
  // For idempotent once-per-user reasons, we check existence without ref
  const count = await db.credit.count({ where });
  return count > 0;
}

/**
 * Give welcome credits to a new user (once).
 * Called on signup.
 */
async function rewardWelcome(userId, db = prisma) {
  if (await hasReward(userId, 'welcome', null, db)) return null;
  return db.credit.create({
    data: { userId, delta: REWARDS.welcome, reason: 'welcome', sessionId: null },
  });
}

async function rewardFirstTask(userId, db = prisma) {
  if (await hasReward(userId, 'first_task', null, db)) return null;
  return db.credit.create({
    data: { userId, delta: REWARDS.first_task, reason: 'first_task', sessionId: null },
  });
}

async function rewardTaskSwapComplete(userId, taskSwapId, db = prisma) {
  if (await hasReward(userId, 'task_swap_complete', taskSwapId, db)) return null;
  return db.credit.create({
    data: { userId, delta: REWARDS.task_swap_complete, reason: 'task_swap_complete', taskSwapId },
  });
}

module.exports = { REWARDS, rewardWelcome, rewardFirstTask, rewardTaskSwapComplete, hasReward };
