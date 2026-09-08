const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const {
  runMatch,
  getMyStatus,
  getCycle,
  acceptCycle,
  rejectCycle,
  getExchanges,
  completeExchange,
  debugGraph,
} = require('../controllers/matchController');
const { sendMessage, getMessages } = require('../controllers/chatController');

const router = Router();

// Debug/viva endpoint: raw adjacency list of the current graph.
// Admin-only: it discloses every user's name and skill graph.
router.get('/debug/graph', requireAuth, requireAdmin, debugGraph);

// Matching triggers re-propose cycles + notify every user, so the manual
// trigger is rate-limited per IP (the Dashboard button calls this).
const matchRunLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many matching requests — please wait a minute and try again.' },
});

// All matching routes are behind auth
router.post('/match/run', requireAuth, matchRunLimiter, runMatch);
router.get('/match/status', requireAuth, getMyStatus);
router.get('/match/cycle/:id', requireAuth, getCycle);
router.post('/match/cycle/:id/accept', requireAuth, acceptCycle);
router.post('/match/cycle/:id/reject', requireAuth, rejectCycle);
router.post('/match/cycle/:id/complete', requireAuth, completeExchange);
router.get('/match/exchanges', requireAuth, getExchanges);

// Cycle-scoped features (completion + chat) — new endpoint naming
router.post('/cycles/:id/complete', requireAuth, completeExchange);
router.post('/cycles/:id/messages', requireAuth, sendMessage);
router.get('/cycles/:id/messages', requireAuth, getMessages);

module.exports = router;
