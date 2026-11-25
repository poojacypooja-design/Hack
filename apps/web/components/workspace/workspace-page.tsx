"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Clock3,
  Dna,
  FileText,
  HeartPulse,
  MessageSquareText,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { agents, categoriesByDomain, demoTickets } from "@/lib/mock-data";
import { CategoryChart, Panel, RiskCard, StatCard, VolumeChart } from "@/components/common/dashboard-widgets";
import { DashboardHeader } from "@/components/common/dashboard-header";
import { PriorityBadge, StatusBadge, TicketTable } from "@/components/common/ticket-table";
import { Modal, NotificationPanel, TicketTimeline } from "@/components/ui/primitives";
import { apiJson, apiRequest, displayDomain, displayPriority, displayStatus, errorMessage, type ApiAnalytics, type ApiTicket, type ApiTicketHistory, type ApiTicketMessage } from "@/lib/api";
import { toTicketView, useTicketList } from "@/lib/tickets";
import { LoadingState } from "@/components/ui/primitives";
import { useAnalytics } from "@/lib/use-analytics";
import { useSlaRisks } from "@/lib/use-sla-risks";
import { useSession } from "@/lib/use-session";

type Role = "customer" | "agent" | "admin";

const roleTitles: Record<Role, string> = {
  customer: "Your support, in focus.",
  agent: "Good morning, Maya.",
  admin: "Operations, at a glance.",
};

const roleSubtitles: Record<Role, string> = {
  customer: "Track requests, stay in the loop, and get back to what matters.",
  agent: "Here’s your queue and what needs your attention today.",
  admin: "A live snapshot of support performance across your organization.",
};

export function WorkspacePage({
  role,
  section,
  ticketId,
}: {
  role: Role;
  section: string;
  ticketId?: string;
}) {
  const [toast, setToast] = useState("");
  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }
  const isOverview = section === "overview";
  const title = isOverview ? roleTitles[role] : pageNames[section] ?? "Workspace";
  const subtitle = isOverview ? roleSubtitles[role] : pageSubtitles[section] ?? "Manage your SOLVEX workspace.";
  const headerAction = (section === "overview" || section === "tickets") && role === "customer"
    ? <Link href="/customer/create" className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"><Plus size={15} /> Create a ticket</Link>
    : section === "overview" && role === "admin"
      ? <button onClick={() => notify("Your sample report is being prepared.")} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"><FileText size={15} /> Export report</button>
      : undefined;
  return (
    <div className="animate-rise space-y-6">
      <DashboardHeader eyebrow={role === "admin" ? "Control center" : role === "agent" ? "My workspace" : "Customer portal"} title={title} description={subtitle} action={headerAction} />
      {section === "overview" && <LiveOverview role={role} />}
      {section === "create" && <CreateTicket onCreated={() => notify("Your ticket has been created successfully.")} />}
      {section === "tickets" && (ticketId ? <TicketDetail key={ticketId} role={role} ticketId={ticketId} onAction={notify} /> : <TicketList role={role} />)}
      {section === "journey" && <TicketJourney />}
      {section === "inbox" && <TicketList role={role} mode="unassigned" />}
      {section === "assigned" && <TicketList role={role} mode="mine" />}
      {section === "sla" && <SlaPage />}
      {section === "rescue" && <RescuePage />}
      {section === "issue-dna" && <LiveIssueDna role={role} />}
      {section === "resolution-memory" && <LiveResolutionMemory />}
      {section === "notifications" && <LiveNotifications role={role} />}
      {section === "profile" && <LiveProfile role={role} />}
      {section === "customers" && <LivePeopleTable kind="customer" />}
      {section === "agents" && <LivePeopleTable kind="agent" />}
      {section === "assignments" && <LiveAssignments />}
      {section === "analytics" && <LiveAnalytics />}
      {section === "settings" && <LiveSettings />}
      {section === "sla-config" && <LiveSlaConfig />}
      {toast && <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl bg-[#14243a] px-4 py-3 text-xs font-medium text-white shadow-xl"><CheckCircle2 size={17} className="text-emerald-300" />{toast}</div>}
    </div>
  );
}

const pageNames: Record<string, string> = {
  create: "Create a support ticket",
  tickets: "Ticket overview",
  journey: "Ticket journey",
  inbox: "Team inbox",
  assigned: "Assigned to me",
  sla: "SLA Rescue Radar",
  rescue: "SLA Rescue Center",
  "issue-dna": "Issue DNA",
  "resolution-memory": "Resolution memory",
  notifications: "Notifications",
  profile: "Profile settings",
  customers: "Customer directory",
  agents: "Agent management",
  assignments: "Fair assignment",
  analytics: "Support analytics",
  settings: "Workspace settings",
  "sla-config": "SLA policies",
};

const pageSubtitles: Record<string, string> = {
  create: "Tell us what happened. We’ll make sure it reaches the right team.",
  tickets: "Search and follow the progress of every request.",
  inbox: "Work the shared queue and pick up authorized, unassigned requests.",
  assigned: "Your active cases, ordered by urgency.",
  sla: "Catch deadlines before they become breaches.",
  rescue: "A prioritized view of tickets that need intervention.",
  "issue-dna": "Spot emerging patterns before they become widespread incidents.",
  "resolution-memory": "Proven answers from resolved issues, ready to reuse.",
  notifications: "The latest updates from your support workspace.",
  profile: "Manage your account details and preferences.",
  customers: "Customer accounts and recent support activity.",
  agents: "Your team's capacity, workload, and service health.",
  assignments: "Balance the queue with transparent workload signals.",
  analytics: "Understand volume, resolution speed, and support quality.",
  settings: "Configure the workspace experience.",
  "sla-config": "Set response targets by priority and operating domain.",
};

function Overview({ role }: { role: Role }) {
  const admin = role === "admin";
  const agent = role === "agent";
  const stats = admin
    ? [
      { label: "Total tickets", value: "2,486", change: "+8.4%", icon: FileText, tone: "blue" as const },
      { label: "Open tickets", value: "186", change: "−4.2%", icon: Activity, tone: "violet" as const },
      { label: "Resolved", value: "2,214", change: "+12.8%", icon: CheckCircle2, tone: "teal" as const },
      { label: "SLA compliance", value: "96.8%", change: "+2.1%", icon: ShieldCheck, tone: "amber" as const },
    ]
    : agent
      ? [
        { label: "Assigned tickets", value: "24", change: "+3 today", icon: FileText, tone: "blue" as const },
        { label: "Pending", value: "8", caption: "Needs your response", icon: Clock3, tone: "amber" as const },
        { label: "In progress", value: "11", caption: "Active investigations", icon: Activity, tone: "violet" as const },
        { label: "Resolved this week", value: "37", change: "+14%", icon: CheckCircle2, tone: "teal" as const },
        { label: "SLA at risk", value: "2", caption: "Requires attention", icon: ShieldAlert, tone: "rose" as const },
      ]
      : [
        { label: "Total tickets", value: "12", change: "+2 this month", icon: FileText, tone: "blue" as const },
        { label: "Open tickets", value: "3", caption: "Awaiting a response", icon: Clock3, tone: "amber" as const },
        { label: "In progress", value: "2", caption: "Being worked on", icon: Activity, tone: "violet" as const },
        { label: "Resolved", value: "7", change: "Great progress", icon: CheckCircle2, tone: "teal" as const },
      ];
  return (
    <>
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${agent ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>
      {admin && <div className="grid gap-4 sm:grid-cols-3"><StatCard label="SLA breaches" value="80" caption="−12% from last month" icon={ShieldAlert} tone="rose" /><StatCard label="Avg. resolution time" value="4h 18m" change="−18 min" icon={Clock3} tone="blue" /><StatCard label="Agent workload" value="78%" caption="Across 24 active agents" icon={UsersRound} tone="violet" /></div>}
      {(admin || agent) ? (
        <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
          <Panel title={admin ? "Ticket volume" : "Your resolution pace"} subtitle="Tickets opened and resolved · last 7 days" action={<div className="flex gap-3 text-[10px] text-slate-500"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-blue-500" />Opened</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-teal-500" />Resolved</span></div>}><VolumeChart /></Panel>
          {admin ? <Panel title="Ticket categories" subtitle="Distribution across operating domains"><CategoryChart /></Panel> : <RiskCard />}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <Panel title="Your ticket journey" subtitle="The latest request is moving forward.">
            <Journey />
            <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 p-4"><div><p className="text-xs font-semibold text-slate-800">SVX-2841 · Live location is not updating</p><p className="mt-1 text-[10px] text-slate-500">Last update 4 minutes ago</p></div>            <Link href="/customer/tickets/SVX-2841" className="text-xs font-semibold text-blue-600">View details →</Link></div>
          </Panel>
          <div className="space-y-4"><NoSilenceCard /><Panel title="Need a hand?" subtitle="Our support team is ready to help."><Link href="/customer/create" className="flex items-center justify-between rounded-xl bg-blue-50 p-4 text-xs font-semibold text-blue-800 hover:bg-blue-100">Start a new support request <ArrowRight size={15} /></Link><p className="mt-3 text-[10px] leading-relaxed text-slate-400">Typical first response in under 2 hours.</p></Panel></div>
        </div>
      )}
      {admin && (
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <Panel title="Latest tickets" subtitle="A snapshot of requests across your organization" action={<Link href="/admin/tickets" className="text-xs font-semibold text-blue-600">View all →</Link>}><TicketTable compact hrefPrefix="/admin/tickets" /></Panel>
          <FairnessPanel />
        </div>
      )}
      {agent && (
        <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <Panel title="Your priority queue" subtitle="Sorted by SLA urgency" action={<Link href="/agent/assigned" className="text-xs font-semibold text-blue-600">View queue →</Link>}><TicketTable compact mode="mine" hrefPrefix="/agent/tickets" /></Panel>
          <NoSilenceCard />
        </div>
      )}
      {!admin && !agent && <Panel title="Recent tickets" subtitle="Your latest support requests" action={<Link href="/customer/tickets" className="text-xs font-semibold text-blue-600">View all tickets →</Link>}><TicketTable compact mode="customer" /></Panel>}
      {admin && <div className="grid gap-5 lg:grid-cols-3"><Panel title="SLA health" subtitle="Response targets met this month"><SlaGauge /></Panel><RiskCard /><PriorityDistribution /></div>}
    </>
  );
}

function LiveOverview({ role }: { role: Role }) {
  const isAdmin = role === "admin";
  const isAgent = role === "agent";
  const { tickets, total, loading: ticketsLoading, error: ticketsError } = useTicketList(role, isAgent ? "mine" : undefined);
  const { analytics, loading: analyticsLoading, error: analyticsError } = useAnalytics(role);
  const openCount = tickets.filter((ticket) => ticket.status === "OPEN" || ticket.status === "WAITING_FOR_CUSTOMER").length;
  const progressCount = tickets.filter((ticket) => ticket.status === "IN_PROGRESS").length;
  const resolvedCount = tickets.filter((ticket) => ticket.status === "RESOLVED" || ticket.status === "CLOSED").length;
  const stats = isAdmin
    ? [
      { label: "Total tickets", value: analytics ? String(analytics.totalTickets) : "—", icon: FileText, tone: "blue" as const, caption: "API total" },
      { label: "Open tickets", value: analytics ? String(analytics.openTickets) : "—", icon: Activity, tone: "violet" as const, caption: "API total" },
      { label: "Resolved", value: analytics ? String(analytics.resolvedTickets) : "—", icon: CheckCircle2, tone: "teal" as const, caption: "API total" },
      { label: "SLA compliance", value: analytics ? `${analytics.slaCompliance}%` : "—", icon: ShieldCheck, tone: "amber" as const, caption: "API metric" },
    ]
    : isAgent
      ? [
        { label: "Assigned tickets", value: analytics ? String(analytics.totalTickets) : "—", icon: FileText, tone: "blue" as const, caption: "API total" },
        { label: "Open tickets", value: analytics ? String(analytics.openTickets) : "—", icon: Clock3, tone: "amber" as const, caption: "API total" },
        { label: "Resolved", value: analytics ? String(analytics.resolvedTickets) : "—", icon: CheckCircle2, tone: "teal" as const, caption: "API total" },
        { label: "SLA breaches", value: analytics ? String(analytics.slaBreaches) : "—", icon: ShieldAlert, tone: "rose" as const, caption: "API metric" },
      ]
      : [
        { label: "My tickets", value: String(total), icon: FileText, tone: "blue" as const, caption: "API total" },
        { label: "Open (loaded page)", value: ticketsLoading ? "—" : String(openCount), icon: Clock3, tone: "amber" as const, caption: "API records" },
        { label: "In progress (loaded page)", value: ticketsLoading ? "—" : String(progressCount), icon: Activity, tone: "violet" as const, caption: "API records" },
        { label: "Resolved (loaded page)", value: ticketsLoading ? "—" : String(resolvedCount), icon: CheckCircle2, tone: "teal" as const, caption: "API records" },
      ];

  return (
    <>
      {(ticketsError || analyticsError) && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{ticketsError || analyticsError}</p>}
      {analyticsLoading && role !== "customer" && <LoadingState label="Loading workspace analytics" />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((stat) => <StatCard key={stat.label} {...stat} />)}</div>
      {isAdmin && analytics && <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="SLA breaches" value={String(analytics.slaBreaches)} caption="API metric" icon={ShieldAlert} tone="rose" />
        <StatCard label="Average resolution" value={`${analytics.averageResolutionTimeHours} hours`} caption="API metric" icon={Clock3} tone="blue" />
        <StatCard label="Customer satisfaction" value={analytics.customerSatisfaction.feedbackCount ? `${analytics.customerSatisfaction.averageRating} / 5` : "No feedback"} caption={`${analytics.customerSatisfaction.feedbackCount} ratings`} icon={HeartPulse} tone="violet" />
      </div>}
      {isAdmin || isAgent ? <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <Panel title={isAdmin ? "Ticket volume" : "Your resolution pace"} subtitle="Time-series data is unavailable from the current API."><VolumeChart /></Panel>
        {isAdmin ? <Panel title="Ticket categories" subtitle="Counts returned by the analytics API"><CategoryChart data={analytics?.categories.map((item) => ({ name: item.category, value: item.count }))} /></Panel> : <RiskCard />}
      </div> : <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Your ticket journey" subtitle="The latest ticket in your account.">
          {ticketsLoading ? <LoadingState label="Loading your tickets" /> : ticketsError ? <p role="alert" className="text-xs text-rose-700">{ticketsError}</p> : tickets[0] ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><div><p className="text-xs font-semibold text-slate-800">{tickets[0].ticketCode} · {tickets[0].subject}</p><p className="mt-1 text-[10px] text-slate-500">{displayStatus(tickets[0].status)} · Updated {new Date(tickets[0].updatedAt).toLocaleString()}</p></div><Link href={`/customer/tickets/${tickets[0].id}`} className="text-xs font-semibold text-blue-600">View details →</Link></div> : <p className="text-xs text-slate-500">No tickets have been created yet.</p>}
        </Panel>
        <Panel title="Need a hand?" subtitle="Create a request or follow an existing ticket."><Link href="/customer/create" className="flex items-center justify-between rounded-xl bg-blue-50 p-4 text-xs font-semibold text-blue-800 hover:bg-blue-100">Start a new support request <ArrowRight size={15} /></Link></Panel>
      </div>}
      {isAdmin && <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="Latest tickets" subtitle="Records returned by the API" action={<Link href="/admin/tickets" className="text-xs font-semibold text-blue-600">View all →</Link>}>{ticketsLoading ? <LoadingState label="Loading tickets" /> : ticketsError ? <p role="alert" className="text-xs text-rose-700">{ticketsError}</p> : <TicketTable compact hrefPrefix="/admin/tickets" tickets={tickets.map(toTicketView)} total={total} />}</Panel>
        <FairnessPanel workload={analytics?.agentWorkload ?? []} />
      </div>}
      {isAgent && <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Panel title="Your priority queue" subtitle="Assigned tickets returned by the API" action={<Link href="/agent/assigned" className="text-xs font-semibold text-blue-600">View queue →</Link>}>{ticketsLoading ? <LoadingState label="Loading assigned tickets" /> : ticketsError ? <p role="alert" className="text-xs text-rose-700">{ticketsError}</p> : <TicketTable compact mode="mine" hrefPrefix="/agent/tickets" tickets={tickets.map(toTicketView)} total={total} />}</Panel>
        <NoSilenceCard />
      </div>}
      {role === "customer" && <Panel title="Recent tickets" subtitle="Your latest support requests" action={<Link href="/customer/tickets" className="text-xs font-semibold text-blue-600">View all tickets →</Link>}>{ticketsLoading ? <LoadingState label="Loading tickets" /> : ticketsError ? <p role="alert" className="text-xs text-rose-700">{ticketsError}</p> : <TicketTable compact mode="customer" tickets={tickets.map(toTicketView)} total={total} />}</Panel>}
      {isAdmin && analytics && <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="SLA health" subtitle="Compliance reported by the analytics API"><p className="text-3xl font-bold text-slate-900">{analytics.slaCompliance}%</p><p className="mt-2 text-xs text-slate-500">{analytics.slaBreaches} recorded SLA breaches</p></Panel>
        <RiskCard />
      </div>}
    </>
  );
}

function TicketList({ role, mode }: { role: Role; mode?: "mine" | "unassigned" }) {
  const [view, setView] = useState("all");
  const { tickets, total, loading, error } = useTicketList(role, mode);
  const statusFilter = view === "all" ? "All statuses" : view === "open" ? "Open" : view === "in progress" ? "In progress" : "Resolved";
  return (
    <Panel title={role === "agent" ? mode === "unassigned" ? "Authorized unassigned tickets" : "Your assigned tickets" : role === "customer" ? "My support tickets" : "All support tickets"} subtitle="Ticket visibility is enforced by the API for your signed-in role.">
      <div className="mb-4 flex gap-2 border-b border-slate-100 pb-3">{["all", "open", "in progress", "resolved"].map((item) => <button key={item} onClick={() => setView(item)} className={`rounded-full px-3 py-1.5 text-[10px] font-semibold capitalize ${view === item ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{item}</button>)}</div>
      {loading ? <LoadingState label="Loading tickets" /> : error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p> : <TicketTable key={`${view}-${mode ?? role}`} mode={mode ?? (role === "customer" ? "customer" : "default")} initialStatus={statusFilter} hrefPrefix={`/${role}/tickets`} tickets={tickets.map(toTicketView)} total={total} />}
    </Panel>
  );
}

function CreateTicket({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [domain, setDomain] = useState<keyof typeof categoriesByDomain>("Logistics");
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdTicket, setCreatedTicket] = useState<ApiTicket | null>(null);
  const categories = categoriesByDomain[domain];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const description = String(formData.get("description") ?? "").trim();
    const reproduction = [
      formData.get("expected") ? `Expected: ${formData.get("expected")}` : "",
      formData.get("actual") ? `Actual: ${formData.get("actual")}` : "",
      formData.get("tried") ? `Tried: ${formData.get("tried")}` : "",
      formData.get("reference") ? `Reference: ${formData.get("reference")}` : "",
      formData.get("whenStarted") ? `Started: ${formData.get("whenStarted")}` : "",
    ].filter(Boolean);

    try {
      const ticket = await apiJson<ApiTicket>("/tickets", "POST", {
        subject: String(formData.get("subject") ?? ""),
        description: [description, ...reproduction].join("\n\n"),
        category: String(formData.get("category") ?? ""),
        domain: domain === "Smart Operations" ? "SMART_OPERATIONS" : domain === "Health" ? "HEALTH" : "LOGISTICS",
        priority: String(formData.get("priority") ?? "MEDIUM").toUpperCase(),
      });
      setCreatedTicket(ticket);
      setSubmitted(true);
      setConfirmationOpen(true);
      onCreated();
      if (file) {
        const attachmentData = new FormData();
        attachmentData.append("file", file);
        try {
          await apiRequest(`/tickets/${ticket.id}/attachments`, { method: "POST", body: attachmentData });
        } catch (uploadError) {
          setError(`Ticket ${ticket.ticketCode} was created, but the attachment could not be uploaded: ${errorMessage(uploadError)}`);
        }
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
    <form ref={formRef} onSubmit={submit} className="grid gap-5 xl:grid-cols-[1.5fr_0.8fr]">
      <div className="space-y-5">
        <Panel title="Tell us what’s going on" subtitle="The more detail you share, the faster we can help.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Operating domain"><select name="domain" value={domain} onChange={(event) => setDomain(event.target.value as keyof typeof categoriesByDomain)} className={inputClass}><option>Logistics</option><option>Health</option><option>Smart Operations</option></select></Field>
            <Field label="Category"><select required name="category" className={inputClass}><option value="">Select a category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></Field>
            <Field label={domain === "Logistics" ? "Route / vehicle ID" : domain === "Health" ? "Appointment reference" : "Device / site ID"} wide><input name="reference" placeholder={domain === "Logistics" ? "e.g. Route 204 or vehicle ID" : domain === "Health" ? "e.g. appointment reference (no sensitive health data)" : "e.g. device serial or site reference"} className={inputClass} /></Field>
            <Field label="Subject" wide><input name="subject" required minLength={6} placeholder="A short summary of the issue" className={inputClass} /></Field>
            <Field label="Description" wide><textarea name="description" required minLength={15} rows={5} placeholder="What happened? Include any error messages or context that could help." className={`${inputClass} resize-y`} /></Field>
            <Field label="Priority"><select name="priority" className={inputClass}><option value="MEDIUM">Medium</option><option value="LOW">Low</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></Field>
            <Field label="When did this start?"><select name="whenStarted" className={inputClass}><option>Today</option><option>Yesterday</option><option>Within the last week</option><option>More than a week ago</option></select></Field>
          </div>
        </Panel>
        <Panel title="Help us reproduce it" subtitle="A few details can help the right specialist resolve this sooner.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="What did you expect to happen?"><textarea name="expected" rows={3} placeholder="Describe the expected result" className={`${inputClass} resize-y`} /></Field>
            <Field label="What actually happened?"><textarea name="actual" rows={3} placeholder="Describe what you experienced" className={`${inputClass} resize-y`} /></Field>
            <Field label="What have you tried so far?" wide><input name="tried" placeholder="Steps already taken" className={inputClass} /></Field>
          </div>
        </Panel>
        <div className="flex flex-wrap items-center gap-3"><button disabled={saving} type="submit" className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">{saving ? "Submitting…" : submitted ? <><Check size={15} /> Submitted</> : <>Submit support request <ArrowRight size={15} /></>}</button><p className="text-[10px] text-slate-400">Your request will be saved to your account.</p></div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      </div>
      <aside className="space-y-4">
        <Panel title="Attachments" subtitle="Screenshots and files help us investigate.">
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-blue-400 hover:bg-blue-50/50"><span className="mb-2 grid h-9 w-9 place-items-center rounded-full bg-white text-slate-500 shadow-sm"><Plus size={18} /></span><span className="text-xs font-semibold text-slate-700">{fileName || "Add an attachment"}</span><span className="mt-1 text-[10px] text-slate-400">PNG, JPG, PDF up to 10 MB</span><input type="file" accept=".png,.jpg,.jpeg,.pdf" className="sr-only" onChange={(event) => { const selected = event.target.files?.[0] ?? null; setFile(selected); setFileName(selected?.name ?? ""); }} /></label>
        </Panel>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5"><div className="flex items-center gap-2 text-blue-700"><Sparkles size={16} /><p className="text-xs font-bold">Problem reproduction details</p></div><p className="mt-2 text-[11px] leading-relaxed text-slate-600">Your expected result, observed behavior, reference, and attempted steps are included in the ticket description. No automated diagnosis is available.</p></div>
        <RiskCard compact />
      </aside>
    </form>
    <Modal open={confirmationOpen} title="Support request created" onClose={() => setConfirmationOpen(false)}>
      <div className="text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={24} /></span><p className="mt-4 text-sm font-bold text-slate-800">Your support request was created.</p><p className="mt-2 text-xs leading-relaxed text-slate-500">Ticket ID <b className="text-blue-700">{createdTicket?.ticketCode}</b></p><div className="mt-5 flex justify-center gap-2"><button type="button" onClick={() => { formRef.current?.reset(); setDomain("Logistics"); setFileName(""); setFile(null); setSubmitted(false); setCreatedTicket(null); setConfirmationOpen(false); }} className="rounded-lg border border-slate-200 px-4 py-2.5 text-[10px] font-semibold text-slate-600">Create another</button>{createdTicket && <button type="button" onClick={() => router.push(`/customer/tickets/${createdTicket.id}`)} className="rounded-lg bg-blue-600 px-4 py-2.5 text-[10px] font-semibold text-white">View ticket</button>}</div></div>
    </Modal>
    </>
  );
}

const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={`block text-[11px] font-semibold text-slate-700 ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>;
}

function TicketDetail({ role, ticketId, onAction }: { role: Role; ticketId: string; onAction: (message: string) => void }) {
  const [ticket, setTicket] = useState<ApiTicket | null>(null);
  const [reply, setReply] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const [feedback, setFeedback] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [similar, setSimilar] = useState<{ matches: Array<{ ticketId: string; ticketCode: string; subject: string; similarity: number; matchedSignals: string[] }> } | null>(null);
  const [suggestions, setSuggestions] = useState<{ suggestions: Array<{ id: string; title: string; solution: string; similarity: number; ticket: { ticketCode: string } }> } | null>(null);
  const [similarError, setSimilarError] = useState("");
  const [suggestionsError, setSuggestionsError] = useState("");

  const loadTicket = useCallback(async () => {
    try {
      const result = await apiRequest<{ ticket: ApiTicket }>(`/tickets/${encodeURIComponent(ticketId)}`);
      setTicket(result.ticket);
      if (role !== "customer") {
        await Promise.all([
          apiRequest<{ matches: Array<{ ticketId: string; ticketCode: string; subject: string; similarity: number; matchedSignals: string[] }> }>(`/tickets/${encodeURIComponent(ticketId)}/similar`)
            .then((value) => { setSimilar(value); setSimilarError(""); })
            .catch((featureError: unknown) => setSimilarError(errorMessage(featureError))),
          apiRequest<{ suggestions: Array<{ id: string; title: string; solution: string; similarity: number; ticket: { ticketCode: string } }> }>(`/tickets/${encodeURIComponent(ticketId)}/resolution-suggestions`)
            .then((value) => { setSuggestions(value); setSuggestionsError(""); })
            .catch((featureError: unknown) => setSuggestionsError(errorMessage(featureError))),
        ]);
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [role, ticketId]);

  useEffect(() => {
    let active = true;
    apiRequest<{ ticket: ApiTicket }>(`/tickets/${encodeURIComponent(ticketId)}`)
      .then((result) => {
        if (!active) return;
        setTicket(result.ticket);
        if (role === "customer") return;
        apiRequest<{ matches: Array<{ ticketId: string; ticketCode: string; subject: string; similarity: number; matchedSignals: string[] }> }>(`/tickets/${encodeURIComponent(ticketId)}/similar`)
          .then((value) => { if (active) setSimilar(value); })
          .catch((featureError: unknown) => { if (active) setSimilarError(errorMessage(featureError)); });
        apiRequest<{ suggestions: Array<{ id: string; title: string; solution: string; similarity: number; ticket: { ticketCode: string } }> }>(`/tickets/${encodeURIComponent(ticketId)}/resolution-suggestions`)
          .then((value) => { if (active) setSuggestions(value); })
          .catch((featureError: unknown) => { if (active) setSuggestionsError(errorMessage(featureError)); });
      })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role, ticketId]);

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticket || !reply.trim()) return;
    setActionError("");
    try {
      await apiJson(`/messages/${encodeURIComponent(ticket.id)}${noteMode ? "/internal-notes" : ""}`, "POST", { body: reply.trim() });
      setReply("");
      await loadTicket();
      onAction(noteMode ? "Private note added." : "Reply sent.");
    } catch (requestError) {
      setActionError(errorMessage(requestError));
    }
  }

  async function changeStatus(status: ApiTicket["status"]) {
    if (!ticket) return;
    setActionError("");
    try {
      await apiJson(`/tickets/${encodeURIComponent(ticket.id)}/status`, "PATCH", { status });
      await loadTicket();
      onAction(`Ticket status changed to ${displayStatus(status)}.`);
    } catch (requestError) {
      setActionError(errorMessage(requestError));
    }
  }

  async function submitFeedback() {
    if (!ticket || feedback < 1) return;
    setActionError("");
    try {
      await apiJson(`/tickets/${encodeURIComponent(ticket.id)}/feedback`, "POST", { rating: feedback });
      await loadTicket();
      onAction("Feedback submitted.");
    } catch (requestError) {
      setActionError(errorMessage(requestError));
    }
  }

  async function confirmResolution() {
    if (!ticket) return;
    setActionError("");
    try {
      await apiRequest(`/tickets/${encodeURIComponent(ticket.id)}/confirm-resolution`, { method: "POST" });
      await loadTicket();
      onAction("Resolution confirmed.");
    } catch (requestError) {
      setActionError(errorMessage(requestError));
    }
  }

  if (loading) return <LoadingState label="Loading ticket" />;
  if (error) return <p role="alert" className="rounded-lg bg-rose-50 p-4 text-xs text-rose-700">{error}</p>;
  if (!ticket) return <p role="alert" className="rounded-lg bg-rose-50 p-4 text-xs text-rose-700">Ticket data is unavailable.</p>;

  const notes = role === "customer" ? [] : ticket.internalNotes ?? [];
  const messages = [...(ticket.messages ?? []), ...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const dueAt = ticket.slaRecord
    ? ticket.slaRecord.firstResponseAt ? ticket.slaRecord.resolutionDueAt : ticket.slaRecord.firstResponseDueAt
    : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3"><div className="flex items-center gap-2 text-xs text-blue-900"><span className="font-bold">{ticket.ticketCode}</span><span>·</span><span>{ticket.category}</span></div><div className="flex items-center gap-2"><StatusBadge status={displayStatus(ticket.status)} /><PriorityBadge priority={displayPriority(ticket.priority)} /></div></div>
      <div className="grid gap-5 xl:grid-cols-[1.55fr_0.75fr]">
        <div className="space-y-5">
          <Panel title={ticket.subject} subtitle={`Created ${new Date(ticket.createdAt).toLocaleString()} by ${ticket.customer.fullName}`}>
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{ticket.description}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-slate-500"><span className="rounded-md bg-slate-100 px-2.5 py-1.5">Domain · {displayDomain(ticket.domain)}</span><span className="rounded-md bg-slate-100 px-2.5 py-1.5">Priority · {displayPriority(ticket.priority)}</span><span className="rounded-md bg-slate-100 px-2.5 py-1.5">{ticket.attachments?.length ?? 0} attachments</span></div>
            {ticket.attachments && ticket.attachments.length > 0 && <ul className="mt-4 space-y-2">{ticket.attachments.map((attachment) => <li key={attachment.id}><a className="text-xs font-semibold text-blue-600 hover:underline" href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/tickets/${encodeURIComponent(ticket.id)}/attachments/${encodeURIComponent(attachment.id)}`} target="_blank" rel="noreferrer">{attachment.originalName}</a></li>)}</ul>}
          </Panel>
          <Panel title={role === "customer" ? "Conversation" : "Conversation & notes"} subtitle="Messages and notes are loaded from this ticket.">
            <div className="space-y-4">{messages.map((message) => <Message key={message.id} author={message.author.fullName} initials={message.author.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()} time={new Date(message.createdAt).toLocaleString()} internal={notes.some((note) => note.id === message.id)}>{message.body}</Message>)}{messages.length === 0 && <p className="text-xs text-slate-500">No messages yet.</p>}</div>
            <form onSubmit={sendReply} className={`mt-5 rounded-xl border p-3 ${noteMode ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-slate-50"}`}>
              {role !== "customer" && <div className="mb-2 flex gap-2"><button type="button" onClick={() => setNoteMode(false)} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${!noteMode ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-white"}`}>Public reply</button><button type="button" onClick={() => setNoteMode(true)} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${noteMode ? "bg-amber-500 text-white" : "text-slate-500 hover:bg-white"}`}>Private note</button></div>}
              <textarea required value={reply} onChange={(event) => setReply(event.target.value)} rows={3} placeholder={noteMode ? "Add an internal note — only your team can see this…" : "Write a helpful response…"} className="w-full resize-y bg-transparent text-xs outline-none placeholder:text-slate-400" />
              <div className="flex justify-end"><button className={`rounded-lg px-3 py-2 text-[10px] font-bold text-white ${noteMode ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}`}>{noteMode ? "Add private note" : "Send reply"}</button></div>
            </form>
            {actionError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{actionError}</p>}
          </Panel>
          {(ticket.status === "RESOLVED" || ticket.status === "CLOSED") && role === "customer" && <Panel title="Was this resolution helpful?" subtitle="Your feedback is submitted to the support team."><div className="flex gap-2">{[1, 2, 3, 4, 5].map((rating) => <button type="button" key={rating} onClick={() => setFeedback(rating)} aria-label={`${rating} stars`} className={`grid h-9 w-9 place-items-center rounded-full text-sm ${feedback >= rating ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"}`}>★</button>)}</div><div className="mt-4 flex gap-2"><button type="button" disabled={!feedback} onClick={() => void submitFeedback()} className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-50">Submit rating</button><button type="button" onClick={() => void confirmResolution()} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Confirm resolution</button></div></Panel>}
          <Panel title="Ticket activity" subtitle="History returned by the API; customer access is filtered by the server."><HistoryList items={ticket.history ?? []} /></Panel>
        </div>
        <div className="space-y-4">
          {role !== "customer" && <Panel title="Ticket status" subtitle="The API validates allowed status transitions."><select aria-label="Update ticket status" value={ticket.status} onChange={(event) => void changeStatus(event.target.value as ApiTicket["status"])} className={inputClass}><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="WAITING_FOR_CUSTOMER">Waiting for customer</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select></Panel>}
          <Panel title="Ticket details"><DetailLine label="Assigned agent" value={ticket.assignedAgent?.fullName ?? "Unassigned"} /><DetailLine label="Updated" value={new Date(ticket.updatedAt).toLocaleString()} /><DetailLine label="SLA deadline" value={dueAt ? new Date(dueAt).toLocaleString() : "Unavailable"} /><DetailLine label="Ticket owner" value={ticket.customer.fullName} /></Panel>
          {role !== "customer" && <Panel title="Issue DNA" subtitle="Similarity results calculated by the API.">{similarError ? <p role="alert" className="text-xs text-rose-700">{similarError}</p> : similar?.matches.length ? <ul className="space-y-3">{similar.matches.map((match) => <li key={match.ticketId} className="rounded-lg bg-violet-50 p-3"><Link href={`/${role}/tickets/${match.ticketId}`} className="text-xs font-bold text-violet-800 hover:underline">{match.ticketCode} · {match.subject}</Link><p className="mt-1 text-[10px] text-slate-600">{match.similarity}% similarity · {match.matchedSignals.join(", ")}</p></li>)}</ul> : <p className="text-xs text-slate-500">{similar ? "No similar tickets were returned." : "Loading similar tickets…"}</p>}</Panel>}
          {role !== "customer" && <Panel title="Resolution Memory" subtitle="Historical resolutions ranked by the API.">{suggestionsError ? <p role="alert" className="text-xs text-rose-700">{suggestionsError}</p> : suggestions?.suggestions.length ? <ul className="space-y-3">{suggestions.suggestions.map((suggestion) => <li key={suggestion.id} className="rounded-lg border border-slate-100 p-3"><p className="text-xs font-semibold text-slate-800">{suggestion.title}</p><p className="mt-1 text-[10px] text-slate-500">{suggestion.ticket.ticketCode} · {suggestion.similarity}% similarity</p><p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{suggestion.solution}</p></li>)}</ul> : <p className="text-xs text-slate-500">{suggestions ? "No matching saved resolutions are available." : "Loading saved resolutions…"}</p>}</Panel>}
        </div>
      </div>
    </>
  );
}

function HistoryList({ items }: { items: ApiTicketHistory[] }) {
  if (!items.length) return <p className="text-xs text-slate-500">No ticket history is available.</p>;
  return <ol className="space-y-3">{items.map((item) => <li key={item.id} className="border-l-2 border-blue-100 pl-3"><p className="text-xs font-semibold text-slate-800">{item.action.replaceAll("_", " ").toLowerCase()}</p><p className="mt-1 text-[10px] text-slate-500">{item.actor?.fullName ?? "System"} · {new Date(item.createdAt).toLocaleString()}</p></li>)}</ol>;
}

function Message({ author, initials, time, children, internal = false }: { author: string; initials: string; time: string; children: ReactNode; internal?: boolean }) {
  return <div className={`flex gap-3 rounded-xl border p-3.5 ${internal ? "border-amber-200 bg-amber-50/70" : "border-slate-100 bg-white"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[9px] font-bold ${internal ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{initials}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-slate-800">{author}</span>{internal && <span className="rounded bg-amber-200/70 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-800">Internal only</span>}<span className="text-[9px] text-slate-400">{time}</span></div><p className="mt-2 text-xs leading-relaxed text-slate-600">{children}</p></div></div>;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0"><span className="text-[10px] text-slate-500">{label}</span><span className="text-right text-[10px] font-semibold text-slate-700">{value}</span></div>;
}

function Journey() {
  return <TicketTimeline activeIndex={3} />;
}

function TicketJourney() {
  const { tickets, loading, error } = useTicketList("customer");
  const [detailResult, setDetailResult] = useState<{ ticketId: string; ticket: ApiTicket } | null>(null);
  const [detailFailure, setDetailFailure] = useState<{ ticketId: string; message: string } | null>(null);
  const latestTicketId = tickets[0]?.id ?? "";
  const detail = detailResult?.ticketId === latestTicketId ? detailResult.ticket : null;
  const detailError = detailFailure?.ticketId === latestTicketId ? detailFailure.message : "";
  useEffect(() => {
    let active = true;
    const latest = tickets[0];
    if (!latest) return;
    apiRequest<{ ticket: ApiTicket }>(`/tickets/${encodeURIComponent(latest.id)}`)
      .then((result) => { if (active) setDetailResult({ ticketId: latest.id, ticket: result.ticket }); })
      .catch((requestError: unknown) => { if (active) setDetailFailure({ ticketId: latest.id, message: errorMessage(requestError) }); });
    return () => { active = false; };
  }, [tickets]);

  return <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><Panel title={detail ? `${detail.ticketCode} · ${detail.subject}` : "Ticket journey"} subtitle="Ticket details and activity from the API.">{loading ? <LoadingState label="Loading your tickets" /> : error ? <p role="alert" className="text-xs text-rose-700">{error}</p> : detailError ? <p role="alert" className="text-xs text-rose-700">{detailError}</p> : detail ? <><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-600">{displayStatus(detail.status)} · Updated {new Date(detail.updatedAt).toLocaleString()}</span><Link href={`/customer/tickets/${detail.id}`} className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white">Open ticket details</Link></div><HistoryList items={detail.history ?? []} /></> : <p className="text-xs text-slate-500">Create a ticket to see its journey here.</p>}</Panel><Panel title="Ticket activity" subtitle="Customer-visible history is filtered by the API.">{detail ? <HistoryList items={detail.history ?? []} /> : detailError ? <p role="alert" className="text-xs text-rose-700">{detailError}</p> : <p className="text-xs text-slate-500">Activity is available after selecting a ticket.</p>}</Panel></div>;
}

function NoSilenceCard() {
  const [items, setItems] = useState<Array<{ id: string; type: string; title: string; body: string; ticketId: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<{ items: Array<{ id: string; type: string; title: string; body: string; ticketId: string | null }> }>("/notifications?page=1&limit=100")
      .then((result) => { if (active) setItems(result.items.filter((item) => item.type === "NO_SILENCE")); })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <Panel title="No-Silence Promise" subtitle="Alerts returned by your account's notification feed." action={<span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">{items.length} ALERTS</span>}>
    {error ? <p role="alert" className="text-xs text-rose-700">{error}</p> : loading ? <LoadingState label="Loading notifications" /> : items.length ? <div className="space-y-3">{items.map((item) => <div key={item.id} className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700"><BellRing size={16} /></span><div className="flex-1"><p className="text-xs font-bold text-slate-800">{item.title}</p><p className="mt-1 text-[10px] text-slate-500">{item.body}</p>{item.ticketId && <Link href={`/agent/tickets/${item.ticketId}`} className="mt-2 inline-block text-[10px] font-semibold text-amber-800">Review ticket →</Link>}</div></div>)}</div> : <p className="text-xs text-slate-500">No No-Silence alerts were returned.</p>}
  </Panel>;
}

function FairnessPanel({ workload = [] }: { workload?: ApiAnalytics["agentWorkload"] }) {
  const maxActive = Math.max(1, ...workload.map((agent) => agent.activeTickets));
  return <Panel title="Agent fairness meter" subtitle="Live workload counts; the API does not provide a fairness score." action={<Link href="/admin/agents" className="text-[10px] font-semibold text-blue-600">Team →</Link>}>
    {workload.length ? <div className="space-y-4">{workload.map((agent) => <div key={agent.agentId}><div className="mb-1.5 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-violet-100 text-[9px] font-bold text-violet-700">{agent.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span className="flex-1 text-[10px] font-semibold text-slate-700">{agent.name}</span><span className="text-[10px] text-slate-500">{agent.activeTickets} active · {agent.urgentTickets} urgent</span></div><div className="ml-9 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-400" style={{ width: `${Math.min(100, agent.activeTickets / maxActive * 100)}%` }} /></div></div>)}</div> : <p className="text-xs text-slate-500">No agent workload records are available.</p>}
    <p className="mt-4 rounded-lg bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500">Bars compare active ticket counts only; no predictive fairness score or capacity estimate is available.</p>
  </Panel>;
}

function SlaGauge() {
  return <div className="flex flex-wrap items-center gap-5"><div className="relative grid h-28 w-28 place-items-center rounded-full" style={{ background: "conic-gradient(#1ab89f 0% 96.8%, #e8edf3 96.8% 100%)" }}><div className="grid h-[82px] w-[82px] place-items-center rounded-full bg-white text-center"><div><p className="text-xl font-bold text-slate-900">96.8%</p><p className="text-[8px] text-slate-400">COMPLIANCE</p></div></div></div><div className="space-y-2 text-[10px]"><p className="text-slate-600"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-teal-500" />Within SLA <b className="ml-2 text-slate-800">2,406</b></p><p className="text-slate-600"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-rose-400" />Breached <b className="ml-2 text-slate-800">80</b></p><p className="mt-3 text-emerald-700"><ArrowUpRight size={13} className="mr-1 inline" />Up 2.1% from last month</p></div></div>;
}

function PriorityDistribution() {
  const rows = [
    { label: "Critical", count: 42, width: 18, color: "bg-rose-500" },
    { label: "High", count: 186, width: 44, color: "bg-orange-500" },
    { label: "Medium", count: 712, width: 76, color: "bg-amber-400" },
    { label: "Low", count: 384, width: 58, color: "bg-slate-300" },
  ];
  return <Panel title="Priority mix" subtitle="Open tickets by urgency"><div className="space-y-4">{rows.map((row) => <div key={row.label}><div className="mb-1.5 flex justify-between text-[10px]"><span className="text-slate-600">{row.label}</span><b className="text-slate-800">{row.count}</b></div><div className="h-1.5 rounded-full bg-slate-100"><div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.width}%` }} /></div></div>)}</div></Panel>;
}

function SlaPage() {
  return <SlaRiskDashboard role="agent" />;
}

function RescuePage() {
  return <SlaRiskDashboard role="admin" />;
}

function SlaRiskDashboard({ role }: { role: "agent" | "admin" }) {
  const { risks, loading, error } = useSlaRisks();
  const levels = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{levels.map((level) => <StatCard key={level} label={`${level} risk`} value={String(risks.filter((risk) => risk.level === level).length)} caption="API risk records" icon={level === "CRITICAL" ? ShieldAlert : Clock3} tone={level === "CRITICAL" || level === "HIGH" ? "rose" : level === "MEDIUM" ? "amber" : "teal"} />)}</div>
    <Panel title={role === "admin" ? "SLA Rescue Center" : "Approaching deadlines"} subtitle="Risk scores and recommended actions are returned by the SLA API.">
      {loading ? <LoadingState label="Loading SLA risk data" /> : error ? <p role="alert" className="text-xs text-rose-700">{error}</p> : risks.length ? <div className="space-y-3">{risks.map((risk) => <article key={risk.ticketId} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/${role}/tickets/${risk.ticketId}`} className="text-xs font-bold text-blue-700 hover:underline">{risk.ticketCode} · {risk.subject ?? "Ticket"}</Link><p className="mt-1 text-[10px] text-slate-500">{risk.priority ?? "Priority unavailable"} · {risk.status ? displayStatus(risk.status) : "Status unavailable"}</p></div><span className="rounded-full bg-rose-50 px-2.5 py-1 text-[9px] font-bold text-rose-700">{risk.level} · score {risk.score}</span></div><p className="mt-3 text-xs text-slate-700">{risk.recommendedAction}</p><p className="mt-2 text-[10px] text-slate-500">Deadline: {new Date(risk.deadline).toLocaleString()} · Remaining: {risk.remainingMs > 0 ? `${Math.floor(risk.remainingMs / 60_000)} minutes` : "breached"}</p><p className="mt-2 text-[9px] text-slate-400">API factors (points): time {risk.factors.timeRemaining}, priority {risk.factors.priority}, age {risk.factors.ticketAge}, workload {risk.factors.agentWorkload}.</p></article>)}</div> : <p className="text-xs text-slate-500">The API returned no active SLA risks.</p>}
    </Panel>
  </>;
}

function IssueDna({ onAction }: { onAction: (message: string) => void }) {
  return <div className="grid gap-5 xl:grid-cols-[1.35fr_0.8fr]"><Panel title="Emerging incident clusters" subtitle="Related tickets grouped by shared signals"><div className="space-y-4"><div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/70 to-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-violet-700"><Dna size={18} /></span><div><p className="text-xs font-bold text-slate-800">GPS synchronization · West region</p><p className="mt-0.5 text-[10px] text-slate-500">Potential common incident</p></div></div><span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold text-violet-800">92% similarity</span></div><div className="relative my-7 flex items-center justify-center"><div className="absolute h-px w-[80%] bg-violet-200" /><div className="relative grid grid-cols-4 gap-3 sm:gap-8">{["SVX-2841", "SVX-2819", "SVX-2782", "SVX-2771"].map((id, i) => <button key={id} onClick={() => onAction(`${id} opened in the related incident sample.`)} className={`grid h-12 w-12 place-items-center rounded-full border-2 bg-white text-[8px] font-bold shadow-sm sm:h-14 sm:w-14 ${i === 0 ? "border-violet-500 text-violet-700" : "border-violet-200 text-slate-500"}`}>{id}</button>)}</div></div><div className="flex flex-wrap justify-between gap-2 border-t border-violet-100 pt-3 text-[10px] text-slate-500"><span><b className="text-slate-800">4</b> related tickets</span><span>First detected 14 min ago</span><button onClick={() => onAction("Incident group marked for monitoring.")} className="font-semibold text-violet-700">Monitor incident →</button></div></div><div className="rounded-xl border border-slate-100 p-4"><p className="text-xs font-bold text-slate-800">Telehealth appointment audio</p><p className="mt-1 text-[10px] text-slate-500">3 tickets · 84% similarity · Detected 38m ago</p><button onClick={() => onAction("Telehealth sample cluster opened.")} className="mt-2 text-[10px] font-semibold text-blue-600">Review cluster →</button></div></div></Panel><Panel title="Signal breakdown" subtitle="Why these tickets were connected"><div className="space-y-4">{[["Shared keywords", 92], ["Same domain / region", 88], ["Similar time window", 76], ["Matching symptoms", 94]].map(([label, amount]) => <div key={label}><div className="mb-1.5 flex justify-between text-[10px]"><span className="text-slate-600">{label}</span><b className="text-slate-800">{amount}%</b></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${amount}%` }} /></div></div>)}<p className="rounded-lg bg-slate-50 p-3 text-[9px] leading-relaxed text-slate-500">Similarity is illustrative demo data. Incident detection will be evaluated by the backend integration.</p></div></Panel></div>;
}

function ResolutionMemory({ onAction }: { onAction: (message: string) => void }) {
  return <div className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]"><Panel title="Suggested resolutions" subtitle="Knowledge surfaced from previously resolved sample tickets"><div className="space-y-4">{[
    { title: "Restore GPS sync for offline trackers", id: "SVX-2194", score: "94%", category: "Fleet tracking", steps: ["Confirm device heartbeat is current", "Refresh the route sync token", "Verify location pings resume within 5 minutes"] },
    { title: "Reauthorize driver application session", id: "SVX-2048", score: "87%", category: "Mobile app", steps: ["Clear the cached session", "Re-enroll the affected device", "Ask the driver to confirm sign-in"] },
    { title: "Rebuild location service connection", id: "SVX-1922", score: "81%", category: "Fleet tracking", steps: ["Check region-level service health", "Restart the location connector", "Compare position timestamps"] },
  ].map((item) => <article key={item.id} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs font-bold text-slate-800">{item.title}</p><p className="mt-1 text-[10px] text-slate-500">{item.category} · Resolved ticket {item.id}</p></div><span className="h-fit rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700">{item.score} match</span></div><ol className="mt-4 space-y-2">{item.steps.map((step, index) => <li key={step} className="flex gap-2 text-[10px] text-slate-600"><span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-slate-100 text-[8px] font-bold text-slate-500">{index + 1}</span>{step}</li>)}</ol><button onClick={() => onAction(`Resolution from ${item.id} copied to this sample case.`)} className="mt-4 rounded-lg border border-blue-100 px-3 py-2 text-[10px] font-semibold text-blue-700 hover:bg-blue-50">Use this resolution</button></article>)}</div></Panel><Panel title="Recently resolved" subtitle="Helpful outcomes from the team's history"><div className="space-y-3">{["Route location delay", "Consultation notes access", "Duplicate billing entry"].map((title, i) => <button key={title} onClick={() => onAction(`${title} sample history opened.`)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-50"><span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><BookOpenCheck size={15} /></span><span className="flex-1"><span className="block text-[10px] font-semibold text-slate-700">{title}</span><span className="mt-1 block text-[9px] text-slate-400">SVX-{2194 - i * 58} · Resolved {i + 2}d ago</span></span><ArrowRight size={13} className="text-slate-400" /></button>)}</div></Panel></div>;
}

function LiveIssueDna({ role }: { role: Role }) {
  type Incident = {
    id: string;
    title: string;
    summary: string;
    status: "POTENTIAL" | "CONFIRMED" | "RESOLVED";
    updatedAt: string;
    tickets: Array<{ similarity: number; ticket: { id: string; ticketCode: string; subject: string; status: string; priority: string } }>;
  };
  const [groups, setGroups] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadGroups = useCallback(async () => {
    try {
      const result = await apiRequest<{ items: Incident[] }>("/incidents");
      setGroups(result.items);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest<{ items: Incident[] }>("/incidents")
      .then((result) => { if (active) setGroups(result.items); })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function reviewGroup(id: string, status: "CONFIRMED" | "RESOLVED") {
    setLoading(true);
    setError("");
    try {
      await apiJson(`/incidents/${encodeURIComponent(id)}`, "PATCH", { status });
      await loadGroups();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  return <Panel title="Incident groups" subtitle="Groups and ticket similarity scores returned by the Issue DNA API.">
    {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    {loading ? <LoadingState label="Loading incident groups" /> : groups.length ? <div className="space-y-4">{groups.map((group) => <article key={group.id} className="rounded-xl border border-violet-100 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-800">{group.title}</h2><p className="mt-1 text-xs text-slate-600">{group.summary}</p></div><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[9px] font-bold text-violet-700">{group.status}</span></div><ul className="mt-4 space-y-2">{group.tickets.map(({ similarity, ticket }) => <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3"><Link href={`/${role}/tickets/${ticket.id}`} className="text-xs font-semibold text-blue-700 hover:underline">{ticket.ticketCode} · {ticket.subject}</Link><span className="text-[10px] text-slate-500">{Math.round(similarity * 100)}% similarity · {ticket.priority} · {ticket.status}</span></li>)}</ul><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-[10px] text-slate-400">Updated {new Date(group.updatedAt).toLocaleString()}</span><div className="flex gap-2"><button type="button" disabled={group.status === "CONFIRMED" || group.status === "RESOLVED"} onClick={() => void reviewGroup(group.id, "CONFIRMED")} className="rounded-lg border border-violet-200 px-3 py-2 text-[10px] font-semibold text-violet-700 disabled:opacity-50">Confirm</button><button type="button" disabled={group.status === "RESOLVED"} onClick={() => void reviewGroup(group.id, "RESOLVED")} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 disabled:opacity-50">Resolve group</button></div></div></article>)}</div> : <p className="text-xs text-slate-500">The API returned no incident groups. No clusters or predictions are fabricated.</p>}
  </Panel>;
}

function LiveResolutionMemory() {
  const { tickets, loading: ticketsLoading, error: ticketsError } = useTicketList("agent", "mine");
  const [ticketId, setTicketId] = useState("");
  type Suggestion = { id: string; title: string; issueSummary: string; solution: string; category: string; tags: string[]; similarity: number; ticket: { ticketCode: string } };
  const [suggestionResult, setSuggestionResult] = useState<{ ticketId: string; items: Suggestion[]; error?: string } | null>(null);
  const selectedTicketId = ticketId || tickets[0]?.id || "";

  useEffect(() => {
    if (!selectedTicketId) return;
    let active = true;
    apiRequest<{ suggestions: Suggestion[] }>(`/tickets/${encodeURIComponent(selectedTicketId)}/resolution-suggestions`)
      .then((result) => { if (active) setSuggestionResult({ ticketId: selectedTicketId, items: result.suggestions }); })
      .catch((requestError: unknown) => { if (active) setSuggestionResult({ ticketId: selectedTicketId, items: [], error: errorMessage(requestError) }); });
    return () => { active = false; };
  }, [selectedTicketId]);

  const currentResult = suggestionResult?.ticketId === selectedTicketId ? suggestionResult : null;
  const suggestions = currentResult?.items ?? [];
  const loading = Boolean(selectedTicketId) && !currentResult;
  const error = currentResult?.error ?? "";

  return <div className="space-y-5"><Panel title="Find a relevant saved resolution" subtitle="Suggestions are ranked by the existing Resolution Memory API.">{ticketsLoading ? <LoadingState label="Loading assigned tickets" /> : ticketsError ? <p role="alert" className="text-xs text-rose-700">{ticketsError}</p> : tickets.length ? <label className="block text-xs font-semibold text-slate-700">Ticket<select value={selectedTicketId} onChange={(event) => setTicketId(event.target.value)} className={inputClass}>{tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.ticketCode} · {ticket.subject}</option>)}</select></label> : <p className="text-xs text-slate-500">No assigned tickets are available to search.</p>}</Panel>
    <Panel title="Suggested resolutions" subtitle="Historical knowledge only; no generated answers.">{error ? <p role="alert" className="text-xs text-rose-700">{error}</p> : loading ? <LoadingState label="Searching saved resolutions" /> : suggestions?.length ? <div className="space-y-4">{suggestions.map((item) => <article key={item.id} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs font-bold text-slate-800">{item.title}</p><p className="mt-1 text-[10px] text-slate-500">{item.category} · Resolved ticket {item.ticket.ticketCode}</p></div><span className="h-fit rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700">{item.similarity}% similarity</span></div><p className="mt-3 text-xs text-slate-600">{item.issueSummary}</p><p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{item.solution}</p>{item.tags.length > 0 && <p className="mt-3 text-[10px] text-slate-400">Tags: {item.tags.join(", ")}</p>}</article>)}</div> : <p className="text-xs text-slate-500">{ticketId ? "No saved resolution matches were returned." : "Select an assigned ticket to search saved resolutions."}</p>}</Panel>
  </div>;
}

function Notifications({ onAction }: { onAction: (message: string) => void }) {
  const [items, setItems] = useState([
    { title: "Your ticket is now in progress", text: "Maya Chen is investigating SVX-2841.", time: "4 min ago", unread: true, icon: Activity },
    { title: "New response on your ticket", text: "There’s an update on SVX-2839.", time: "1 hour ago", unread: true, icon: MessageSquareText },
    { title: "Ticket resolved", text: "SVX-2828 was marked as resolved.", time: "Yesterday", unread: false, icon: CheckCircle2 },
  ]);
  return <div className="surface-card"><div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><h2 className="text-[15px] font-bold text-slate-900">Your updates</h2><p className="mt-1 text-xs text-slate-500">{items.filter((item) => item.unread).length} unread notifications</p></div><button onClick={() => setItems(items.map((item) => ({ ...item, unread: false })))} className="text-[10px] font-semibold text-blue-600">Mark all as read</button></div><NotificationPanel title="Latest notifications" description="Sample updates from your SOLVEX workspace."><div className="divide-y divide-slate-100">{items.map((item, index) => <div key={item.title} className={`flex items-start gap-3 py-4 ${item.unread ? "" : "opacity-70"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><item.icon size={16} /></span><div className="flex-1"><p className="text-xs font-bold text-slate-800">{item.title} {item.unread && <i className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-600" />}</p><p className="mt-1 text-[11px] text-slate-500">{item.text}</p><p className="mt-1.5 text-[9px] text-slate-400">{item.time}</p></div><button onClick={() => { setItems(items.map((entry, i) => i === index ? { ...entry, unread: false } : entry)); onAction("Notification marked as read."); }} className="text-[9px] font-semibold text-slate-400 hover:text-blue-600">{item.unread ? "Mark read" : "Read"}</button></div>)}</div></NotificationPanel></div>;
}

function LiveNotifications({ role }: { role: Role }) {
  type Notification = { id: string; type: string; title: string; body: string; ticketId: string | null; readAt: string | null; createdAt: string };
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    try {
      const result = await apiRequest<{ items: Notification[]; unreadCount: number }>("/notifications?page=1&limit=100");
      setItems(result.items);
      setUnreadCount(result.unreadCount);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest<{ items: Notification[]; unreadCount: number }>("/notifications?page=1&limit=100")
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setUnreadCount(result.unreadCount);
      })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function markRead(id: string, read: boolean) {
    setLoading(true);
    setError("");
    try {
      await apiJson(`/notifications/${encodeURIComponent(id)}`, "PATCH", { read });
      await loadNotifications();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  async function markAllRead() {
    setLoading(true);
    setError("");
    try {
      await apiRequest("/notifications/read-all", { method: "PATCH" });
      await loadNotifications();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  return <div className="surface-card"><div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><h2 className="text-[15px] font-bold text-slate-900">Your updates</h2><p className="mt-1 text-xs text-slate-500">{unreadCount} unread notification{unreadCount === 1 ? "" : "s"}</p></div><button disabled={unreadCount === 0 || loading} onClick={() => void markAllRead()} className="text-[10px] font-semibold text-blue-600 disabled:text-slate-400">Mark all as read</button></div><NotificationPanel title="Latest notifications" description="Notifications from the API"><div className="px-5"><div role="alert">{error && <p className="my-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}</div>{loading ? <div className="py-5"><LoadingState label="Loading notifications" /></div> : items.length ? <div className="divide-y divide-slate-100">{items.map((item) => <div key={item.id} className={`flex items-start gap-3 py-4 ${item.readAt ? "opacity-70" : ""}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><MessageSquareText size={16} /></span><div className="flex-1"><p className="text-xs font-bold text-slate-800">{item.title} {!item.readAt && <i className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-600" />}</p><p className="mt-1 text-[11px] text-slate-500">{item.body}</p><p className="mt-1.5 text-[9px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>{item.ticketId && <Link href={`/${role}/tickets/${item.ticketId}`} className="mt-2 inline-block text-[10px] font-semibold text-blue-600">View ticket →</Link>}</div><button onClick={() => void markRead(item.id, !item.readAt)} className="text-[9px] font-semibold text-slate-400 hover:text-blue-600">{item.readAt ? "Mark unread" : "Mark read"}</button></div>)}</div> : <p className="py-8 text-center text-xs text-slate-500">No notifications have been returned.</p>}</div></NotificationPanel></div>;
}

function Profile({ role, onAction }: { role: Role; onAction: (message: string) => void }) {
  return <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]"><Panel title="Personal information" subtitle="This profile is local sample data."><form onSubmit={(event) => { event.preventDefault(); onAction("Profile changes saved in this demo."); }} className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input className={inputClass} defaultValue={role === "customer" ? "Aarav Mehta" : role === "agent" ? "Maya Chen" : "Olivia Bennett"} /></Field><Field label="Email address"><input type="email" className={inputClass} defaultValue="hello@solvex.demo" /></Field><Field label="Time zone"><select className={inputClass}><option>Asia / Kolkata (UTC +05:30)</option><option>America / New York</option><option>Europe / London</option></select></Field><Field label="Language"><select className={inputClass}><option>English</option><option>Hindi</option></select></Field><div className="sm:col-span-2"><button className="rounded-lg bg-blue-600 px-4 py-2.5 text-[11px] font-semibold text-white hover:bg-blue-700">Save profile</button></div></form></Panel><Panel title="Preferences" subtitle="Personalize how SOLVEX keeps you informed."><div className="space-y-4">{["Email me about ticket updates", "Send me SLA milestone reminders", "Weekly support summary"].map((label, index) => <label key={label} className="flex items-center justify-between gap-3 text-[11px] text-slate-600">{label}<input type="checkbox" defaultChecked={index < 2} className="h-4 w-4 accent-blue-600" /></label>)}</div><button onClick={() => onAction("Notification preferences updated in the demo.")} className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Update preferences</button></Panel></div>;
}

function LiveProfile({ role }: { role: Role }) {
  const { user, loading, error: sessionError, refresh } = useSession();
  const [draft, setDraft] = useState<{ userId: string; fullName: string; phone: string; company: string; preferredDomain: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const profile = user
    ? draft?.userId === user.id
      ? draft
      : { userId: user.id, fullName: user.fullName, phone: user.phone ?? "", company: user.company ?? "", preferredDomain: user.preferredDomain ?? "" }
    : null;

  function updateProfile(field: "fullName" | "phone" | "company" | "preferredDomain", value: string) {
    if (!user || !profile) return;
    setDraft({ ...profile, [field]: value });
    setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const result = await apiJson<{ user: NonNullable<typeof user> }>("/auth/me", "PATCH", {
        fullName: profile.fullName,
        phone: profile.phone || null,
        company: profile.company || null,
        preferredDomain: profile.preferredDomain || null,
      });
      setDraft({ userId: result.user.id, fullName: result.user.fullName, phone: result.user.phone ?? "", company: result.user.company ?? "", preferredDomain: result.user.preferredDomain ?? "" });
      setSaved(true);
      await refresh();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]"><Panel title={`${role[0]?.toUpperCase()}${role.slice(1)} profile`} subtitle="Account fields are saved by the authenticated API.">{sessionError && <p role="alert" className="mb-3 text-xs text-rose-700">{sessionError}</p>}{loading ? <LoadingState label="Loading your profile" /> : user && profile ? <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input required minLength={2} maxLength={120} value={profile.fullName} onChange={(event) => updateProfile("fullName", event.target.value)} className={inputClass} /></Field><Field label="Email address"><input type="email" value={user.email} readOnly className={`${inputClass} bg-slate-50`} /></Field><Field label="Phone"><input maxLength={32} value={profile.phone} onChange={(event) => updateProfile("phone", event.target.value)} className={inputClass} /></Field><Field label="Company"><input maxLength={160} value={profile.company} onChange={(event) => updateProfile("company", event.target.value)} className={inputClass} /></Field><Field label="Preferred domain"><select value={profile.preferredDomain} onChange={(event) => updateProfile("preferredDomain", event.target.value)} className={inputClass}><option value="">No preference</option><option value="HEALTH">Health</option><option value="LOGISTICS">Logistics</option><option value="SMART_OPERATIONS">Smart operations</option></select></Field><div className="flex items-end"><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2.5 text-[11px] font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save profile"}</button></div>{error && <p role="alert" className="sm:col-span-2 text-xs text-rose-700">{error}</p>}{saved && <p role="status" className="sm:col-span-2 text-xs text-emerald-700">Profile updated.</p>}</form> : <p className="text-xs text-slate-500">Profile is unavailable for this session.</p>}</Panel><Panel title="Account options" subtitle="Preferences without backend support are not shown as saved."><p className="text-xs leading-relaxed text-slate-600">Email, notification preferences, time zone, and language settings do not have corresponding API endpoints yet. No local-only save action is presented.</p></Panel></div>;
}

function PeopleTable({ kind }: { kind: "customer" | "agent" }) {
  const isAgent = kind === "agent";
  const rows = isAgent ? agents.map((agent) => [agent.name, `${agent.active} active tickets`, `${agent.urgent} urgent`, `${agent.capacity}% capacity`, agent.capacity > 85 ? "At capacity" : "Available"]) : [["Aarav Mehta", "12 tickets", "Logistics", "Today, 9:18 AM", "Active"], ["Riya Kapoor", "8 tickets", "Health", "Today, 8:42 AM", "Active"], ["Northstar Logistics", "26 tickets", "Fleet tracking", "Yesterday", "Active"], ["Sofia Alvarez", "5 tickets", "Smart operations", "Yesterday", "Active"]];
  return <Panel title={isAgent ? "Support team" : "Customer accounts"} subtitle="Sample directory records"><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left"><thead><tr className="border-y border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">{(isAgent ? ["Agent", "Workload", "Urgent", "Capacity", "Status"] : ["Customer", "Tickets", "Domain", "Last active", "Status"]).map((label) => <th className="px-3 py-3 font-bold" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]} className="border-b border-slate-50 text-[11px]"><td className="px-3 py-4 font-semibold text-slate-800">{row[0]}</td>{row.slice(1).map((value, i) => <td className="px-3 py-4 text-slate-600" key={i}>{i === row.length - 2 ? <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${value === "At capacity" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{value}</span> : value}</td>)}</tr>)}</tbody></table></div></Panel>;
}

function LivePeopleTable({ kind }: { kind: "customer" | "agent" }) {
  type ManagedUser = NonNullable<ReturnType<typeof useSession>["user"]> & {
    _count: { customerTickets: number; assignedTickets: number };
  };
  const isAgent = kind === "agent";
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      const path = isAgent
        ? "/users?role=AGENT&page=1&limit=100"
        : "/users/customers?page=1&limit=100";
      const result = await apiRequest<{ items: ManagedUser[] }>(path);
      setUsers(result.items);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [isAgent]);

  useEffect(() => {
    let active = true;
    const path = isAgent ? "/users?role=AGENT&page=1&limit=100" : "/users/customers?page=1&limit=100";
    apiRequest<{ items: ManagedUser[] }>(path)
      .then((result) => { if (active) setUsers(result.items); })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAgent]);

  async function changeStatus(user: ManagedUser) {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await apiJson(`/users/${encodeURIComponent(user.id)}/status`, "PATCH", { isActive: !user.isActive });
      setSuccess(`${user.fullName}'s account was ${user.isActive ? "deactivated" : "activated"}.`);
      await loadUsers();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  async function createAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setError("");
    setSuccess("");
    const data = new FormData(form);
    try {
      await apiJson("/users/agents", "POST", {
        fullName: String(data.get("fullName") ?? ""),
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
        skills: [],
      });
      form.reset();
      setSuccess("Agent account created.");
      await loadUsers();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-5">
    {isAgent && <Panel title="Provision an agent" subtitle="Agents are created by administrators only; no public agent registration is available."><form onSubmit={createAgent} className="grid gap-3 sm:grid-cols-2"><Field label="Full name"><input name="fullName" required minLength={2} maxLength={120} className={inputClass} /></Field><Field label="Email"><input name="email" type="email" required className={inputClass} /></Field><Field label="Temporary password"><input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" className={inputClass} /></Field><div className="flex items-end"><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2.5 text-[11px] font-semibold text-white disabled:opacity-60">{saving ? "Creating…" : "Create agent"}</button></div></form></Panel>}
    <Panel title={isAgent ? "Support team" : "Customer accounts"} subtitle="Accounts and ticket counts returned by the users API.">
      {error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      {success && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">{success}</p>}
      {loading ? <LoadingState label="Loading accounts" /> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead><tr className="border-y border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">{["Name", "Email", "Tickets", "Created", "Status", "Action"].map((label) => <th className="px-3 py-3 font-bold" key={label}>{label}</th>)}</tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b border-slate-50 text-[11px]"><td className="px-3 py-4 font-semibold text-slate-800">{user.fullName}</td><td className="px-3 py-4 text-slate-600">{user.email}</td><td className="px-3 py-4 text-slate-600">{isAgent ? user._count.assignedTickets : user._count.customerTickets}</td><td className="px-3 py-4 text-slate-600">{new Date(user.createdAt).toLocaleDateString()}</td><td className="px-3 py-4"><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{user.isActive ? "Active" : "Inactive"}</span></td><td className="px-3 py-4"><button type="button" onClick={() => void changeStatus(user)} className="text-[10px] font-semibold text-blue-600">{user.isActive ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table>{users.length === 0 && <p className="py-8 text-center text-xs text-slate-500">No accounts were returned.</p>}</div>}
    </Panel>
  </div>;
}

function Assignments({ onAction }: { onAction: (message: string) => void }) {
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  return <div className="grid gap-5 xl:grid-cols-[1.3fr_0.8fr]"><Panel title="Assignment recommendations" subtitle="Suggested from sample workload and skill data"><div className="space-y-3">{demoTickets.filter((ticket) => ticket.agent === "Unassigned").map((ticket) => <div key={ticket.id} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold text-slate-800">{ticket.id} · {ticket.subject}</p><p className="mt-1 text-[10px] text-slate-500">{ticket.category} · {ticket.priority} priority</p></div><select aria-label={`Assign ${ticket.id}`} value={assigned[ticket.id] ?? ""} onChange={(event) => setAssigned({ ...assigned, [ticket.id]: event.target.value })} className="h-9 rounded-lg border border-slate-200 px-2 text-[10px]"><option value="">Choose agent</option>{agents.map((agent) => <option key={agent.name}>{agent.name}</option>)}</select></div><div className="mt-3 flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2 text-[10px] text-teal-800"><span><Sparkles size={12} className="mr-1 inline" />Recommended: Amara Okafor · balanced load</span><span>46% capacity</span></div><button disabled={!assigned[ticket.id]} onClick={() => onAction(`${ticket.id} assigned to ${assigned[ticket.id]}.`)} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">Assign ticket</button></div>)}</div></Panel><FairnessPanel /></div>;
}

function LiveAssignments() {
  type Recommendation = { agentId: string; name: string; activeTickets: number; urgentTickets: number; skillLevel: number; score: number; reasons: string[] };
  const { analytics } = useAnalytics("admin");
  const [tickets, setTickets] = useState<ApiTicket[]>([]);
  const [ticketId, setTicketId] = useState("");
  const [recommendationResult, setRecommendationResult] = useState<{ ticketId: string; items: Recommendation[]; error?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadQueue = useCallback(async () => {
    try {
      const ticketResult = await apiRequest<{ items: ApiTicket[] }>("/tickets?page=1&limit=100&assigned=unassigned");
      setTickets(ticketResult.items);
      setTicketId((current) => ticketResult.items.some((item) => item.id === current) ? current : ticketResult.items[0]?.id ?? "");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest<{ items: ApiTicket[] }>("/tickets?page=1&limit=100&assigned=unassigned")
      .then((result) => {
        if (!active) return;
        setTickets(result.items);
        setTicketId((current) => result.items.some((item) => item.id === current) ? current : result.items[0]?.id ?? "");
      })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ticketId) return;
    let active = true;
    apiRequest<{ recommendations: Recommendation[] }>(`/assignments/tickets/${encodeURIComponent(ticketId)}/recommendations`)
      .then((result) => { if (active) setRecommendationResult({ ticketId, items: result.recommendations }); })
      .catch((requestError: unknown) => { if (active) setRecommendationResult({ ticketId, items: [], error: errorMessage(requestError) }); });
    return () => { active = false; };
  }, [ticketId]);

  async function assign(agentId: string) {
    if (!ticketId) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await apiJson(`/assignments/tickets/${encodeURIComponent(ticketId)}/assign`, "POST", { agentId });
      setSuccess("Ticket assigned.");
      await loadQueue();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  const selectedTicket = tickets.find((ticket) => ticket.id === ticketId);
  const currentRecommendation = recommendationResult?.ticketId === ticketId ? recommendationResult : null;
  const recommendations = currentRecommendation?.items ?? [];
  const recommending = Boolean(ticketId) && !currentRecommendation;
  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">{success}</p>}
    <Panel title="Unassigned ticket queue" subtitle="Tickets and assignee recommendations come from the API.">{loading ? <LoadingState label="Loading unassigned tickets" /> : tickets.length ? <label className="block text-xs font-semibold text-slate-700">Ticket<select value={ticketId} onChange={(event) => setTicketId(event.target.value)} className={inputClass}>{tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.ticketCode} · {ticket.subject}</option>)}</select></label> : <p className="text-xs text-slate-500">No unassigned tickets were returned.</p>}</Panel>
    <Panel title="Assignment recommendations" subtitle={selectedTicket ? `${selectedTicket.ticketCode} · Recommendation scores are calculated by the backend.` : "Select an unassigned ticket to load recommendations."}>
      {currentRecommendation?.error ? <p role="alert" className="text-xs text-rose-700">{currentRecommendation.error}</p> : recommending ? <LoadingState label="Calculating recommendations" /> : recommendations.length ? <div className="space-y-3">{recommendations.map((recommendation) => <article key={recommendation.agentId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"><div><p className="text-xs font-bold text-slate-800">{recommendation.name} · score {recommendation.score}</p><p className="mt-1 text-[10px] text-slate-500">{recommendation.activeTickets} active · {recommendation.urgentTickets} urgent · skill level {recommendation.skillLevel}</p><p className="mt-1 text-[10px] text-slate-500">{recommendation.reasons.join(" · ")}</p></div><button type="button" onClick={() => void assign(recommendation.agentId)} className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white">Assign ticket</button></article>)}</div> : !loading && selectedTicket ? <p className="text-xs text-slate-500">No eligible active agents were recommended.</p> : null}
    </Panel>
    <FairnessPanel workload={analytics?.agentWorkload ?? []} />
  </div>;
}

function Analytics() {
  return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="SLA compliance" value="96.8%" change="+2.1%" icon={ShieldCheck} tone="teal" /><StatCard label="SLA breaches" value="80" caption="−12% from last month" icon={ShieldAlert} tone="rose" /><StatCard label="Avg. resolution" value="4h 18m" change="−18 min" icon={Clock3} tone="blue" /><StatCard label="Customer satisfaction" value="4.8 / 5" change="+0.3" icon={HeartPulse} tone="violet" /></div><div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]"><Panel title="Support volume" subtitle="Tickets opened and resolved · last 7 days" action={<span className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] text-slate-500">Last 7 days</span>}><VolumeChart type="bar" /></Panel><Panel title="Category distribution" subtitle="Requests by support domain"><CategoryChart /></Panel></div><div className="grid gap-5 xl:grid-cols-2"><Panel title="SLA compliance trend" subtitle="Weekly attainment in percent"><div className="space-y-3">{[["Week 1", 91], ["Week 2", 94], ["Week 3", 93], ["Week 4", 97]].map(([label, num]) => <div key={label}><div className="mb-1 flex justify-between text-[10px]"><span className="text-slate-600">{label}</span><b>{num}%</b></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500" style={{ width: `${num}%` }} /></div></div>)}</div></Panel><FairnessPanel /></div></>;
}

function LiveAnalytics() {
  const { analytics, loading, error } = useAnalytics("admin");
  if (loading) return <LoadingState label="Loading analytics" />;
  if (error) return <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>;
  if (!analytics) return <p className="text-xs text-slate-500">Analytics data is unavailable.</p>;

  const maxPriority = Math.max(1, ...analytics.priorities.map((item) => item.count));
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Total tickets" value={String(analytics.totalTickets)} caption="API total" icon={FileText} tone="blue" />
      <StatCard label="SLA compliance" value={`${analytics.slaCompliance}%`} caption="API metric" icon={ShieldCheck} tone="teal" />
      <StatCard label="SLA breaches" value={String(analytics.slaBreaches)} caption="API total" icon={ShieldAlert} tone="rose" />
      <StatCard label="Average resolution" value={`${analytics.averageResolutionTimeHours} hours`} caption="API metric" icon={Clock3} tone="violet" />
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
      <Panel title="Ticket volume" subtitle="Time-series data is unavailable from the current analytics API."><VolumeChart type="bar" /></Panel>
      <Panel title="Category distribution" subtitle="Category totals returned by the analytics API"><CategoryChart data={analytics.categories.map((item) => ({ name: item.category, value: item.count }))} /></Panel>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Priority mix" subtitle="Counts returned by the analytics API"><div className="space-y-4">{analytics.priorities.length ? analytics.priorities.map((item) => <div key={item.priority}><div className="mb-1.5 flex justify-between text-[10px]"><span>{displayPriority(item.priority)}</span><b>{item.count}</b></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${item.count / maxPriority * 100}%` }} /></div></div>) : <p className="text-xs text-slate-500">No priority counts are available.</p>}</div></Panel>
      <Panel title="Customer satisfaction" subtitle="Recorded feedback only"><p className="text-2xl font-bold text-slate-900">{analytics.customerSatisfaction.feedbackCount ? `${analytics.customerSatisfaction.averageRating} / 5` : "No ratings yet"}</p><p className="mt-2 text-xs text-slate-500">{analytics.customerSatisfaction.feedbackCount} submitted responses</p></Panel>
    </div>
    <FairnessPanel workload={analytics.agentWorkload} />
  </>;
}

function LiveSlaConfig() {
  type Policy = { id: string; domain: ApiTicket["domain"]; priority: ApiTicket["priority"]; firstResponseMinutes: number; resolutionMinutes: number; updateIntervalHours: number; isActive: boolean };
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPolicies = useCallback(async () => {
    try {
      const result = await apiRequest<{ items: Policy[] }>("/sla/policies");
      setPolicies(result.items);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest<{ items: Policy[] }>("/sla/policies")
      .then((result) => { if (active) setPolicies(result.items); })
      .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function savePolicy(event: FormEvent<HTMLFormElement>, policy: Policy) {
    event.preventDefault();
    setLoading(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    setSavingId(policy.id);
    setError("");
    setSuccess("");
    try {
      await apiJson("/sla/policies", "PUT", {
        domain: policy.domain,
        priority: policy.priority,
        firstResponseMinutes: Number(data.get("firstResponseMinutes")),
        resolutionMinutes: Number(data.get("resolutionMinutes")),
        updateIntervalHours: Number(data.get("updateIntervalHours")),
        isActive: data.get("isActive") === "on",
      });
      setSuccess(`${displayDomain(policy.domain)} · ${displayPriority(policy.priority)} policy saved.`);
      await loadPolicies();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSavingId("");
    }
  }

  return <Panel title="SLA policies" subtitle="Policy values are loaded and saved through the existing admin API.">{error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}{success && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">{success}</p>}{loading ? <LoadingState label="Loading SLA policies" /> : policies.length ? <div className="space-y-4">{policies.map((policy) => <form key={policy.id} onSubmit={(event) => void savePolicy(event, policy)} className="grid gap-3 rounded-xl border border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-5"><div className="text-xs font-semibold text-slate-800">{displayDomain(policy.domain)} · {displayPriority(policy.priority)}</div><Field label="First response (minutes)"><input name="firstResponseMinutes" type="number" min={1} max={100800} defaultValue={policy.firstResponseMinutes} required className={inputClass} /></Field><Field label="Resolution (minutes)"><input name="resolutionMinutes" type="number" min={1} max={100800} defaultValue={policy.resolutionMinutes} required className={inputClass} /></Field><Field label="Update interval (hours)"><input name="updateIntervalHours" type="number" min={1} max={168} defaultValue={policy.updateIntervalHours} required className={inputClass} /></Field><div className="flex items-end justify-between gap-2"><label className="flex items-center gap-2 text-[10px] text-slate-600"><input name="isActive" type="checkbox" defaultChecked={policy.isActive} className="h-4 w-4 accent-blue-600" />Active</label><button disabled={savingId === policy.id} className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-60">{savingId === policy.id ? "Saving…" : "Save"}</button></div></form>)}</div> : <p className="text-xs text-slate-500">The API returned no SLA policies.</p>}</Panel>;
}

function LiveSettings() {
  return <Panel title="Workspace settings" subtitle="No workspace-settings endpoint is available in the existing API."><p className="text-xs leading-relaxed text-slate-600">Organization identity and platform preference controls have no backend persistence endpoint. They are intentionally unavailable here rather than appearing to save values that would be lost.</p></Panel>;
}

