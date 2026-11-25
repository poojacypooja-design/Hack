"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
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
      {section === "overview" && <Overview role={role} />}
      {section === "create" && <CreateTicket onCreated={() => notify("Your sample ticket has been created successfully.")} />}
      {section === "tickets" && (ticketId ? <TicketDetail role={role} ticketId={ticketId} onAction={notify} /> : <TicketList role={role} />)}
      {section === "journey" && <TicketJourney />}
      {section === "inbox" && <TicketList role={role} mode="unassigned" />}
      {section === "assigned" && <TicketList role={role} mode="mine" />}
      {section === "sla" && <SlaPage onAction={notify} />}
      {section === "rescue" && <RescuePage onAction={notify} />}
      {section === "issue-dna" && <IssueDna onAction={notify} />}
      {section === "resolution-memory" && <ResolutionMemory onAction={notify} />}
      {section === "notifications" && <Notifications onAction={notify} />}
      {section === "profile" && <Profile role={role} onAction={notify} />}
      {section === "customers" && <PeopleTable kind="customer" />}
      {section === "agents" && <PeopleTable kind="agent" />}
      {section === "assignments" && <Assignments onAction={notify} />}
      {section === "analytics" && <Analytics />}
      {section === "settings" && <Settings onAction={notify} />}
      {section === "sla-config" && <SlaConfig onAction={notify} />}
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

function TicketList({ role, mode }: { role: Role; mode?: "mine" | "unassigned" }) {
  const [view, setView] = useState("all");
  const statusFilter = view === "all" ? "All statuses" : view === "open" ? "Open" : view === "in progress" ? "In progress" : "Resolved";
  return (
    <Panel title={role === "agent" ? mode === "unassigned" ? "Authorized unassigned tickets" : "Your assigned tickets" : "All support tickets"} subtitle={role === "agent" ? "Sample queue — assignment permissions are for demonstration only." : "Sample workspace records for frontend demonstration."}>
      <div className="mb-4 flex gap-2 border-b border-slate-100 pb-3">{["all", "open", "in progress", "resolved"].map((item) => <button key={item} onClick={() => setView(item)} className={`rounded-full px-3 py-1.5 text-[10px] font-semibold capitalize ${view === item ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{item}</button>)}</div>
      <div className="hidden">{view}</div>
      <TicketTable key={`${view}-${mode ?? role}`} mode={mode ?? (role === "customer" ? "customer" : "default")} initialStatus={statusFilter} hrefPrefix={`/${role}/tickets`} />
    </Panel>
  );
}

function CreateTicket({ onCreated }: { onCreated: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [domain, setDomain] = useState<keyof typeof categoriesByDomain>("Logistics");
  const [fileName, setFileName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const categories = categoriesByDomain[domain];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setConfirmationOpen(true);
    onCreated();
  }
  return (
    <>
    <form ref={formRef} onSubmit={submit} className="grid gap-5 xl:grid-cols-[1.5fr_0.8fr]">
      <div className="space-y-5">
        <Panel title="Tell us what’s going on" subtitle="The more detail you share, the faster we can help.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Operating domain"><select value={domain} onChange={(event) => setDomain(event.target.value as keyof typeof categoriesByDomain)} className={inputClass}><option>Logistics</option><option>Health</option><option>Smart Operations</option></select></Field>
            <Field label="Category"><select required className={inputClass}><option value="">Select a category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></Field>
            <Field label={domain === "Logistics" ? "Route / vehicle ID" : domain === "Health" ? "Appointment reference" : "Device / site ID"} wide><input required placeholder={domain === "Logistics" ? "e.g. Route 204 or vehicle ID" : domain === "Health" ? "e.g. appointment reference (no sensitive health data)" : "e.g. device serial or site reference"} className={inputClass} /></Field>
            <Field label="Subject" wide><input required minLength={6} placeholder="A short summary of the issue" className={inputClass} /></Field>
            <Field label="Description" wide><textarea required minLength={15} rows={5} placeholder="What happened? Include any error messages or context that could help." className={`${inputClass} resize-y`} /></Field>
            <Field label="Priority"><select className={inputClass}><option>Medium</option><option>Low</option><option>High</option><option>Critical</option></select></Field>
            <Field label="When did this start?"><select className={inputClass}><option>Today</option><option>Yesterday</option><option>Within the last week</option><option>More than a week ago</option></select></Field>
          </div>
        </Panel>
        <Panel title="Help us reproduce it" subtitle="A few details can help the right specialist resolve this sooner.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="What did you expect to happen?"><textarea rows={3} placeholder="Describe the expected result" className={`${inputClass} resize-y`} /></Field>
            <Field label="What actually happened?"><textarea rows={3} placeholder="Describe what you experienced" className={`${inputClass} resize-y`} /></Field>
            <Field label="What have you tried so far?" wide><input placeholder="Steps already taken" className={inputClass} /></Field>
          </div>
        </Panel>
        <div className="flex flex-wrap items-center gap-3"><button type="submit" className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-bold text-white shadow-sm hover:bg-blue-700">{submitted ? <><Check size={15} /> Submitted</> : <>Submit support request <ArrowRight size={15} /></>}</button><p className="text-[10px] text-slate-400">A confirmation will appear in your sample workspace.</p></div>
      </div>
      <aside className="space-y-4">
        <Panel title="Attachments" subtitle="Screenshots and files help us investigate.">
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-blue-400 hover:bg-blue-50/50"><span className="mb-2 grid h-9 w-9 place-items-center rounded-full bg-white text-slate-500 shadow-sm"><Plus size={18} /></span><span className="text-xs font-semibold text-slate-700">{fileName || "Add an attachment"}</span><span className="mt-1 text-[10px] text-slate-400">PNG, JPG, PDF up to 10 MB</span><input type="file" accept=".png,.jpg,.jpeg,.pdf" className="sr-only" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")} /></label>
        </Panel>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5"><div className="flex items-center gap-2 text-blue-700"><Sparkles size={16} /><p className="text-xs font-bold">Smart routing preview</p></div><p className="mt-2 text-[11px] leading-relaxed text-slate-600">SOLVEX will use your domain and category to suggest the right support team. This demo does not connect to a live service.</p></div>
        <RiskCard compact />
      </aside>
    </form>
    <Modal open={confirmationOpen} title="Support request created" onClose={() => setConfirmationOpen(false)}>
      <div className="text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={24} /></span><p className="mt-4 text-sm font-bold text-slate-800">Your request is in the sample queue.</p><p className="mt-2 text-xs leading-relaxed text-slate-500">Ticket ID <b className="text-blue-700">SVX-2842</b> · This confirmation is local demo behavior, not a live submission.</p>      <div className="mt-5 flex justify-center gap-2"><button type="button" onClick={() => { formRef.current?.reset(); setDomain("Logistics"); setFileName(""); setSubmitted(false); setConfirmationOpen(false); }} className="rounded-lg border border-slate-200 px-4 py-2.5 text-[10px] font-semibold text-slate-600">Create another</button><Link href="/customer/tickets" className="rounded-lg bg-blue-600 px-4 py-2.5 text-[10px] font-semibold text-white">View my tickets</Link></div></div>
    </Modal>
    </>
  );
}

const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={`block text-[11px] font-semibold text-slate-700 ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>;
}

function TicketDetail({ role, ticketId, onAction }: { role: Role; ticketId: string; onAction: (message: string) => void }) {
  const ticket = demoTickets.find((item) => item.id === ticketId) ?? demoTickets[0];
  const [reply, setReply] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const [feedback, setFeedback] = useState(0);
  function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reply.trim()) return;
    onAction(noteMode ? "Private note saved to the sample ticket." : "Your sample reply has been added.");
    setReply("");
  }
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3"><div className="flex items-center gap-2 text-xs text-blue-900"><span className="font-bold">{ticket.id}</span><span>·</span><span>{ticket.category}</span></div><div className="flex items-center gap-2"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} /></div></div>
      <div className="grid gap-5 xl:grid-cols-[1.55fr_0.75fr]">
        <div className="space-y-5">
          <Panel title={ticket.subject} subtitle={`Created today by ${ticket.customer}`}>
            <p className="text-sm leading-7 text-slate-600">The live location has stopped updating for several vehicles on our west region route. We’ve checked that the devices are online and restarted the tracking app, but the latest position is still showing from earlier this morning.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-slate-500"><span className="rounded-md bg-slate-100 px-2.5 py-1.5">Domain · Logistics</span><span className="rounded-md bg-slate-100 px-2.5 py-1.5">Priority · {ticket.priority}</span><span className="rounded-md bg-slate-100 px-2.5 py-1.5">3 attachments</span></div>
          </Panel>
          <Panel title={role === "customer" ? "Conversation" : "Conversation & notes"} subtitle="A clear timeline of communication.">
            <div className="space-y-4">
              <Message author="Maya Chen" initials="MC" time="Today at 10:42 AM" internal={false}>Hi Aarav, I’m looking into the tracking sync for your west region vehicles. Could you share which route IDs are affected?</Message>
              <Message author="Aarav Mehta" initials="AM" time="Today at 10:18 AM" internal={false}>This is affecting routes 204 and 208. The driver app is showing the vehicles as online.</Message>
              {role !== "customer" && <Message author="Maya Chen" initials="MC" time="Today at 10:46 AM" internal={true}>Similar reports from the west region are grouped under a possible GPS sync incident.</Message>}
            </div>
            <form onSubmit={sendReply} className={`mt-5 rounded-xl border p-3 ${noteMode ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-slate-50"}`}>
              {role !== "customer" && <div className="mb-2 flex gap-2"><button type="button" onClick={() => setNoteMode(false)} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${!noteMode ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-white"}`}>Public reply</button><button type="button" onClick={() => setNoteMode(true)} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${noteMode ? "bg-amber-500 text-white" : "text-slate-500 hover:bg-white"}`}>Private note</button></div>}
              <textarea required value={reply} onChange={(event) => setReply(event.target.value)} rows={3} placeholder={noteMode ? "Add an internal note — only your team can see this…" : "Write a helpful response…"} className="w-full resize-y bg-transparent text-xs outline-none placeholder:text-slate-400" />
              <div className="flex justify-end"><button className={`rounded-lg px-3 py-2 text-[10px] font-bold text-white ${noteMode ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}`}>{noteMode ? "Add private note" : "Send reply"}</button></div>
            </form>
          </Panel>
          {ticket.status === "Resolved" && role === "customer" && <Panel title="Was this resolution helpful?" subtitle="Your feedback helps us improve support."><div className="flex gap-2">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} onClick={() => setFeedback(rating)} className={`grid h-9 w-9 place-items-center rounded-full text-sm ${feedback >= rating ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"}`}>★</button>)}{feedback > 0 && <span className="self-center text-xs text-emerald-600">Thanks for sharing your feedback.</span>}</div><button onClick={() => onAction("Resolution confirmed in the demo ticket.")} className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Confirm resolution</button></Panel>}
        </div>
        <div className="space-y-4"><RiskCard compact /><Panel title="Ticket journey" subtitle="Every step, clearly visible."><Journey /></Panel><Panel title="Ticket details"><DetailLine label="Assigned agent" value={ticket.agent} /><DetailLine label="Created" value="Today, 9:18 AM" /><DetailLine label="Last updated" value={ticket.updated} /><DetailLine label="SLA target" value="First response · 2 hours" /><DetailLine label="Ticket owner" value={ticket.customer} /></Panel><Panel title="Issue DNA" subtitle="Potentially related incident"><div className="rounded-lg bg-violet-50 p-3"><div className="flex items-center gap-2 text-violet-700"><Dna size={15} /><span className="text-xs font-bold">GPS Sync · West region</span></div><p className="mt-2 text-[10px] text-slate-600">4 similar reports · 92% similarity</p><button onClick={() => onAction("Opened related tickets in the sample incident group.")} className="mt-2 text-[10px] font-semibold text-violet-700">Explore incident →</button></div></Panel></div>
      </div>
    </>
  );
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
  return <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><Panel title="SVX-2841 · Live location is not updating" subtitle="Your latest support request · Updated 4 minutes ago"><div className="rounded-xl bg-slate-50 p-5"><TicketTimeline activeIndex={3} /></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] text-slate-500">Assigned to <b className="text-slate-700">Maya Chen</b> · Fleet tracking specialist</p><Link href="/customer/tickets/SVX-2841" className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white">Open ticket details</Link></div></Panel><Panel title="What happens next?" subtitle="SOLVEX keeps you informed at every step."><div className="space-y-4 text-xs leading-relaxed text-slate-600"><p><b className="text-slate-800">Investigation is underway.</b> Your agent is checking the affected fleet routes and comparing related reports.</p><p><b className="text-slate-800">You’ll hear from us soon.</b> The team will share an update as soon as there’s meaningful progress.</p><p className="rounded-lg bg-teal-50 p-3 text-[10px] text-teal-800">No silent handoffs. Your assigned specialist and response target remain visible throughout the journey.</p></div></Panel></div>;
}

function NoSilenceCard() {
  return <Panel title="No-Silence Promise" subtitle="Keep every customer in the loop." action={<span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">1 FOLLOW-UP</span>}>
    <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700"><BellRing size={16} /></span><div className="flex-1"><p className="text-xs font-bold text-slate-800">SVX-2839 · No update in 3h 12m</p><p className="mt-1 text-[10px] text-slate-500">Assigned to Daniel Kim · Follow-up due</p><Link href="/agent/assigned" className="mt-2 inline-block text-[10px] font-semibold text-amber-800">Review ticket →</Link></div></div>
  </Panel>;
}

function FairnessPanel() {
  return <Panel title="Agent fairness meter" subtitle="Active workload across the team" action={<Link href="/admin/agents" className="text-[10px] font-semibold text-blue-600">Team →</Link>}>
    <div className="space-y-4">{agents.map((agent) => <div key={agent.name}><div className="mb-1.5 flex items-center gap-2"><span className={`grid h-7 w-7 place-items-center rounded-full text-[9px] font-bold ${agent.color}`}>{agent.initials}</span><span className="flex-1 text-[10px] font-semibold text-slate-700">{agent.name}</span><span className="text-[10px] text-slate-500">{agent.active} active</span></div><div className="ml-9 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${agent.capacity > 85 ? "bg-rose-400" : agent.capacity > 70 ? "bg-amber-400" : "bg-teal-400"}`} style={{ width: `${agent.capacity}%` }} /></div></div>)}</div>
    <div className="mt-4 rounded-lg bg-teal-50 p-3 text-[10px] leading-relaxed text-teal-800"><Sparkles size={13} className="mr-1 inline" /> Amara has capacity for 4 more tickets. Consider rebalancing the queue.</div>
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

function SlaPage({ onAction }: { onAction: (message: string) => void }) {
  const flagged = demoTickets.filter((ticket) => ticket.priority === "Critical" || ticket.priority === "High");
  return <div className="grid gap-5 xl:grid-cols-[1.5fr_0.8fr]"><Panel title="Approaching deadlines" subtitle="Prioritized by breach likelihood · sample signals only"><div className="space-y-3">{flagged.slice(0, 4).map((ticket, index) => <div key={ticket.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-4"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${index === 0 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}><Clock3 size={17} /></div><div className="min-w-[150px] flex-1"><p className="text-xs font-bold text-slate-800">{ticket.id} · {ticket.subject}</p><p className="mt-1 text-[10px] text-slate-500">{ticket.agent} · {ticket.updated} update</p></div><div className="text-right"><p className={`font-mono text-xs font-bold ${index === 0 ? "text-rose-600" : "text-amber-600"}`}>{ticket.sla}</p><p className="mt-1 text-[9px] font-bold uppercase text-slate-400">{index === 0 ? "Critical risk" : index === 1 ? "High risk" : "Medium risk"}</p></div><button onClick={() => onAction(`Recommended action opened for ${ticket.id}.`)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-600">Review</button></div>)}</div></Panel><div className="space-y-5"><RiskCard /><Panel title="Risk model signals" subtitle="Factors considered in this demo"><ul className="space-y-3 text-[11px] text-slate-600"><li className="flex justify-between"><span>Time remaining</span><b>45%</b></li><li className="flex justify-between"><span>Ticket priority</span><b>25%</b></li><li className="flex justify-between"><span>Agent workload</span><b>20%</b></li><li className="flex justify-between"><span>Historical duration</span><b>10%</b></li></ul><p className="mt-4 border-t border-slate-100 pt-3 text-[9px] leading-relaxed text-slate-400">Illustrative weighting only. The frontend demo does not make live predictions.</p></Panel></div></div>;
}

function RescuePage({ onAction }: { onAction: (message: string) => void }) {
  return <><div className="grid gap-4 md:grid-cols-3"><StatCard label="Critical risk" value="2" caption="Immediate intervention" icon={ShieldAlert} tone="rose" /><StatCard label="Approaching SLA" value="7" caption="Within the next 2 hours" icon={Clock3} tone="amber" /><StatCard label="Protected today" value="18" change="+4" icon={ShieldCheck} tone="teal" /></div><Panel title="Rescue queue" subtitle="Recommended interventions from sample data"><div className="space-y-3">{demoTickets.slice(0, 4).map((ticket, i) => <div key={ticket.id} className="grid gap-3 rounded-xl border border-slate-100 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-800">{ticket.id}</span><PriorityBadge priority={ticket.priority} /></div><p className="mt-1 text-[11px] text-slate-500">{ticket.subject}</p><p className="mt-1 text-[10px] text-slate-400">Suggested: {i === 0 ? "Reassign to a fleet specialist" : i === 1 ? "Send a customer progress update" : "Escalate to domain lead"}</p></div><div><p className="font-mono text-xs font-bold text-rose-600">{ticket.sla}</p><p className="mt-1 text-[9px] text-slate-400">remaining</p></div><button onClick={() => onAction(`Rescue action recorded for ${ticket.id} in this demo.`)} className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-blue-700">Take action</button></div>)}</div></Panel></>;
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

function Notifications({ onAction }: { onAction: (message: string) => void }) {
  const [items, setItems] = useState([
    { title: "Your ticket is now in progress", text: "Maya Chen is investigating SVX-2841.", time: "4 min ago", unread: true, icon: Activity },
    { title: "New response on your ticket", text: "There’s an update on SVX-2839.", time: "1 hour ago", unread: true, icon: MessageSquareText },
    { title: "Ticket resolved", text: "SVX-2828 was marked as resolved.", time: "Yesterday", unread: false, icon: CheckCircle2 },
  ]);
  return <div className="surface-card"><div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><h2 className="text-[15px] font-bold text-slate-900">Your updates</h2><p className="mt-1 text-xs text-slate-500">{items.filter((item) => item.unread).length} unread notifications</p></div><button onClick={() => setItems(items.map((item) => ({ ...item, unread: false })))} className="text-[10px] font-semibold text-blue-600">Mark all as read</button></div><NotificationPanel title="Latest notifications" description="Sample updates from your SOLVEX workspace."><div className="divide-y divide-slate-100">{items.map((item, index) => <div key={item.title} className={`flex items-start gap-3 py-4 ${item.unread ? "" : "opacity-70"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><item.icon size={16} /></span><div className="flex-1"><p className="text-xs font-bold text-slate-800">{item.title} {item.unread && <i className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-600" />}</p><p className="mt-1 text-[11px] text-slate-500">{item.text}</p><p className="mt-1.5 text-[9px] text-slate-400">{item.time}</p></div><button onClick={() => { setItems(items.map((entry, i) => i === index ? { ...entry, unread: false } : entry)); onAction("Notification marked as read."); }} className="text-[9px] font-semibold text-slate-400 hover:text-blue-600">{item.unread ? "Mark read" : "Read"}</button></div>)}</div></NotificationPanel></div>;
}

function Profile({ role, onAction }: { role: Role; onAction: (message: string) => void }) {
  return <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]"><Panel title="Personal information" subtitle="This profile is local sample data."><form onSubmit={(event) => { event.preventDefault(); onAction("Profile changes saved in this demo."); }} className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input className={inputClass} defaultValue={role === "customer" ? "Aarav Mehta" : role === "agent" ? "Maya Chen" : "Olivia Bennett"} /></Field><Field label="Email address"><input type="email" className={inputClass} defaultValue="hello@solvex.demo" /></Field><Field label="Time zone"><select className={inputClass}><option>Asia / Kolkata (UTC +05:30)</option><option>America / New York</option><option>Europe / London</option></select></Field><Field label="Language"><select className={inputClass}><option>English</option><option>Hindi</option></select></Field><div className="sm:col-span-2"><button className="rounded-lg bg-blue-600 px-4 py-2.5 text-[11px] font-semibold text-white hover:bg-blue-700">Save profile</button></div></form></Panel><Panel title="Preferences" subtitle="Personalize how SOLVEX keeps you informed."><div className="space-y-4">{["Email me about ticket updates", "Send me SLA milestone reminders", "Weekly support summary"].map((label, index) => <label key={label} className="flex items-center justify-between gap-3 text-[11px] text-slate-600">{label}<input type="checkbox" defaultChecked={index < 2} className="h-4 w-4 accent-blue-600" /></label>)}</div><button onClick={() => onAction("Notification preferences updated in the demo.")} className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Update preferences</button></Panel></div>;
}

function PeopleTable({ kind }: { kind: "customer" | "agent" }) {
  const isAgent = kind === "agent";
  const rows = isAgent ? agents.map((agent) => [agent.name, `${agent.active} active tickets`, `${agent.urgent} urgent`, `${agent.capacity}% capacity`, agent.capacity > 85 ? "At capacity" : "Available"]) : [["Aarav Mehta", "12 tickets", "Logistics", "Today, 9:18 AM", "Active"], ["Riya Kapoor", "8 tickets", "Health", "Today, 8:42 AM", "Active"], ["Northstar Logistics", "26 tickets", "Fleet tracking", "Yesterday", "Active"], ["Sofia Alvarez", "5 tickets", "Smart operations", "Yesterday", "Active"]];
  return <Panel title={isAgent ? "Support team" : "Customer accounts"} subtitle="Sample directory records"><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left"><thead><tr className="border-y border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">{(isAgent ? ["Agent", "Workload", "Urgent", "Capacity", "Status"] : ["Customer", "Tickets", "Domain", "Last active", "Status"]).map((label) => <th className="px-3 py-3 font-bold" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]} className="border-b border-slate-50 text-[11px]"><td className="px-3 py-4 font-semibold text-slate-800">{row[0]}</td>{row.slice(1).map((value, i) => <td className="px-3 py-4 text-slate-600" key={i}>{i === row.length - 2 ? <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${value === "At capacity" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{value}</span> : value}</td>)}</tr>)}</tbody></table></div></Panel>;
}

function Assignments({ onAction }: { onAction: (message: string) => void }) {
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  return <div className="grid gap-5 xl:grid-cols-[1.3fr_0.8fr]"><Panel title="Assignment recommendations" subtitle="Suggested from sample workload and skill data"><div className="space-y-3">{demoTickets.filter((ticket) => ticket.agent === "Unassigned").map((ticket) => <div key={ticket.id} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold text-slate-800">{ticket.id} · {ticket.subject}</p><p className="mt-1 text-[10px] text-slate-500">{ticket.category} · {ticket.priority} priority</p></div><select aria-label={`Assign ${ticket.id}`} value={assigned[ticket.id] ?? ""} onChange={(event) => setAssigned({ ...assigned, [ticket.id]: event.target.value })} className="h-9 rounded-lg border border-slate-200 px-2 text-[10px]"><option value="">Choose agent</option>{agents.map((agent) => <option key={agent.name}>{agent.name}</option>)}</select></div><div className="mt-3 flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2 text-[10px] text-teal-800"><span><Sparkles size={12} className="mr-1 inline" />Recommended: Amara Okafor · balanced load</span><span>46% capacity</span></div><button disabled={!assigned[ticket.id]} onClick={() => onAction(`${ticket.id} assigned to ${assigned[ticket.id]}.`)} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">Assign ticket</button></div>)}</div></Panel><FairnessPanel /></div>;
}

function Analytics() {
  return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="SLA compliance" value="96.8%" change="+2.1%" icon={ShieldCheck} tone="teal" /><StatCard label="SLA breaches" value="80" caption="−12% from last month" icon={ShieldAlert} tone="rose" /><StatCard label="Avg. resolution" value="4h 18m" change="−18 min" icon={Clock3} tone="blue" /><StatCard label="Customer satisfaction" value="4.8 / 5" change="+0.3" icon={HeartPulse} tone="violet" /></div><div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]"><Panel title="Support volume" subtitle="Tickets opened and resolved · last 7 days" action={<span className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] text-slate-500">Last 7 days</span>}><VolumeChart type="bar" /></Panel><Panel title="Category distribution" subtitle="Requests by support domain"><CategoryChart /></Panel></div><div className="grid gap-5 xl:grid-cols-2"><Panel title="SLA compliance trend" subtitle="Weekly attainment in percent"><div className="space-y-3">{[["Week 1", 91], ["Week 2", 94], ["Week 3", 93], ["Week 4", 97]].map(([label, num]) => <div key={label}><div className="mb-1 flex justify-between text-[10px]"><span className="text-slate-600">{label}</span><b>{num}%</b></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500" style={{ width: `${num}%` }} /></div></div>)}</div></Panel><FairnessPanel /></div></>;
}

function SlaConfig({ onAction }: { onAction: (message: string) => void }) {
  return <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]"><Panel title="Response targets by priority" subtitle="Illustrative policies for the frontend demonstration"><div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left"><thead><tr className="border-y border-slate-100 text-[10px] uppercase text-slate-400"><th className="px-3 py-3">Priority</th><th className="px-3 py-3">First response</th><th className="px-3 py-3">Resolution target</th><th className="px-3 py-3">Enabled</th></tr></thead><tbody>{[["Critical", "15 minutes", "4 hours"], ["High", "1 hour", "8 hours"], ["Medium", "4 hours", "2 business days"], ["Low", "1 business day", "5 business days"]].map((row) => <tr key={row[0]} className="border-b border-slate-50 text-xs"><td className="px-3 py-4"><PriorityBadge priority={row[0]} /></td><td className="px-3 py-4 text-slate-600">{row[1]}</td><td className="px-3 py-4 text-slate-600">{row[2]}</td><td className="px-3 py-4"><input type="checkbox" defaultChecked className="h-4 w-4 accent-blue-600" /></td></tr>)}</tbody></table></div><button onClick={() => onAction("SLA policy settings saved in this demo.")} className="mt-5 rounded-lg bg-blue-600 px-4 py-2.5 text-[10px] font-semibold text-white hover:bg-blue-700">Save policy</button></Panel><Panel title="Operating domain overrides" subtitle="Domain-specific first response targets"><div className="space-y-4">{["Health / Telehealth", "Logistics / Fleet tracking", "Smart Operations"].map((domain, i) => <label key={domain} className="block text-[10px] font-semibold text-slate-600">{domain}<select defaultValue={i === 0 ? "Priority-based default" : "Priority-based default"} className={inputClass}><option>Priority-based default</option><option>Enhanced · 30 min response</option><option>Business hours only</option></select></label>)}</div></Panel></div>;
}

function Settings({ onAction }: { onAction: (message: string) => void }) {
  return <div className="grid gap-5 xl:grid-cols-2"><Panel title="Workspace identity" subtitle="Branding for the organization workspace"><div className="space-y-4"><Field label="Organization name"><input defaultValue="Northstar Operations" className={inputClass} /></Field><Field label="Default domain"><select className={inputClass}><option>Logistics / Fleet tracking</option><option>Health / Telehealth</option><option>Smart Operations</option></select></Field><Field label="Support email"><input type="email" defaultValue="support@example.com" className={inputClass} /></Field><button onClick={() => onAction("Workspace identity saved in the demo.")} className="rounded-lg bg-blue-600 px-4 py-2.5 text-[10px] font-semibold text-white">Save workspace</button></div></Panel><Panel title="Platform preferences" subtitle="Workspace-wide notification and safety defaults"><div className="space-y-4">{["Enable customer email notifications", "Enable agent SLA alerts", "Require confirmation before reassignment", "Show customer satisfaction prompts"].map((label, i) => <label key={label} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 text-[11px] text-slate-600">{label}<input type="checkbox" defaultChecked={i !== 2} className="h-4 w-4 accent-blue-600" /></label>)}</div><button onClick={() => onAction("Platform preferences saved in the demo.")} className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600">Save preferences</button></Panel></div>;
}

