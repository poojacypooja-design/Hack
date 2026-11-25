"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownUp, ChevronDown } from "lucide-react";
import type { Ticket } from "@/lib/mock-data";
import { FilterPanel, SearchBar } from "@/components/ui/primitives";

export function TicketTable({
  mode = "default",
  compact = false,
  initialStatus = "All statuses",
  hrefPrefix = "/customer/tickets",
  tickets: liveTickets,
  total,
}: {
  mode?: "default" | "mine" | "unassigned" | "customer";
  compact?: boolean;
  initialStatus?: string;
  hrefPrefix?: string;
  tickets?: Ticket[];
  total?: number;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState("All priorities");
  const [sortNewest, setSortNewest] = useState(true);
  const tickets = useMemo(() => {
    return (liveTickets ?? [])
      .filter((ticket) => mode !== "unassigned" || ticket.agent === "Unassigned")
      .filter((ticket) => mode !== "mine" || ticket.agent !== "Unassigned")
      .filter((ticket) => `${ticket.id} ${ticket.subject} ${ticket.customer} ${ticket.category}`.toLowerCase().includes(query.toLowerCase()))
      .filter((ticket) => status === "All statuses" || ticket.status === status)
      .filter((ticket) => priority === "All priorities" || ticket.priority === priority)
      .sort((a, b) => sortNewest ? a.id.localeCompare(b.id) * -1 : a.id.localeCompare(b.id));
  }, [liveTickets, mode, priority, query, sortNewest, status]);
  return (
    <div>
      {!compact && <div className="mb-4"><FilterPanel>
        <SearchBar ariaLabel="Search tickets" value={query} onChange={setQuery} placeholder="Search tickets…" />
        <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none"><option>All statuses</option><option>Open</option><option>In progress</option><option>Waiting</option><option>Resolved</option></select>
        <select aria-label="Filter by priority" value={priority} onChange={(event) => setPriority(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none"><option>All priorities</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select>
      </FilterPanel></div>}
      <div className="workspace-scrollbar overflow-x-auto">
        <table className="w-full min-w-[700px] text-left">
          <thead><tr className="border-y border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <th className="px-3 py-3"><button onClick={() => setSortNewest(!sortNewest)} className="inline-flex items-center gap-1">Ticket <ArrowDownUp size={12} /></button></th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Priority</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Assigned to</th><th className="px-3 py-3">SLA</th><th className="px-3 py-3"><ChevronDown size={14} /></th>
          </tr></thead>
          <tbody>{tickets.map((ticket) => (
            <tr key={ticket.id} className="border-b border-slate-50 transition hover:bg-slate-50/80">
              <td className="px-3 py-3.5"><Link href={`${hrefPrefix}/${ticket.id}`} className="block"><p className="text-[11px] font-bold text-blue-600">{ticket.ticketCode ?? ticket.id}</p><p className="mt-1 max-w-[230px] truncate text-xs font-semibold text-slate-800">{ticket.subject}</p></Link></td>
              <td className="px-3 py-3.5"><p className="text-xs font-medium text-slate-700">{ticket.customer}</p><p className="mt-1 text-[10px] text-slate-400">{ticket.category}</p></td>
              <td className="px-3 py-3.5"><PriorityBadge priority={ticket.priority} /></td>
              <td className="px-3 py-3.5"><StatusBadge status={ticket.status} /></td>
              <td className="px-3 py-3.5"><span className="text-xs text-slate-600">{ticket.agent}</span></td>
              <td className="px-3 py-3.5"><span className={`font-mono text-[11px] font-semibold ${ticket.priority === "Critical" ? "text-rose-600" : "text-slate-600"}`}>{ticket.sla}</span></td>
              <td className="px-3 py-3.5"><Link href={`${hrefPrefix}/${ticket.id}`} aria-label={`View ${ticket.id}`} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-blue-600 hover:bg-blue-50">View</Link></td>
            </tr>
          ))}</tbody>
        </table>
        {tickets.length === 0 && <p className="py-12 text-center text-sm text-slate-500">
          {total === 0
            ? mode === "customer" ? "You have not created a support ticket yet." : mode === "mine" ? "No tickets are assigned to you yet." : mode === "unassigned" ? "No authorized unassigned tickets are available." : "No support tickets have been created."
            : "No tickets match those filters."}
        </p>}
      </div>
      {!compact && <div className="flex items-center justify-between pt-4 text-[10px] text-slate-400"><span>{`Showing ${tickets.length} of ${total ?? tickets.length} tickets`}</span></div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Open: "bg-blue-50 text-blue-700",
    "In progress": "bg-violet-50 text-violet-700",
    Waiting: "bg-amber-50 text-amber-700",
    Resolved: "bg-emerald-50 text-emerald-700",
  };
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>{status}</span>;
}

export const TicketStatusBadge = StatusBadge;

export function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    Critical: "bg-rose-50 text-rose-700 before:bg-rose-500",
    High: "bg-orange-50 text-orange-700 before:bg-orange-500",
    Medium: "bg-amber-50 text-amber-700 before:bg-amber-500",
    Low: "bg-slate-100 text-slate-600 before:bg-slate-400",
  };
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold before:h-1.5 before:w-1.5 before:rounded-full ${styles[priority] ?? "bg-slate-100 text-slate-600"}`}>{priority}</span>;
}
