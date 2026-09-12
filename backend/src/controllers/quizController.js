const prisma = require("../lib/prisma");
async function getQuiz(req, res, next) {
  try {
    const skillId = Number(req.params.id);
    if (!Number.isInteger(skillId)) return res.status(400).json({ error: "Invalid skill id" });
    const questions = await prisma.quizQuestion.findMany({ where: { skillId }, orderBy: { id: 'asc' } });
    if (questions.length === 0) return res.status(404).json({ error: "No quiz available for this skill" });
    const publicQuestions = questions.map(q => ({ id: q.id, question: q.question, options: q.options }));
    res.json({ questions: publicQuestions });
  } catch (err) { next(err); }
}
async function submitQuiz(req, res, next) {
  try {
    const skillId = Number(req.params.id);
    if (!Number.isInteger(skillId)) return res.status(400).json({ error: "Invalid skill id" });
    const { answers } = req.body || {};
    if (!Array.isArray(answers)) return res.status(400).json({ error: "answers must be an array" });
    const questions = await prisma.quizQuestion.findMany({ where: { skillId }, orderBy: { id: 'asc' } });
    if (questions.length === 0) return res.status(404).json({ error: "No quiz available for this skill" });
    let score = 0;
    for (let i = 0; i < questions.length; i++) {
      if (answers[i] === questions[i].correctOptionIndex) score++;
    }
    const passed = score / questions.length >= 0.6;
    const attempt = await prisma.quizAttempt.create({ data: { userId: req.userId, skillId, score, passed } });
    if (passed) {
      await prisma.userOfferedSkill.updateMany({ where: { userId: req.userId, skillId }, data: { verificationStatus: "QUIZ_PASSED" } });
    }
    res.status(201).json({ attempt, score, total: questions.length, passed });
  } catch (err) { next(err); }
}

module.exports = { getQuiz, submitQuiz };
