const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { signup, login, logout, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// Brute-force guard on credential endpoints ONLY (20/15min per IP).
// GET /me and POST /logout are session-validated, not credential-guessing
// targets — counting them would lock out users who simply reload the app.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts — please wait 15 minutes and try again.' },
});

router.post('/signup', credentialLimiter, signup);
router.post('/login', credentialLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

module.exports = router;
