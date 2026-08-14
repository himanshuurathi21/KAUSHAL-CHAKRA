const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { getSkills, getProfile, updateSkills } = require('../controllers/profileController');

const router = Router();

router.get('/skills', requireAuth, getSkills);
router.get('/profile', requireAuth, getProfile);
router.put('/profile/skills', requireAuth, updateSkills);

module.exports = router;
