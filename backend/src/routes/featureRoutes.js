const { Router } = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { createRating, getUserRatings } = require("../controllers/ratingController");
const { getMine, markRead, markAllRead } = require("../controllers/notificationController");
const { getStats, getSkillGaps } = require("../controllers/adminController");
const { getMyCredits, teachNow, redeem, acceptSession, declineSession, completeSession } = require("../controllers/creditController");
const {
  getQuizQuestions,
  submitQuiz: submitOldQuiz,
  submitCertificate: submitOldCertificate,
  getMyVerifications,
  getPending,
  reviewVerification,
} = require("../controllers/verifyController");
const { getQuiz, submitQuiz } = require("../controllers/quizController");
const { createCertificate, reviewCertificate } = require("../controllers/certificateController");
const { createReport, getPendingReports, resolveReport } = require("../controllers/reportController");
const { createTask, listTasks, claimTask } = require("../controllers/taskController");

const router = Router();

// Ratings
router.post("/ratings", requireAuth, createRating);
router.get("/users/:id/ratings", requireAuth, getUserRatings);

// Notifications
router.get("/notifications", requireAuth, getMine);
router.post("/notifications/read-all", requireAuth, markAllRead);
router.post("/notifications/:id/read", requireAuth, markRead);

// Admin
router.get("/admin/stats", requireAuth, requireAdmin, getStats);
router.get("/admin/skill-gaps", requireAuth, requireAdmin, getSkillGaps);
router.get("/admin/reports", requireAuth, requireAdmin, getPendingReports);
router.post("/admin/reports/:id/resolve", requireAuth, requireAdmin, resolveReport);
router.post("/admin/certificates/:id/review", requireAuth, requireAdmin, reviewCertificate);

// Credits
router.get("/credits", requireAuth, getMyCredits);
router.post("/credits/teach", requireAuth, teachNow);
router.post("/credits/redeem", requireAuth, redeem);
router.post("/credits/sessions/:id/accept", requireAuth, acceptSession);
router.post("/credits/sessions/:id/decline", requireAuth, declineSession);
router.post("/credits/sessions/:id/complete", requireAuth, completeSession);

// Skill verification (old)
router.get("/verify/quiz/:skillId", requireAuth, getQuizQuestions);
router.post("/verify/quiz/:skillId/submit", requireAuth, submitOldQuiz);
router.post("/verify/certificate", requireAuth, submitOldCertificate);
router.get("/verify/mine", requireAuth, getMyVerifications);
router.get("/verify/pending", requireAuth, requireAdmin, getPending);
router.post("/verify/:id/review", requireAuth, requireAdmin, reviewVerification);

// New skill verification (QuizQuestion/Certificate)
router.get("/skills/:id/quiz", requireAuth, getQuiz);
router.post("/skills/:id/quiz/submit", requireAuth, submitQuiz);
router.post("/certificates", requireAuth, createCertificate);

// Reports
router.post("/reports", requireAuth, createReport);

// Tasks
router.post("/tasks", requireAuth, createTask);
router.get("/tasks", requireAuth, listTasks);
router.post("/tasks/:id/claim", requireAuth, claimTask);

module.exports = router;
