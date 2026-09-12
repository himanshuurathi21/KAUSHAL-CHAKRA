const prisma = require("../lib/prisma");

async function createCertificate(req, res, next) {
  try {
    const { skillId, issuer, verificationId } = req.body || {};
    const sid = Number(skillId);
    if (!Number.isInteger(sid)) return res.status(400).json({ error: "skillId is required and must be an integer" });
    if (typeof issuer !== "string" || !issuer.trim()) return res.status(400).json({ error: "issuer is required" });
    if (typeof verificationId !== "string" || !verificationId.trim()) return res.status(400).json({ error: "verificationId is required" });
    const skill = await prisma.skill.findUnique({ where: { id: sid } });
    if (!skill) return res.status(404).json({ error: "Skill not found" });
    const cert = await prisma.certificate.create({
      data: { userId: req.userId, skillId: sid, issuer: issuer.trim(), verificationId: verificationId.trim(), status: "PENDING" }
    });
    await prisma.userOfferedSkill.updateMany({ where: { userId: req.userId, skillId: sid }, data: { verificationStatus: "CERT_SUBMITTED" } });
    res.status(201).json({ certificate: cert });
  } catch (err) { next(err); }
}

async function reviewCertificate(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid certificate id" });
    const { status, action } = req.body || {};
    const finalStatus = (status || action || "").toString().toUpperCase();
    if (!["VERIFIED", "REJECTED", "APPROVED", "REJECT"].includes(finalStatus)) return res.status(400).json({ error: "status must be VERIFIED or REJECTED" });
    const normalized = finalStatus === "APPROVED" ? "VERIFIED" : finalStatus === "REJECT" ? "REJECTED" : finalStatus;
    const cert = await prisma.certificate.findUnique({ where: { id } });
    if (!cert) return res.status(404).json({ error: "Certificate not found" });
    if (cert.status !== "PENDING") return res.status(400).json({ error: "Certificate already reviewed" });
    const updated = await prisma.certificate.update({ where: { id }, data: { status: normalized } });
    if (normalized === "VERIFIED") {
      await prisma.userOfferedSkill.updateMany({ where: { userId: cert.userId, skillId: cert.skillId }, data: { verificationStatus: "CERT_VERIFIED" } });
    } else {
      // On rejection, clear to NONE so user can retry; don't leave as SUBMITTED which implies pending
      await prisma.userOfferedSkill.updateMany({ where: { userId: cert.userId, skillId: cert.skillId }, data: { verificationStatus: "NONE" } });
    }
    res.json({ certificate: updated });
  } catch (err) { next(err); }
}

module.exports = { createCertificate, reviewCertificate };
