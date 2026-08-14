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
    const allIds = [...offeredNorm, ...wantedNorm].map((s) => s.id);
    const allLevels = [...offeredNorm, ...wantedNorm].map((s) => s.level).filter(Boolean);
    if (allLevels.some((l) => !LEVELS.includes(l))) {
      return res.status(400).json({ error: 'level must be BEGINNER, INTERMEDIATE or EXPERT' });
    }

    // Validate every id against the taxonomy
    const validCount = await prisma.skill.count({ where: { id: { in: allIds } } });
    if (validCount !== new Set(allIds).size) {
      return res.status(400).json({ error: 'One or more skill ids are not in the taxonomy' });
    }

    const userId = req.userId;
    // Replace offered skills
    await prisma.$transaction([
      prisma.userOfferedSkill.deleteMany({ where: { userId } }),
      prisma.userWantedSkill.deleteMany({ where: { userId } }),
      ...offeredNorm.map(({ id, level }) =>
        prisma.userOfferedSkill.create({ data: { userId, skillId: id, level: level || 'INTERMEDIATE' } })
      ),
      ...wantedNorm.map(({ id, level }) =>
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
