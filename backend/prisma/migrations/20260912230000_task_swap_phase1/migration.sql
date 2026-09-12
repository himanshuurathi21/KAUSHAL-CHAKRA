-- Phase 1: TaskSwap + extended Task/User/Message/Report/Credit
-- This migration was created via db push sync; applying via migrate deploy on Render

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "consentGivenAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "availabilitySlots" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "creditsFrozen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredExchangeType" TEXT;

-- AlterTable UserOfferedSkill
DO $$ BEGIN
  CREATE TYPE "VerificationStatus" AS ENUM ('NONE', 'QUIZ_PASSED', 'CERT_SUBMITTED', 'CERT_VERIFIED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
ALTER TABLE "UserOfferedSkill" ADD COLUMN IF NOT EXISTS "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NONE';

-- CreateTable TaskSwap
CREATE TABLE IF NOT EXISTS "TaskSwap" (
    "id" SERIAL NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "helperId" INTEGER,
    "requestedTaskId" INTEGER NOT NULL,
    "offeredTaskId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "requestedDeliverableLink" TEXT,
    "offeredDeliverableLink" TEXT,
    "requestedSubmittedAt" TIMESTAMP(3),
    "offeredSubmittedAt" TIMESTAMP(3),
    "requestedApprovedAt" TIMESTAMP(3),
    "offeredApprovedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSwap_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TaskSwap_requesterId_idx" ON "TaskSwap"("requesterId");
CREATE INDEX IF NOT EXISTS "TaskSwap_helperId_idx" ON "TaskSwap"("helperId");
CREATE INDEX IF NOT EXISTS "TaskSwap_status_idx" ON "TaskSwap"("status");
CREATE INDEX IF NOT EXISTS "TaskSwap_requestedTaskId_idx" ON "TaskSwap"("requestedTaskId");

DO $$ BEGIN
  ALTER TABLE "TaskSwap" ADD CONSTRAINT "TaskSwap_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "TaskSwap" ADD CONSTRAINT "TaskSwap_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "TaskSwap" ADD CONSTRAINT "TaskSwap_requestedTaskId_fkey" FOREIGN KEY ("requestedTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "TaskSwap" ADD CONSTRAINT "TaskSwap_offeredTaskId_fkey" FOREIGN KEY ("offeredTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable Message
ALTER TABLE "Message" ALTER COLUMN "cycleId" DROP NOT NULL;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "taskSwapId" INTEGER;
CREATE INDEX IF NOT EXISTS "Message_taskSwapId_idx" ON "Message"("taskSwapId");
DO $$ BEGIN
  ALTER TABLE "Message" ADD CONSTRAINT "Message_taskSwapId_fkey" FOREIGN KEY ("taskSwapId") REFERENCES "TaskSwap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable Report
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "taskSwapId" INTEGER;
DO $$ BEGIN
  ALTER TABLE "Report" ADD CONSTRAINT "Report_taskSwapId_fkey" FOREIGN KEY ("taskSwapId") REFERENCES "TaskSwap"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable Task
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "requiredSkillId" INTEGER;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "deliverable" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "complexity" TEXT DEFAULT 'M';
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Task_requiredSkillId_idx" ON "Task"("requiredSkillId");
DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_requiredSkillId_fkey" FOREIGN KEY ("requiredSkillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable Credit
ALTER TABLE "Credit" ADD COLUMN IF NOT EXISTS "taskSwapId" INTEGER;
CREATE INDEX IF NOT EXISTS "Credit_taskSwapId_idx" ON "Credit"("taskSwapId");
DO $$ BEGIN
  ALTER TABLE "Credit" ADD CONSTRAINT "Credit_taskSwapId_fkey" FOREIGN KEY ("taskSwapId") REFERENCES "TaskSwap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
