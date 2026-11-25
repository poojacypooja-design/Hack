"use client";

import { useEffect, useState } from "react";
import type { ApiTicket } from "@/lib/api";

type Props = {
  deadline: string | null;
  targetMs?: number | null;
  status?: ApiTicket["status"];
  resolvedAt?: string | null;
  priority?: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  compact?: boolean;
};

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return days
    ? `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`
    : `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function SlaCountdown({
  deadline,
  targetMs,
  status,
  resolvedAt,
  priority,
  riskLevel,
  compact = false,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const isTerminal = status === "RESOLVED" || status === "CLOSED";
  const parsedDeadline = deadline ? new Date(deadline).getTime() : Number.NaN;
  const validDeadline = Number.isFinite(parsedDeadline);

  useEffect(() => {
    if (!validDeadline || isTerminal) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isTerminal, validDeadline]);

  if (!validDeadline) {
    return <span className="text-[10px] text-slate-400">SLA unavailable</span>;
  }

  const remainingMs = parsedDeadline - now;
  const terminalMet = isTerminal && resolvedAt && new Date(resolvedAt).getTime() <= parsedDeadline;
  const breached = isTerminal ? !terminalMet : remainingMs <= 0;
  const ratio = isTerminal
    ? terminalMet ? 1 : 0
    : targetMs && targetMs > 0 ? remainingMs / targetMs : null;
  const color = breached
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : ratio === null || ratio > 0.5
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : ratio >= 0.25
        ? "border-yellow-200 bg-yellow-50 text-yellow-800"
        : "border-orange-200 bg-orange-50 text-orange-800";
  const label = breached
    ? isTerminal ? "SLA breached" : "SLA breached"
    : ratio === null || ratio > 0.5
      ? "On track"
      : ratio >= 0.25
        ? "SLA warning"
        : "SLA at risk";
  const remainingLabel = isTerminal
    ? terminalMet ? "Met" : "Breached"
    : breached ? "Breached" : formatRemaining(remainingMs);

  return (
    <div className={`inline-flex max-w-full flex-col gap-1 rounded-lg border px-2.5 py-1.5 ${color}`}>
      <span className={`font-mono font-semibold ${compact ? "text-[10px]" : "text-xs"}`}>{remainingLabel}</span>
      <span className="text-[9px] font-semibold">{label}</span>
      {!compact && (
        <>
          {priority && <span className="text-[9px]">Priority · {priority}</span>}
          <span className="text-[9px]">Deadline · {new Date(parsedDeadline).toLocaleString()}</span>
          <span className="text-[9px]">Risk · {riskLevel ?? (ratio === null ? "Unavailable" : breached || ratio <= 0.1 ? "CRITICAL" : ratio <= 0.25 ? "HIGH" : ratio <= 0.5 ? "MEDIUM" : "LOW")}</span>
        </>
      )}
    </div>
  );
}
