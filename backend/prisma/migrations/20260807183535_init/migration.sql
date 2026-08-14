-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOfferedSkill" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,

    CONSTRAINT "UserOfferedSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWantedSkill" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,

    CONSTRAINT "UserWantedSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchCycle" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchCycleParticipant" (
    "id" SERIAL NOT NULL,
    "cycleId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "teachesSkillId" INTEGER NOT NULL,
    "learnsSkillId" INTEGER NOT NULL,
    "accepted" BOOLEAN,

    CONSTRAINT "MatchCycleParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedEdge" (
    "id" SERIAL NOT NULL,
    "fromUserId" INTEGER NOT NULL,
    "toUserId" INTEGER NOT NULL,

    CONSTRAINT "BlockedEdge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserOfferedSkill_userId_skillId_key" ON "UserOfferedSkill"("userId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "UserWantedSkill_userId_skillId_key" ON "UserWantedSkill"("userId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchCycleParticipant_cycleId_userId_key" ON "MatchCycleParticipant"("cycleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedEdge_fromUserId_toUserId_key" ON "BlockedEdge"("fromUserId", "toUserId");

-- AddForeignKey
ALTER TABLE "UserOfferedSkill" ADD CONSTRAINT "UserOfferedSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOfferedSkill" ADD CONSTRAINT "UserOfferedSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWantedSkill" ADD CONSTRAINT "UserWantedSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWantedSkill" ADD CONSTRAINT "UserWantedSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCycleParticipant" ADD CONSTRAINT "MatchCycleParticipant_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "MatchCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCycleParticipant" ADD CONSTRAINT "MatchCycleParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCycleParticipant" ADD CONSTRAINT "MatchCycleParticipant_teachesSkillId_fkey" FOREIGN KEY ("teachesSkillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCycleParticipant" ADD CONSTRAINT "MatchCycleParticipant_learnsSkillId_fkey" FOREIGN KEY ("learnsSkillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedEdge" ADD CONSTRAINT "BlockedEdge_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedEdge" ADD CONSTRAINT "BlockedEdge_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
