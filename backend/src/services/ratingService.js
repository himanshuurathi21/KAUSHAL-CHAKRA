/**
 * Rating service — pure logic for who can rate whom.
 * In a cycle each participant only directly exchanges with their immediate
 * neighbors in the chain, so a rating is only valid between users linked by
 * an actual exchange edge — not merely a coincidental shared skill id.
 */

/**
 * True when the rater and ratee are directly connected in the exchange chain:
 * the ratee is the participant who teaches what the rater learns, or the one
 * who learns what the rater teaches.
 */
function canRateEachOther(participants, raterId, rateeId) {
  const rid = Number(rateeId);
  if (raterId === rid) return false;
  const rater = participants.find((p) => p.userId === raterId);
  const ratee = participants.find((p) => p.userId === rid);
  if (!rater || !ratee) return false;
  const myTeacher = participants.find((p) => p.teachesSkillId === rater.learnsSkillId);
  const myLearner = participants.find((p) => p.learnsSkillId === rater.teachesSkillId);
  return myTeacher?.userId === ratee.userId || myLearner?.userId === ratee.userId;
}

module.exports = { canRateEachOther };
