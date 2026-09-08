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
    const { offered = [], wanted = [] } = req.body || {};
    if (!Array.isArray(offered) || !Array.isArray(wanted)) {
      return res.status(400).json({ error: 'offered and wanted must be arrays of skill ids (or {id, level})' });
    }

    const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'EXPERT'];
    const norm = (arr) =>
      arr.map((x) => {
        const obj = typeof x === 'object' && x !== null ? x : { id: x };
        return { id: Number(obj.id), level: obj.level || null };
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
    const offeredDeduped = dedupe(offeredNorm);
    const wantedDeduped = dedupe(wantedNorm);

    // A skill may appear in both offered and wanted (e.g. teach it at a
    // higher level while still learning more) — validate each unique id once.
    const allIds = [...new Set([...offeredDeduped, ...wantedDeduped].map((s) => s.id))];
    const allLevels = [...offeredDeduped, ...wantedDeduped].map((s) => s.level).filter(Boolean);
    if (allLevels.some((l) => !LEVELS.includes(l))) {
      return res.status(400).json({ error: 'level must be BEGINNER, INTERMEDIATE or EXPERT' });
    }

    // Validate every unique id against the taxonomy
    const validCount = await prisma.skill.count({ where: { id: { in: allIds } } });
    if (validCount !== allIds.length) {
      return res.status(400).json({ error: 'One or more skill ids are not in the taxonomy' });
    }

    const userId = req.userId;
    // Replace offered skills
    await prisma.$transaction([
      prisma.userOfferedSkill.deleteMany({ where: { userId } }),
      prisma.userWantedSkill.deleteMany({ where: { userId } }),
      ...offeredDeduped.map(({ id, level }) =>
        prisma.userOfferedSkill.create({ data: { userId, skillId: id, level: level || 'INTERMEDIATE' } })
      ),
      ...wantedDeduped.map(({ id, level }) =>
        prisma.userWantedSkill.create({ data: { userId, skillId: id, level: level || 'BEGINNER' } })
      ),
    ]);

    // Skill changes may unlock new cycles for everyone — re-run matching
    const newCycles = await runMatching();

    res.json({ ok: true, newCyclesProposed: newCycles.length });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSkills, getProfile, updateSkills };
