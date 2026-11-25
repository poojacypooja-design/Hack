export type Ticket = {
  id: string;
  subject: string;
  customer: string;
  category: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  status: "Open" | "In progress" | "Waiting" | "Resolved" | "Closed";
  agent: string;
  updated: string;
  sla: string;
  ticketCode?: string;
};

export const demoTickets: Ticket[] = [
  { id: "SVX-2841", subject: "Live location is not updating", customer: "Aarav Mehta", category: "Fleet tracking", priority: "Critical", status: "In progress", agent: "Maya Chen", updated: "4 min ago", sla: "00:18:42" },
  { id: "SVX-2816", subject: "Route history is missing for yesterday", customer: "Aarav Mehta", category: "Fleet tracking", priority: "Medium", status: "Resolved", agent: "Amara Okafor", updated: "2 days ago", sla: "Met" },
  { id: "SVX-2839", subject: "Unable to access consultation notes", customer: "Riya Kapoor", category: "Telehealth", priority: "High", status: "Open", agent: "Unassigned", updated: "12 min ago", sla: "01:42:08" },
  { id: "SVX-2836", subject: "Invoice shows duplicate shipment fee", customer: "Northstar Logistics", category: "Billing", priority: "Medium", status: "Waiting", agent: "Daniel Kim", updated: "28 min ago", sla: "05:16:31" },
  { id: "SVX-2832", subject: "Temperature alert triggered incorrectly", customer: "Priya Nair", category: "Smart operations", priority: "High", status: "In progress", agent: "Jordan Lee", updated: "42 min ago", sla: "00:54:19" },
  { id: "SVX-2828", subject: "Reset password link has expired", customer: "Milo Carter", category: "Account access", priority: "Low", status: "Resolved", agent: "Maya Chen", updated: "1 hr ago", sla: "Met" },
  { id: "SVX-2824", subject: "Driver app crashes at sign in", customer: "Sofia Alvarez", category: "Mobile app", priority: "High", status: "Open", agent: "Unassigned", updated: "1 hr ago", sla: "02:08:55" },
];

export const weeklyVolume = [
  { day: "Mon", opened: 42, resolved: 36 },
  { day: "Tue", opened: 56, resolved: 48 },
  { day: "Wed", opened: 48, resolved: 43 },
  { day: "Thu", opened: 71, resolved: 59 },
  { day: "Fri", opened: 63, resolved: 54 },
  { day: "Sat", opened: 38, resolved: 34 },
  { day: "Sun", opened: 45, resolved: 40 },
];

export const categoryMix = [
  { name: "Fleet tracking", value: 34, color: "#4968f5" },
  { name: "Telehealth", value: 26, color: "#20bba5" },
  { name: "Billing", value: 19, color: "#8f78ec" },
  { name: "Smart ops", value: 14, color: "#f2ae57" },
  { name: "Other", value: 7, color: "#d8dfe9" },
];

export const agents = [
  { name: "Maya Chen", initials: "MC", active: 12, urgent: 2, capacity: 72, color: "bg-violet-100 text-violet-700" },
  { name: "Daniel Kim", initials: "DK", active: 9, urgent: 1, capacity: 58, color: "bg-sky-100 text-sky-700" },
  { name: "Jordan Lee", initials: "JL", active: 15, urgent: 4, capacity: 91, color: "bg-amber-100 text-amber-700" },
  { name: "Amara Okafor", initials: "AO", active: 7, urgent: 0, capacity: 46, color: "bg-teal-100 text-teal-700" },
];

export const categoriesByDomain = {
  Health: ["Appointments", "Telehealth", "Prescription", "Patient records", "Billing"],
  Logistics: ["Fleet tracking", "Delivery status", "Driver app", "Route planning", "Billing"],
  "Smart Operations": ["Device connectivity", "Sensor alert", "Automation", "Data sync", "Access"],
};

export const navGroups = {
  customer: [
    { label: "Overview", href: "/customer", icon: "LayoutDashboard" },
    { label: "My tickets", href: "/customer/tickets", icon: "Ticket" },
    { label: "Ticket journey", href: "/customer/journey", icon: "GitBranch" },
    { label: "Create a ticket", href: "/customer/create", icon: "CirclePlus" },
    { label: "Notifications", href: "/customer/notifications", icon: "Bell" },
    { label: "My profile", href: "/customer/profile", icon: "UserRound" },
  ],
  agent: [
    { label: "Overview", href: "/agent", icon: "LayoutDashboard" },
    { label: "Inbox", href: "/agent/inbox", icon: "Inbox" },
    { label: "Assigned tickets", href: "/agent/assigned", icon: "TicketCheck" },
    { label: "SLA Rescue Radar", href: "/agent/sla", icon: "Radar" },
    { label: "Issue DNA", href: "/agent/issue-dna", icon: "Dna" },
    { label: "Resolution memory", href: "/agent/resolution-memory", icon: "BookOpenCheck" },
    { label: "My profile", href: "/agent/profile", icon: "UserRound" },
  ],
  admin: [
    { label: "Overview", href: "/admin", icon: "LayoutDashboard" },
    { label: "All tickets", href: "/admin/tickets", icon: "Ticket" },
    { label: "Customers", href: "/admin/customers", icon: "UsersRound" },
    { label: "Agents", href: "/admin/agents", icon: "Headset" },
    { label: "Assignments", href: "/admin/assignments", icon: "GitBranch" },
    { label: "SLA configuration", href: "/admin/sla", icon: "Timer" },
    { label: "SLA Rescue Center", href: "/admin/rescue", icon: "Radar" },
    { label: "Issue DNA", href: "/admin/issue-dna", icon: "Dna" },
    { label: "Analytics", href: "/admin/analytics", icon: "ChartNoAxesCombined" },
    { label: "Settings", href: "/admin/settings", icon: "Settings2" },
  ],
} as const;
