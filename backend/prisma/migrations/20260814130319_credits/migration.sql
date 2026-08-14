-- CreateTable
CREATE TABLE "Credit" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "sessionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditSession" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "learnerId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CreditSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Credit_userId_idx" ON "Credit"("userId");

-- CreateIndex
CREATE INDEX "CreditSession_teacherId_idx" ON "CreditSession"("teacherId");

-- CreateIndex
CREATE INDEX "CreditSession_learnerId_idx" ON "CreditSession"("learnerId");

-- CreateIndex
CREATE INDEX "CreditSession_status_idx" ON "CreditSession"("status");

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CreditSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditSession" ADD CONSTRAINT "CreditSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditSession" ADD CONSTRAINT "CreditSession_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditSession" ADD CONSTRAINT "CreditSession_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
