const { Router } = require('express');
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

// Debug/viva endpoint: raw adjacency list of the current graph
router.get('/debug/graph', requireAuth, debugGraph);

// All matching routes are behind auth
router.post('/match/run', requireAuth, runMatch);
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
