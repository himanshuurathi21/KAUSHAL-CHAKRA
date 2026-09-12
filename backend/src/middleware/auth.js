const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// Fail fast: never boot without a real JWT secret (prevents token forgery
// if someone deploys without setting JWT_SECRET).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Add it to your .env (or environment) before starting.');
  process.exit(1);
}

// 7 days, in seconds — matches the JWT expiry.
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    // Lax blocks cross-site cookie sends on POST/PUT (our mutations) while
    // keeping top-level navigation working. Combined with an API that has no
    // cookie-authenticated GETs with side effects, this is our CSRF story:
    // no CSRF tokens needed because cross-site state changes can't happen.
    sameSite: 'lax',
    // Browsers reject Secure cookies over http (local dev), so only require
    // Secure in production (Render serves https).
    secure: isProd,
    path: '/',
    maxAge: SESSION_MAX_AGE * 1000,
  };
}

/** Issue a signed JWT for a user. */
function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

/** Set the httpOnly session cookie (browsers). The token is ALSO returned
 * in the JSON body so API clients / scripts can keep using Bearer auth. */
function setSessionCookie(res, user) {
  const token = signToken(user);
  res.cookie('kc_session', token, cookieOptions());
  return token;
}

/** Clear the session cookie (logout). Safe to call when already logged out. */
function clearSessionCookie(res) {
  res.clearCookie('kc_session', { ...cookieOptions(), maxAge: undefined });
}

/**
 * Resolve the caller's token: httpOnly cookie first (browsers), then the
 * Authorization header (scripts, smoke tests, viva curl demos).
 * Pure — unit-tested.
 */
function resolveToken(req) {
  if (req.cookies?.kc_session) return req.cookies.kc_session;
  const header = req.headers?.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

/**
 * Express middleware: verifies the session cookie or the
 * `Authorization: Bearer <token>` header and attaches `req.userId`.
 * Rejects the request with 401 otherwise.
 */
async function requireAuth(req, res, next) {
  const token = resolveToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // DB failures here are server errors (500 via next), not auth failures.
  try {
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    if (user.isActive === false) return res.status(403).json({ error: 'Your account has been deactivated' });
    req.userId = user.id;
    next();
  } catch (err) {
    next(err);
  }
}

/** Runs after requireAuth; rejects non-admin users with 403. */
async function requireAdmin(req, res, next) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { signToken, setSessionCookie, clearSessionCookie, resolveToken, requireAuth, requireAdmin };
