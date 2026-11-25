ALTER TYPE "NotificationType" ADD VALUE 'CUSTOMER_FEEDBACK';

ALTER TABLE "TicketFeedback"
ADD COLUMN "agentId" UUID,
ADD COLUMN "agentRating" INTEGER,
ADD COLUMN "communicationRating" INTEGER,
ADD COLUMN "resolutionRating" INTEGER,
ADD COLUMN "suggestions" VARCHAR(2000);

CREATE INDEX "TicketFeedback_agentId_createdAt_idx" ON "TicketFeedback"("agentId", "createdAt");

ALTER TABLE "TicketFeedback"
ADD CONSTRAINT "TicketFeedback_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
