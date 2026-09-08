const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { createRating, getUserRatings } = require('../controllers/ratingController');
const { getMine, markRead, markAllRead } = require('../controllers/notificationController');
const { getStats } = require('../controllers/adminController');
const { getMyCredits, teachNow, redeem, acceptSession, declineSession, completeSession } = require('../controllers/creditController');

const router = Router();

// Ratings
router.post('/ratings', requireAuth, createRating);
router.get('/users/:id/ratings', requireAuth, getUserRatings);

// Notifications
router.get('/notifications', requireAuth, getMine);
router.post('/notifications/read-all', requireAuth, markAllRead);
router.post('/notifications/:id/read', requireAuth, markRead);

// Admin
router.get('/admin/stats', requireAuth, requireAdmin, getStats);

// Credits (Phase 3 — teach-now / redeem fallback)
router.get('/credits', requireAuth, getMyCredits);
router.post('/credits/teach', requireAuth, teachNow);
router.post('/credits/redeem', requireAuth, redeem);
router.post('/credits/sessions/:id/accept', requireAuth, acceptSession);
router.post('/credits/sessions/:id/decline', requireAuth, declineSession);
router.post('/credits/sessions/:id/complete', requireAuth, completeSession);

module.exports = router;
