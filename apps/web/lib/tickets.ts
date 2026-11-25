"use client";

import { useEffect, useState } from "react";
import { apiRequest, displayPriority, displayStatus, type ApiTicket } from "@/lib/api";
import type { Ticket } from "@/lib/mock-data";
import { REALTIME_UPDATE_EVENT } from "@/lib/realtime";

type Role = "customer" | "agent" | "admin";
type ListMode = "mine" | "unassigned";
type TicketPage = { items: ApiTicket[]; total: number };

export function useTicketList(role: Role, mode?: ListMode) {
  const [tickets, setTickets] = useState<ApiTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const endpoint = role === "agent"
      ? mode === "unassigned" ? "/tickets/unassigned" : "/tickets/assigned"
      : "/tickets";
    const loadTickets = async () => {
      try {
        const result = await apiRequest<TicketPage>(`${endpoint}?page=1&limit=100`);
        if (!active) return;
        setTickets(result.items);
        setTotal(result.total);
        setError("");
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Could not load tickets.");
      } finally {
        if (active) setLoading(false);
      }
    };
    const refreshOnRealtimeUpdate = () => { void loadTickets(); };
    void loadTickets();
    window.addEventListener(REALTIME_UPDATE_EVENT, refreshOnRealtimeUpdate);
    return () => {
      active = false;
      window.removeEventListener(REALTIME_UPDATE_EVENT, refreshOnRealtimeUpdate);
    };
  }, [mode, role]);

  return { tickets, total, loading, error };
}

export function toTicketView(ticket: ApiTicket): Ticket {
  const deadlineValue = ticket.slaRecord
    ? ticket.slaRecord.firstResponseAt
      ? ticket.slaRecord.resolutionDueAt
      : ticket.slaRecord.firstResponseDueAt
    : null;
  const deadline = deadlineValue ? new Date(deadlineValue) : null;
  const isComplete = ticket.status === "RESOLVED" || ticket.status === "CLOSED";
  const resolvedAt = ticket.slaRecord?.resolvedAt ? new Date(ticket.slaRecord.resolvedAt) : null;
  const sla = !deadline
    ? "Unavailable"
    : isComplete
      ? resolvedAt && resolvedAt <= deadline ? "Met" : "Breached"
      : formatRemaining(deadline.getTime() - Date.now());
  const updatedAt = new Date(ticket.updatedAt);
  const elapsedMinutes = Math.round((Date.now() - updatedAt.getTime()) / 60_000);
  const updated = Number.isFinite(elapsedMinutes)
    ? elapsedMinutes < 1 ? "Just now" : new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(-elapsedMinutes, "minute")
    : "Unavailable";

  return {
    id: ticket.id,
    ticketCode: ticket.ticketCode,
    subject: ticket.subject,
    customer: ticket.customer.fullName,
    category: ticket.category,
    priority: displayPriority(ticket.priority),
    status: displayStatus(ticket.status),
    agent: ticket.assignedAgent?.fullName ?? "Unassigned",
    updated,
    sla,
  };
}

function formatRemaining(milliseconds: number) {
  if (!Number.isFinite(milliseconds)) return "Unavailable";
  if (milliseconds <= 0) return "Breached";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}
