/**
 * Skill verification helpers — pure logic (quiz grading + level mapping).
 * DB access lives in verifyController.js; this module is unit-tested.
 */
const { getQuiz } = require('./quizBank');

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'EXPERT'];

/** Minimum score ratio required to verify each claimed level. */
const PASS_THRESHOLD = { BEGINNER: 0.4, INTERMEDIATE: 0.6, EXPERT: 0.8 };

/** Grade submitted answers (array of option indexes) against questions. */
function gradeQuiz(questions, answers) {
  if (!Array.isArray(answers)) throw new Error('answers must be an array');
  let score = 0;
  for (let i = 0; i < questions.length; i++) {
    if (answers[i] === questions[i].answer) score++;
  }
  return { score, total: questions.length };
}

/** Highest level cleared by a score ratio, or null if none. */
function levelForScore(ratio) {
  if (ratio >= PASS_THRESHOLD.EXPERT) return 'EXPERT';
  if (ratio >= PASS_THRESHOLD.INTERMEDIATE) return 'INTERMEDIATE';
  if (ratio >= PASS_THRESHOLD.BEGINNER) return 'BEGINNER';
  return null;
}

/** Does a score ratio verify the claimed level? */
function passesClaim(ratio, claimedLevel) {
  if (!LEVELS.includes(claimedLevel)) throw new Error('Unknown level');
  return ratio >= PASS_THRESHOLD[claimedLevel];
}

/** Strip answers before sending questions to the client. */
function publicQuestions(questions) {
  return questions.map(({ q, options, level }) => ({ q, options, level }));
}

/** Full quiz flow for one submission: grade + verdict for the claimed level. */
function evaluateSubmission(skillName, answers, claimedLevel) {
  const questions = getQuiz(skillName);
  if (!questions) throw new Error('No quiz available for this skill');
  if (!LEVELS.includes(claimedLevel)) throw new Error('Unknown level');
  const { score, total } = gradeQuiz(questions, answers);
  const ratio = total === 0 ? 0 : score / total;
  const passed = passesClaim(ratio, claimedLevel);
  return { score, total, ratio, passed, awardedLevel: levelForScore(ratio) };
}

module.exports = {
  LEVELS,
  PASS_THRESHOLD,
  gradeQuiz,
  levelForScore,
  passesClaim,
  publicQuestions,
  evaluateSubmission,
};
