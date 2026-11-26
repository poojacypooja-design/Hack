import { TicketPriority, TicketStatus, type DomainMode } from "@prisma/client";
import { prisma } from "../config/database.js";
import { ticketTextSimilarity } from "./issue-dna.service.js";

export type TicketAnalysisInput = {
  subject: string;
  description: string;
  category: string;
  domain: DomainMode;
  priority: TicketPriority;
};

export type TicketAnalysisResult = {
  problemCategory: string;
  subcategory: string;
  reportedProblem: string;
  keywords: string[];
  requiredSkills: string[];
  complexity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendedPriority: TicketPriority;
  suggestedTeam: string;
  resolutionApproach: string;
  potentialSlaRisk: TicketPriority;
  similarTicketIds: string[];
  analysisMethod: "RULE_BASED";
};

export interface TicketAnalyzer {
  analyze(input: TicketAnalysisInput): Promise<TicketAnalysisResult>;
}

const paymentTerms = ["payment", "paid", "deducted", "charge", "charged", "transaction", "refund", "billing"];
const accountTerms = ["account", "password", "login", "sign in", "locked", "access", "authentication", "reset"];
const technicalTerms = ["error", "crash", "failed", "failure", "outage", "sync", "connection", "api", "device", "integration", "timeout"];
const criticalTerms = ["all users", "entire fleet", "production down", "data loss", "security breach", "cannot operate"];
const highTerms = ["unable to", "blocked", "deducted", "charged", "outage", "unavailable", "stopped working"];
const keywordCatalog = [...new Set([...paymentTerms, ...accountTerms, ...technicalTerms, ...criticalTerms, ...highTerms])];

function containsTerm(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function priorityRank(priority: TicketPriority) {
  return priority === TicketPriority.CRITICAL ? 3
    : priority === TicketPriority.HIGH ? 2
      : priority === TicketPriority.MEDIUM ? 1
        : 0;
}

function priorityForRank(rank: number): TicketPriority {
  return rank >= 3 ? TicketPriority.CRITICAL
    : rank === 2 ? TicketPriority.HIGH
      : rank === 1 ? TicketPriority.MEDIUM
        : TicketPriority.LOW;
}

export function analyzeTicketContent(
  input: TicketAnalysisInput,
  similarTicketIds: string[] = [],
): TicketAnalysisResult {
  const text = `${input.subject} ${input.description} ${input.category}`.toLowerCase();
  const paymentIssue = containsTerm(text, paymentTerms);
  const accountIssue = !paymentIssue && containsTerm(text, accountTerms);
  const technicalIssue = containsTerm(text, technicalTerms);
  const critical = containsTerm(text, criticalTerms);
  const highImpact = containsTerm(text, highTerms) || paymentIssue;
  const keywords = keywordCatalog.filter((keyword) => text.includes(keyword)).slice(0, 12);
  const problemCategory = paymentIssue ? "Billing / Payment"
    : accountIssue ? "Account Access"
      : technicalIssue ? "Technical Support"
        : input.category;

  const skillSet = new Set<string>([input.category]);
  let subcategory = `General ${input.category}`;
  let suggestedTeam = `${input.category} Support`;
  let resolutionApproach = "Confirm the expected and observed behavior, reproduce the issue where possible, and document the verified resolution.";
  if (paymentIssue) {
    subcategory = "Payment and billing";
    suggestedTeam = "Billing Support";
    skillSet.add("Payment troubleshooting");
    skillSet.add("Billing reconciliation");
    resolutionApproach = "Verify the transaction and booking state, check processor reconciliation, avoid initiating a duplicate charge, and report the confirmed outcome.";
  } else if (accountIssue) {
    subcategory = "Account access";
    suggestedTeam = "Account Support";
    skillSet.add("Account troubleshooting");
    skillSet.add("Authentication");
    resolutionApproach = "Verify the account using approved procedures, inspect authentication failures, and restore access without requesting passwords or session secrets.";
  } else if (technicalIssue) {
    subcategory = "Technical troubleshooting";
    suggestedTeam = "Technical Support";
    skillSet.add("Technical troubleshooting");
    skillSet.add("Diagnostics");
    resolutionApproach = "Reproduce the reported behavior, inspect relevant service or device diagnostics, isolate recent changes, and record a verified corrective action.";
  }

  const requiredSkills = [...skillSet];
  const minimumRank = critical ? 3 : highImpact ? 2 : 0;
  const recommendedPriority = priorityForRank(Math.max(priorityRank(input.priority), minimumRank));
  const complexity = critical ? "CRITICAL"
    : recommendedPriority === TicketPriority.CRITICAL ? "CRITICAL"
      : recommendedPriority === TicketPriority.HIGH ? "HIGH"
        : technicalIssue ? "MEDIUM"
          : recommendedPriority === TicketPriority.LOW ? "LOW"
            : "MEDIUM";

  return {
    problemCategory,
    subcategory,
    reportedProblem: input.subject.trim(),
    keywords,
    requiredSkills,
    complexity,
    recommendedPriority,
    suggestedTeam,
    resolutionApproach,
    potentialSlaRisk: recommendedPriority,
    similarTicketIds,
    analysisMethod: "RULE_BASED",
  };
}

const ruleBasedAnalyzer: TicketAnalyzer = {
  async analyze(input) {
    const candidates = await prisma.ticket.findMany({
      where: {
        domain: input.domain,
        category: input.category,
        status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
      },
      select: { id: true, subject: true, description: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    const queryText = `${input.subject} ${input.description}`;
    const similarTicketIds = candidates
      .map((candidate) => ({
        id: candidate.id,
        similarity: ticketTextSimilarity(queryText, `${candidate.subject} ${candidate.description}`),
      }))
      .filter((candidate) => candidate.similarity >= 0.2)
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, 5)
      .map((candidate) => candidate.id);
    return analyzeTicketContent(input, similarTicketIds);
  },
};

export async function analyzeTicket(input: TicketAnalysisInput) {
  return ruleBasedAnalyzer.analyze(input);
}
