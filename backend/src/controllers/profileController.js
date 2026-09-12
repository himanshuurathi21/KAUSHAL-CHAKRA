const prisma = require('../lib/prisma');
const { publicUser } = require('./authController');
const { runMatching } = require('../services/matchingService');

/** GET /api/skills — the fixed taxonomy (no free-text skills allowed). */
async function getSkills(req, res, next) {
  try {
    const skills = await prisma.skill.findMany({ orderBy: { name: 'asc' } });
    res.json({ skills });
  } catch (err) {
    next(err);
  }
}

/** GET /api/profile — current user incl. offered + wanted skills. */
async function getProfile(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        offered: { include: { skill: true } },
        wanted: { include: { skill: true } },
      },
    });
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/profile/skills — replace offered/wanted skills (with optional
 * proficiency levels), then re-run the matching engine so the user (and
 * everyone else) is re-evaluated.
 *
 * Body: { offered: [{ id, level } | id], wanted: [{ id, level } | id] }
 * level is one of BEGINNER | INTERMEDIATE | EXPERT.
 */
async function updateSkills(req, res, next) {
  try {
    const { offered = [], wanted = [], availabilitySlots = null } = req.body || {};
    if (!Array.isArray(offered) || !Array.isArray(wanted)) {
      return res.status(400).json({ error: 'offered and wanted must be arrays of skill ids (or {id, level})' });
    }

    const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'EXPERT'];
    // Strict: level must be explicit if provided as object; bare ids get defaults later but still validated
    const norm = (arr) =>
      arr.map((x) => {
        const obj = typeof x === 'object' && x !== null ? x : { id: x };
        // If caller sent {id, level: undefined} treat as missing → will default after validation
        // If caller sent {id:5} with no level key, we keep null so validation can assign default and still enforce
        const rawLevel = Object.prototype.hasOwnProperty.call(obj, 'level') ? obj.level : null;
        return { id: Number(obj.id), level: rawLevel || null, hadLevelKey: Object.prototype.hasOwnProperty.call(obj, 'level') };
      });
    const offeredNorm = norm(offered);
    const wantedNorm = norm(wanted);

    // Reject non-integer ids up front (NaN/floats would otherwise explode
    // inside Prisma with a 500 instead of a clean 400).
    const allNorm = [...offeredNorm, ...wantedNorm];
    if (!allNorm.every((s) => Number.isInteger(s.id) && s.id > 0)) {
      return res.status(400).json({ error: 'Every skill id must be a positive integer' });
    }

    // Dedupe within each list (by skill id) — last entry wins
    const dedupe = (list) => {
      const map = new Map();
      for (const item of list) map.set(item.id, item);
      return Array.from(map.values());
    };
    const offeredDedupedRaw = dedupe(offeredNorm);
    const wantedDedupedRaw = dedupe(wantedNorm);
    // Apply defaults BEFORE validation so bare ids are not a bypass
    const offeredDeduped = offeredDedupedRaw.map(o => ({ id: o.id, level: o.level || 'INTERMEDIATE' }));
    const wantedDeduped = wantedDedupedRaw.map(w => ({ id: w.id, level: w.level || 'BEGINNER' }));

    // A skill may appear in both offered and wanted (e.g. teach it at a
    // higher level while still learning more) — validate each unique id once.
    const allIds = [...new Set([...offeredDeduped, ...wantedDeduped].map((s) => s.id))];
    const allLevels = [...offeredDeduped, ...wantedDeduped].map((s) => s.level).filter(Boolean);
    if (allLevels.some((l) => !LEVELS.includes(l))) {
      return res.status(400).json({ error: 'level must be BEGINNER, INTERMEDIATE or EXPERT' });
    }

    // Validate every unique id against the taxonomy
    const validCount = allIds.length === 0 ? 0 : await prisma.skill.count({ where: { id: { in: allIds } } });
    if (validCount !== allIds.length) {
      return res.status(400).json({ error: 'One or more skill ids are not in the taxonomy' });
    }

    const ALLOWED_SLOTS = ["WEEKDAY_MORNING","WEEKDAY_AFTERNOON","WEEKDAY_EVENING","WEEKEND_MORNING","WEEKEND_AFTERNOON","WEEKEND_EVENING"];
    let slotsToUpdate = null;
    if (availabilitySlots !== null && availabilitySlots !== undefined) {
      if (!Array.isArray(availabilitySlots)) return res.status(400).json({ error: "availabilitySlots must be an array" });
      const invalid = availabilitySlots.filter(s => !ALLOWED_SLOTS.includes(s));
      if (invalid.length) return res.status(400).json({ error: "Invalid availability slots: " + invalid.join(", ") });
      slotsToUpdate = [...new Set(availabilitySlots)];
    }

    const userId = req.userId;
    // Verification enforcement: INTERMEDIATE requires quiz, EXPERT requires verified certificate
    // Check both new (QuizAttempt/Certificate) and legacy (SkillVerification) so neither path blocks valid users
    for (const { id, level } of offeredDeduped) {
      if (level === "INTERMEDIATE") {
        const [passed, legacy] = await Promise.all([
          prisma.quizAttempt.findFirst({ where: { userId, skillId: id, passed: true } }),
          prisma.skillVerification.findFirst({ where: { userId, skillId: id, status: 'approved' } }),
        ]);
        if (!passed && !legacy) return res.status(400).json({ error: "Level INTERMEDIATE for skill " + id + " requires passing the quiz for that skill" });
      } else if (level === "EXPERT") {
        const [cert, legacy] = await Promise.all([
          prisma.certificate.findFirst({ where: { userId, skillId: id, status: "VERIFIED" } }),
          prisma.skillVerification.findFirst({ where: { userId, skillId: id, status: 'approved', claimedLevel: 'EXPERT' } }),
        ]);
        if (!cert && !legacy) return res.status(400).json({ error: "Level EXPERT for skill " + id + " requires a verified certificate for that skill" });
      }
    }


    // Replace offered skills + availability atomically
    const ops = [
      prisma.userOfferedSkill.deleteMany({ where: { userId } }),
      prisma.userWantedSkill.deleteMany({ where: { userId } }),
      ...offeredDeduped.map(({ id, level }) =>
        prisma.userOfferedSkill.create({ data: { userId, skillId: id, level, verificationStatus: level === 'EXPERT' ? 'CERT_VERIFIED' : level === 'INTERMEDIATE' ? 'QUIZ_PASSED' : 'NONE' } })
      ),
      ...wantedDeduped.map(({ id, level }) =>
        prisma.userWantedSkill.create({ data: { userId, skillId: id, level } })
      ),
    ];
    if (slotsToUpdate !== null) {
      ops.push(prisma.user.update({ where: { id: userId }, data: { availabilitySlots: slotsToUpdate } }));
    }
    await prisma.$transaction(ops);

    // Skill changes may unlock new cycles for everyone — re-run matching
    const newCycles = await runMatching();

    res.json({ ok: true, newCyclesProposed: newCycles.length });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSkills, getProfile, updateSkills };
