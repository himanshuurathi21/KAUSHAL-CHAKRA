const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { signToken } = require('../middleware/auth');

/** POST /api/auth/signup — create account, return JWT + user. */
async function signup(req, res, next) {
  try {
    const { name, email, password, department } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 10),
        department: department || null,
      },
    });

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/auth/login — verify credentials, return JWT + user. */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/auth/me — current user (JWT protected). */
async function me(req, res, next) {
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

/** Strip sensitive fields before sending to the client. */
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    department: user.department,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
    offered: (user.offered ?? []).map((o) => ({ ...o.skill, level: o.level })),
    wanted: (user.wanted ?? []).map((w) => ({ ...w.skill, level: w.level })),
  };
}

module.exports = { signup, login, me, publicUser };
