const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// Fail fast: never boot without a real JWT secret (prevents token forgery
// if someone deploys without setting JWT_SECRET).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Add it to your .env (or environment) before starting.');
  process.exit(1);
}

/** Issue a signed JWT for a user. */
function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Express middleware: verifies the `Authorization: Bearer <token>` header
 * and attaches `req.userId`. Rejects the request with 401 otherwise.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    req.userId = user.id;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Runs after requireAuth; rejects non-admin users with 403. */
async function requireAdmin(req, res, next) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { isAdmin: true },
  });
  if (!user?.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

module.exports = { signToken, requireAuth, requireAdmin };
