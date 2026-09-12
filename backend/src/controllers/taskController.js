const prisma = require("../lib/prisma");
const { withCreditLock } = require("../services/creditService");
const { notify } = require("../services/notificationService");

const ALLOWED_CATEGORIES = ["Design", "Writing", "Tech Setup", "Development", "Marketing", "Tutoring", "Other"];

async function createTask(req, res, next) {
  try {
    const { title, description, category, creditValue } = req.body || {};
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "title is required" });
    if (typeof description !== "string" || !description.trim()) return res.status(400).json({ error: "description is required" });
    if (!ALLOWED_CATEGORIES.includes(category)) return res.status(400).json({ error: "category must be one of " + ALLOWED_CATEGORIES.join(", ") });
    const cv = Number(creditValue);
    if (!Number.isInteger(cv) || cv <= 0) return res.status(400).json({ error: "creditValue must be a positive integer" });
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (user.creditsFrozen) return res.status(403).json({ error: "Your credits are frozen due to a report" });
    if (!user.isActive) return res.status(403).json({ error: "Your account is deactivated" });
    const task = await prisma.task.create({
      data: {
        posterId: req.userId,
        title: title.trim(),
        description: description.trim(),
        category,
        creditValue: cv,
        status: "OPEN",
        requiredSkillId: req.body.requiredSkillId ? Number(req.body.requiredSkillId) : null,
        deliverable: typeof req.body.deliverable === 'string' ? req.body.deliverable.trim().slice(0, 500) : null,
        complexity: ['S','M','L'].includes(req.body.complexity) ? req.body.complexity : 'M',
        deadline: req.body.deadline ? new Date(req.body.deadline) : null,
      }
    });
    try {
      const { rewardFirstTask } = require('../services/creditRewardService');
      await rewardFirstTask(req.userId);
    } catch (e) { console.error('first_task credit failed', e); }
    res.status(201).json({ task });
  } catch (err) { next(err); }
}

async function listTasks(req, res, next) {
  try {
    const { category } = req.query || {};
    const where = { status: "OPEN" };
    if (category) {
      if (!ALLOWED_CATEGORIES.includes(category)) return res.status(400).json({ error: "Invalid category" });
      where.category = category;
    }
    const tasks = await prisma.task.findMany({
      where,
      include: { poster: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json({ tasks });
  } catch (err) { next(err); }
}

async function claimTask(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    if (!Number.isInteger(taskId)) return res.status(400).json({ error: "Invalid task id" });
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.status !== "OPEN") return res.status(400).json({ error: "Task is not open" });
    if (task.posterId === req.userId) return res.status(400).json({ error: "You cannot claim your own task" });
    const helper = await prisma.user.findUnique({ where: { id: req.userId } });
    if (helper.creditsFrozen) return res.status(403).json({ error: "Your credits are frozen" });
    if (!helper.isActive) return res.status(403).json({ error: "Your account is deactivated" });
    const hasActiveCycle = await prisma.matchCycleParticipant.findFirst({ where: { userId: req.userId, cycle: { status: { in: ["proposed", "confirmed"] } } } });
    const hasOpenSession = await prisma.creditSession.findFirst({ where: { OR: [{ teacherId: req.userId }, { learnerId: req.userId }], status: { in: ["proposed", "active"] } } });
    if (hasActiveCycle) return res.status(400).json({ error: "You are in an active cycle" });
    if (hasOpenSession) return res.status(400).json({ error: "You have an open credit session" });
    // Check poster has enough credits to pay
    const posterBalanceAgg = await prisma.credit.aggregate({ where: { userId: task.posterId }, _sum: { delta: true } });
    const posterBalance = posterBalanceAgg._sum.delta ?? 0;
    if (posterBalance < task.creditValue) {
      return res.status(400).json({ error: `Poster has insufficient credits (${posterBalance} < ${task.creditValue})` });
    }
    // Atomic claim: ensure task still OPEN and create session
    let session;
    try {
      session = await prisma.$transaction(async (tx) => {
        const updated = await tx.task.updateMany({ where: { id: task.id, status: "OPEN" }, data: { status: "IN_PROGRESS" } });
        if (updated.count === 0) throw Object.assign(new Error("Task is no longer open"), { status: 400 });
        return tx.creditSession.create({
          data: {
            teacherId: req.userId,
            learnerId: task.posterId,
            skillId: null,
            taskId: task.id,
            type: "TASK",
            createdBy: "teacher",
            status: "proposed"
          },
          include: { task: true, teacher: { select: { id: true, name: true } }, learner: { select: { id: true, name: true } } }
        });
      });
    } catch (err) {
      if (err?.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }
    await notify(task.posterId, 'credit_session', `${helper.name} claimed your task "${task.title}" — accept in Credits/Tasks.`, '/credits');
    res.status(201).json({ session });
  } catch (err) { next(err); }
}

module.exports = { createTask, listTasks, claimTask };
