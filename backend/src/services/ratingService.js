/**
 * Rating service — pure logic for who can rate whom.
 * In a cycle each participant only directly exchanges with their immediate
 * neighbors in the chain, so a rating is only valid when the two users
 * taught/learned the same skill from each other (adjacency check).
 */

/**
 * True when the rater and ratee are directly connected in the exchange chain.
 * A rater is adjacent to a ratee when one of them teaches exactly the skill
 * the other one learns (and vice versa).
 */
function canRateEachOther(participants, raterId, rateeId) {
  const rater = participants.find((p) => p.userId === raterId);
  const ratee = participants.find((p) => p.userId === Number(rateeId));
  if (!rater || !ratee) return false;
  return (
    rater.learnsSkillId === ratee.teachesSkillId ||
    rater.teachesSkillId === ratee.learnsSkillId
  );
}

module.exports = { canRateEachOther };
