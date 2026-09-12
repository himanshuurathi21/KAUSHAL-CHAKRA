const prisma = require('../lib/prisma');
const { loadGraphData } = require('../services/matchingService');
const { matchUsers } = require('../services/matchingEngine');

/**
 * GET /api/admin/stats — admin analytics dashboard.
 *
 * The headline number is the direct-swap comparison: of all users the
 * cyclic engine would match today, what % would NOT have matched under
 * a direct-swap-only system (maxLength forced to 2). That is the proof
 * the cyclic algorithm adds value beyond 1-to-1 matching.
 */
async function getStats(req, res, next) {
  try {
    const [totalUsers, totalConfirmedCycles, cycleRows] = await Promise.all([
      prisma.user.count(),
      prisma.matchCycle.count({ where: { status: { in: ['confirmed', 'completed'] } } }),
      prisma.matchCycle.findMany({
        where: { status: { in: ['confirmed', 'completed'] } },
        include: { _count: { select: { participants: true } } },
      }),
    ]);

    // Users with a profile who are not in any active cycle — "waiting".
    // Only proposed/confirmed participants count as busy: completed cycles
    // free their users again (they may be re-matched or back in the pool).
    const [withSkills, activeRows] = await Promise.all([
      prisma.user.count({ where: { OR: [{ offered: { some: {} } }, { wanted: { some: {} } }] } }),
      prisma.matchCycleParticipant.findMany({
        where: { cycle: { status: { in: ['proposed', 'confirmed'] } } },
        select: { userId: true },
      }),
    ]);
    const busyUserIds = new Set(activeRows.map((r) => r.userId));
    const waitingUsers = Math.max(0, withSkills - busyUserIds.size);

    // Cycle-size breakdown
    const sizeCounts = { 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of cycleRows) {
      const size = row._count.participants;
      if (size >= 2 && size <= 5) sizeCounts[size]++;
    }

    // Cyclic vs direct-swap-only comparison on the current graph
    const data = await loadGraphData();
    const cyclic = matchUsers(data.users, { blockedEdges: data.blockedEdges });
    const directOnly = matchUsers(data.users, { blockedEdges: data.blockedEdges, maxLength: 2 });

    const cyclicUserIds = new Set(cyclic.flatMap((c) => c.userIds));
    const directUserIds = new Set(directOnly.flatMap((c) => c.userIds));
    const matchedCyclically = cyclicUserIds.size;
    const matchedDirectly = directUserIds.size;
    const onlyViaCycles = cyclicUserIds.size - directUserIds.size;
    const pctOnlyViaCycles =
      matchedCyclically > 0 ? Math.round((onlyViaCycles / matchedCyclically) * 100) : 0;

    res.json({
      totalUsers,
      totalConfirmedCycles,
      waitingUsers: Math.max(0, waitingUsers),
      cycleSizeBreakdown: sizeCounts,
      comparison: {
        matchedByCyclicEngine: matchedCyclically,
        matchedByDirectSwapOnly: matchedDirectly,
        matchedOnlyViaCycles: onlyViaCycles,
        pctWouldNotMatchWithoutCycles: pctOnlyViaCycles,
      },
    });
  } catch (err) {
    next(err);
  }
}
async function getSkillGaps(req,res,next){
  try{
    const skills=await prisma.skill.findMany({select:{id:true,name:true}});
    const [offeredCounts,wantedCounts]=await Promise.all([prisma.userOfferedSkill.groupBy({by: ["skillId"],_count:{skillId:true}}),prisma.userWantedSkill.groupBy({by:["skillId"],_count:{skillId:true}})]);
    const offeredMap=new Map(offeredCounts.map(r=>[r.skillId,r._count.skillId]));
    const wantedMap=new Map(wantedCounts.map(r=>[r.skillId,r._count.skillId]));
    const gaps=skills.map(s=>{const supply=offeredMap.get(s.id)||0;const demand=wantedMap.get(s.id)||0;return{skillId:s.id,skillName:s.name,demand,supply,gap:demand-supply};}).sort((a,b)=>b.gap-a.gap);
    res.json({gaps});
  }catch(err){next(err);}
}

module.exports = { getStats, getSkillGaps };
