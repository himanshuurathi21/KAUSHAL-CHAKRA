const prisma = require('../lib/prisma');
const { notify, notifyMany } = require('../services/notificationService');
const { getQuiz } = require('../services/quizBank');
const {
  LEVELS,
  PASS_THRESHOLD,
  publicQuestions,
  evaluateSubmission,
} = require('../services/verificationService');

const include = {
  skill: { select: { id: true, name: true } },
  user: { select: { id: true, name: true, email: true } },
};

async function getSkillOr400(skillId, res) {
  const id = Number(skillId);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'A valid skillId is required' });
    return null;
  }
  const skill = await prisma.skill.findUnique({ where: { id } });
  if (!skill) {
    res.status(404).json({ error: 'Skill not found' });
    return null;
  }
  return skill;
}

function checkLevel(claimedLevel, res) {
  if (!LEVELS.includes(claimedLevel)) {
    res.status(400).json({ error: 'claimedLevel must be BEGINNER, INTERMEDIATE or EXPERT' });
    return false;
  }
  return true;
}

/** GET /api/verify/quiz/:skillId — public questions (answers never leave the server). */
async function getQuizQuestions(req, res, next) {
  try {
    const skill = await getSkillOr400(req.params.skillId, res);
    if (!skill) return;
    const questions = getQuiz(skill.name);
    if (!questions) {
      return res.status(404).json({ error: `No quiz available for ${skill.name} yet — submit a certificate instead` });
    }
    res.json({
      skill,
      questions: publicQuestions(questions),
      thresholds: PASS_THRESHOLD,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/verify/quiz/:skillId/submit — grade answers, approve/reject immediately. */
async function submitQuiz(req, res, next) {
  try {
    const skill = await getSkillOr400(req.params.skillId, res);
    if (!skill) return;
    const { answers, claimedLevel } = req.body || {};
    if (!checkLevel(claimedLevel, res)) return;
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers must be an array of option indexes' });
    }

    let result;
    try {
      result = evaluateSubmission(skill.name, answers, claimedLevel);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const verification = await prisma.skillVerification.upsert({
      where: {
        userId_skillId_method: { userId: req.userId, skillId: skill.id, method: 'QUIZ' },
      },
      update: {
        claimedLevel,
        status: result.passed ? 'approved' : 'rejected',
        score: result.score,
        total: result.total,
        reviewerId: null,
        reviewedAt: null,
      },
      create: {
        userId: req.userId,
        skillId: skill.id,
        claimedLevel,
        method: 'QUIZ',
        status: result.passed ? 'approved' : 'rejected',
        score: result.score,
        total: result.total,
      },
      include,
    });

    await notify(
      req.userId,
      'verification',
      result.passed
        ? `Quiz passed — your ${claimedLevel} level in ${skill.name} is now verified.`
        : `Quiz score ${result.score}/${result.total} is below the ${claimedLevel} bar for ${skill.name}. Try again!`,
      '/verify'
    );

    res.status(201).json({ verification, ...result });
  } catch (err) {
    next(err);
  }
}

/** POST /api/verify/certificate — submit certificate evidence for admin review. */
async function submitCertificate(req, res, next) {
  try {
    const { skillId, claimedLevel, evidenceUrl, issuer, note } = req.body || {};
    const skill = await getSkillOr400(skillId, res);
    if (!skill) return;
    if (!checkLevel(claimedLevel, res)) return;
    if (typeof evidenceUrl !== 'string' || !/^https?:\/\//i.test(evidenceUrl.trim())) {
      return res.status(400).json({ error: 'evidenceUrl must be an http(s) link to the certificate' });
    }
    if (issuer !== undefined && (typeof issuer !== 'string' || issuer.length > 120)) {
      return res.status(400).json({ error: 'issuer must be a short text label' });
    }

    const verification = await prisma.skillVerification.upsert({
      where: {
        userId_skillId_method: { userId: req.userId, skillId: skill.id, method: 'CERTIFICATE' },
      },
      update: {
        claimedLevel,
        status: 'pending',
        evidenceUrl: evidenceUrl.trim(),
        issuer: issuer?.trim() || null,
        note: typeof note === 'string' ? note.slice(0, 500) : null,
        reviewerId: null,
        reviewedAt: null,
      },
      create: {
        userId: req.userId,
        skillId: skill.id,
        claimedLevel,
        method: 'CERTIFICATE',
        status: 'pending',
        evidenceUrl: evidenceUrl.trim(),
        issuer: issuer?.trim() || null,
        note: typeof note === 'string' ? note.slice(0, 500) : null,
      },
      include,
    });

    // Ping every admin so the certificate doesn't sit unreviewed.
    const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
    await notifyMany(
      admins.map((a) => a.id).filter((id) => id !== req.userId),
      'verification',
      `New certificate to review for ${skill.name}.`,
      '/verify'
    );

    res.status(201).json({ verification });
  } catch (err) {
    next(err);
  }
}

/** GET /api/verify/mine — my verification attempts + statuses. */
async function getMyVerifications(req, res, next) {
  try {
    const verifications = await prisma.skillVerification.findMany({
      where: { userId: req.userId },
      include,
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ verifications });
  } catch (err) {
    next(err);
  }
}

/** GET /api/verify/pending — admin queue of certificate submissions. */
async function getPending(req, res, next) {
  try {
    const verifications = await prisma.skillVerification.findMany({
      where: { status: 'pending' },
      include,
      orderBy: { createdAt: 'asc' },
    });
    res.json({ verifications });
  } catch (err) {
    next(err);
  }
}

/** POST /api/verify/:id/review — admin approves or rejects a submission. */
async function reviewVerification(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid verification id' });
    }
    const { approve } = req.body || {};
    if (typeof approve !== 'boolean') {
      return res.status(400).json({ error: 'approve must be true or false' });
    }
    const verification = await prisma.skillVerification.findUnique({
      where: { id },
      include: { skill: true },
    });
    if (!verification) return res.status(404).json({ error: 'Verification not found' });
    if (verification.status !== 'pending') {
      return res.status(400).json({ error: `This submission is already ${verification.status}` });
    }

    const updated = await prisma.skillVerification.update({
      where: { id },
      data: {
        status: approve ? 'approved' : 'rejected',
        reviewerId: req.userId,
        reviewedAt: new Date(),
      },
      include,
    });

    await notify(
      verification.userId,
      'verification',
      approve
        ? `Your ${verification.claimedLevel} certificate for ${verification.skill.name} was approved — badge unlocked.`
        : `Your certificate for ${verification.skill.name} was not approved. Check the evidence link and resubmit.`,
      '/verify'
    );

    res.json({ verification: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getQuizQuestions,
  submitQuiz,
  submitCertificate,
  getMyVerifications,
  getPending,
  reviewVerification,
};
