CREATE TYPE "TicketComplexity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "TicketAnalysisMethod" AS ENUM ('RULE_BASED', 'AI_PROVIDER');
CREATE TYPE "AssignmentSource" AS ENUM ('AUTOMATIC', 'MANUAL', 'CLAIM');
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'ASSIGNED', 'WAITING', 'DISABLED', 'FAILED');

ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_FAILED';

ALTER TABLE "User"
ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "AgentSkill"
ADD COLUMN "skillTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "TicketAssignment"
ADD COLUMN "score" DOUBLE PRECISION,
ADD COLUMN "reason" VARCHAR(1000),
ADD COLUMN "source" "AssignmentSource" NOT NULL DEFAULT 'MANUAL',
ALTER COLUMN "assignedById" DROP NOT NULL;

ALTER TABLE "TicketAssignment"
DROP CONSTRAINT "TicketAssignment_assignedById_fkey",
ADD CONSTRAINT "TicketAssignment_assignedById_fkey"
FOREIGN KEY ("assignedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TicketAnalysis" (
  "id" UUID NOT NULL,
  "ticketId" UUID NOT NULL,
  "problemCategory" VARCHAR(100) NOT NULL,
  "subcategory" VARCHAR(100),
  "reportedProblem" TEXT NOT NULL,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "requiredSkills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "complexity" "TicketComplexity" NOT NULL,
  "recommendedPriority" "TicketPriority" NOT NULL,
  "suggestedTeam" VARCHAR(120),
  "resolutionApproach" TEXT,
  "potentialSlaRisk" VARCHAR(20),
  "analysisMethod" "TicketAnalysisMethod" NOT NULL DEFAULT 'RULE_BASED',
  "similarTicketIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "assignmentStatus" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
  "assignmentReason" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TicketAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TicketAnalysis_ticketId_key" ON "TicketAnalysis"("ticketId");
CREATE INDEX "TicketAnalysis_assignmentStatus_createdAt_idx" ON "TicketAnalysis"("assignmentStatus", "createdAt");
CREATE INDEX "TicketAnalysis_problemCategory_complexity_idx" ON "TicketAnalysis"("problemCategory", "complexity");

ALTER TABLE "TicketAnalysis"
ADD CONSTRAINT "TicketAnalysis_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AssignmentSettings" (
  "id" VARCHAR(20) NOT NULL DEFAULT 'global',
  "automaticEnabled" BOOLEAN NOT NULL DEFAULT true,
  "skillWeight" INTEGER NOT NULL DEFAULT 35,
  "workloadWeight" INTEGER NOT NULL DEFAULT 25,
  "similarIssueWeight" INTEGER NOT NULL DEFAULT 15,
  "availabilityWeight" INTEGER NOT NULL DEFAULT 15,
  "slaPerformanceWeight" INTEGER NOT NULL DEFAULT 10,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssignmentSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AssignmentSettings" ("id", "updatedAt") VALUES ('global', CURRENT_TIMESTAMP);
