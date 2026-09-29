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

-- Repair: tables that were created via `db push` and never captured in a
-- migration (Task, Report, QuizQuestion, QuizAttempt, Certificate) plus the
-- CreditSession type/taskId columns. All statements are IF NOT EXISTS, so
-- this is a no-op on databases that already have them (e.g. local dev DBs)
-- and creates them on fresh databases (CI / Render) BEFORE TaskSwap FKs run.
DO $$ BEGIN
  CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'WARNED', 'REMOVED', 'CREDIT_HOLD');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable Task
CREATE TABLE IF NOT EXISTS "Task" (
    "id" SERIAL NOT NULL,
    "posterId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "creditValue" INTEGER NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "requiredSkillId" INTEGER,
    "deliverable" TEXT,
    "complexity" TEXT DEFAULT 'M',
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Task_posterId_idx" ON "Task"("posterId");
DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable Report (taskSwap FK is added later, after TaskSwap exists)
CREATE TABLE IF NOT EXISTS "Report" (
    "id" SERIAL NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "reportedUserId" INTEGER NOT NULL,
    "taskId" INTEGER,
    "cycleId" INTEGER,
    "taskSwapId" INTEGER,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Report_status_idx" ON "Report"("status");
CREATE INDEX IF NOT EXISTS "Report_reportedUserId_idx" ON "Report"("reportedUserId");
CREATE INDEX IF NOT EXISTS "Report_reporterId_idx" ON "Report"("reporterId");
CREATE INDEX IF NOT EXISTS "Report_taskId_idx" ON "Report"("taskId");
CREATE INDEX IF NOT EXISTS "Report_cycleId_idx" ON "Report"("cycleId");
DO $$ BEGIN
  ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Report" ADD CONSTRAINT "Report_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Report" ADD CONSTRAINT "Report_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "MatchCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable QuizQuestion
CREATE TABLE IF NOT EXISTS "QuizQuestion" (
    "id" SERIAL NOT NULL,
    "skillId" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[] NOT NULL,
    "correctOptionIndex" INTEGER NOT NULL,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "QuizQuestion_skillId_idx" ON "QuizQuestion"("skillId");
DO $$ BEGIN
  ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable QuizAttempt
CREATE TABLE IF NOT EXISTS "QuizAttempt" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "QuizAttempt_userId_skillId_idx" ON "QuizAttempt"("userId", "skillId");
CREATE INDEX IF NOT EXISTS "QuizAttempt_skillId_idx" ON "QuizAttempt"("skillId");
DO $$ BEGIN
  ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable Certificate
CREATE TABLE IF NOT EXISTS "Certificate" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "issuer" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Certificate_userId_skillId_idx" ON "Certificate"("userId", "skillId");
CREATE INDEX IF NOT EXISTS "Certificate_status_idx" ON "Certificate"("status");
DO $$ BEGIN
  ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable CreditSession (type + task link, missing on fresh DBs)
ALTER TABLE "CreditSession" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'SKILL';
ALTER TABLE "CreditSession" ADD COLUMN IF NOT EXISTS "taskId" INTEGER;
CREATE INDEX IF NOT EXISTS "CreditSession_type_idx" ON "CreditSession"("type");
CREATE INDEX IF NOT EXISTS "CreditSession_taskId_idx" ON "CreditSession"("taskId");
DO $$ BEGIN
  ALTER TABLE "CreditSession" ADD CONSTRAINT "CreditSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

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
