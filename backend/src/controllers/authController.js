const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { setSessionCookie, clearSessionCookie } = require('../middleware/auth');

/** Normalize + validate signup/login credentials. Returns {email, password} or {error}. */
function checkCredentials(email, password) {
  const normEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!/^\S+@\S+\.\S+$/.test(normEmail)) {
    return { error: 'A valid email address is required' };
  }
  if (typeof password !== 'string' || password.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }
  if (password.length > 72) {
    // bcrypt silently truncates past 72 bytes — reject instead of weakening.
    return { error: 'Password must be at most 72 characters' };
  }
  return { email: normEmail, password };
}

/** POST /api/auth/signup — create account, return JWT + user. */
async function signup(req, res, next) {
  try {
    const { name, email, password, department } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'A valid name is required' });
    }
    const checked = checkCredentials(email, password);
    if (checked.error) return res.status(400).json({ error: checked.error });

    const existing = await prisma.user.findUnique({ where: { email: checked.email } });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: checked.email,
        passwordHash: await bcrypt.hash(checked.password, 10),
        department: department || null,
      },
    });

    // Cookie for browsers; token in body for scripts (dual-auth).
    const token = setSessionCookie(res, user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/auth/login — verify credentials, return JWT + user. */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Cookie for browsers; token in body for scripts (dual-auth).
    const token = setSessionCookie(res, user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/auth/logout — clear the session cookie. Always succeeds. */
async function logout(req, res) {
  clearSessionCookie(res);
  res.json({ ok: true });
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
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
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

module.exports = { signup, login, logout, me, publicUser };
