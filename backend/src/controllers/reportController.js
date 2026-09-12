const prisma = require("../lib/prisma");

async function createReport(req, res, next) {
  try {
    const { reportedUserId, reason, taskId, cycleId } = req.body || {};
    const rid = Number(reportedUserId);
    if (!Number.isInteger(rid)) return res.status(400).json({ error: "reportedUserId is required" });
    if (typeof reason !== "string" || !reason.trim()) return res.status(400).json({ error: "reason is required" });
    if (rid === req.userId) return res.status(400).json({ error: "You cannot report yourself" });
    const reported = await prisma.user.findUnique({ where: { id: rid } });
    if (!reported) return res.status(404).json({ error: "Reported user not found" });
    let tid = null, cid = null;
    if (taskId !== undefined && taskId !== null) {
      tid = Number(taskId);
      if (!Number.isInteger(tid)) return res.status(400).json({ error: "Invalid taskId" });
    }
    if (cycleId !== undefined && cycleId !== null) {
      cid = Number(cycleId);
      if (!Number.isInteger(cid)) return res.status(400).json({ error: "Invalid cycleId" });
    }
    const report = await prisma.report.create({
      data: { reporterId: req.userId, reportedUserId: rid, reason: reason.trim(), taskId: tid, cycleId: cid, status: "PENDING" }
    });
    res.status(201).json({ report });
  } catch (err) { next(err); }
}

async function getPendingReports(req, res, next) {
  try {
    const reports = await prisma.report.findMany({
      where: { status: "PENDING" },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        reportedUser: { select: { id: true, name: true, email: true } },
        task: true,
        cycle: true
      },
      orderBy: { createdAt: "asc" }
    });
    res.json({ reports });
  } catch (err) { next(err); }
}

async function resolveReport(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid report id" });
    const { action, status } = req.body || {};
    const act = (action || status || "").toString().toLowerCase();
    let newStatus;
    if (act === "warning" || act === "warned") newStatus = "WARNED";
    else if (act === "removal" || act === "removed" || act === "remove") newStatus = "REMOVED";
    else if (act === "credit_hold" || act === "credit_hold" || act === "credit hold" || act === "credithold") newStatus = "CREDIT_HOLD";
    else return res.status(400).json({ error: "action must be warning, removal, or credit_hold" });
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) return res.status(404).json({ error: "Report not found" });
    if (report.status !== "PENDING") return res.status(400).json({ error: "Report already resolved" });
    const updated = await prisma.report.update({ where: { id }, data: { status: newStatus, resolvedAt: new Date() } });
    if (newStatus === "REMOVED") {
      await prisma.user.update({ where: { id: report.reportedUserId }, data: { isActive: false } });
    } else if (newStatus === "CREDIT_HOLD") {
      await prisma.user.update({ where: { id: report.reportedUserId }, data: { creditsFrozen: true } });
    }
    res.json({ report: updated });
  } catch (err) { next(err); }
}

module.exports = { createReport, getPendingReports, resolveReport };
