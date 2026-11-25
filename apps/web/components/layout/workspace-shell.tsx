"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  BookOpenCheck,
  ChartNoAxesCombined,
  CirclePlus,
  Dna,
  GitBranch,
  Headset,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Radar,
  Search,
  Settings2,
  ShieldCheck,
  Ticket,
  TicketCheck,
  Timer,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { navGroups } from "@/lib/mock-data";
import { apiRequest, errorMessage, roleHome, type ApiRole } from "@/lib/api";
import { useSession } from "@/lib/use-session";

type Role = "customer" | "agent" | "admin";

const iconMap = {
  LayoutDashboard,
  Ticket,
  CirclePlus,
  Bell,
  UserRound,
  Inbox,
  TicketCheck,
  Radar,
  Dna,
  BookOpenCheck,
  UsersRound,
  Headset,
  GitBranch,
  Timer,
  ChartNoAxesCombined,
  Settings2,
} as const;

const roleCopy = {
  customer: { label: "Customer portal", person: "Aarav Mehta", initials: "AM", tint: "bg-blue-100 text-blue-700" },
  agent: { label: "Agent workspace", person: "Maya Chen", initials: "MC", tint: "bg-violet-100 text-violet-700" },
  admin: { label: "Admin control center", person: "Olivia Bennett", initials: "OB", tint: "bg-teal-100 text-teal-700" },
};

export function WorkspaceShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const { user, loading, error, refresh } = useSession();
  const copy = roleCopy[role];
  const nav = navGroups[role];
  const requiredRole: ApiRole = role === "customer" ? "CUSTOMER" : role === "agent" ? "AGENT" : "ADMIN";

  useEffect(() => {
    if (loading || error) return;
    if (!user) {
      router.replace("/login");
    } else if (user.role !== requiredRole) {
      router.replace(roleHome(user.role));
    }
  }, [error, loading, requiredRole, router, user]);

  async function logout() {
    setLogoutError("");
    try {
      await apiRequest<{ message: string }>("/auth/logout", { method: "POST" });
      router.replace("/login");
    } catch (requestError) {
      setLogoutError(errorMessage(requestError));
    }
  }

  if (loading || (!user && !error) || (user && user.role !== requiredRole)) {
    return <div className="grid min-h-screen place-items-center bg-[#f5f7fb] text-sm text-slate-500">Checking your secure session…</div>;
  }

  if (error) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f7fb] p-5"><div className="max-w-md rounded-xl border border-rose-100 bg-white p-6 text-center shadow-sm"><p role="alert" className="text-sm font-semibold text-rose-700">Could not verify your session.</p><p className="mt-2 text-xs text-slate-500">{error}</p><button onClick={() => void refresh()} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">Retry</button></div></main>;
  }

  const initials = user?.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || copy.initials;

  return (
    <div className="min-h-screen bg-[#f5f7fb] lg:flex">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col bg-[#101f35] text-white transition-transform duration-200 lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-900/30"><Activity size={19} strokeWidth={2.5} /></span>
            <span><span className="block text-[17px] font-extrabold tracking-[0.12em]">SOLVEX</span><span className="block text-[9px] tracking-wide text-slate-400">BEYOND TICKETS</span></span>
          </Link>
          <button onClick={() => setMobileMenu(false)} className="lg:hidden" aria-label="Close navigation"><X size={20} /></button>
        </div>
        <div className="px-4 pt-5">
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.07] px-3 py-2.5">
            {role === "admin" ? <ShieldCheck size={15} className="text-teal-300" /> : <LifeBuoy size={15} className="text-blue-300" />}
            <span className="text-[11px] font-semibold text-slate-200">{copy.label}</span>
          </div>
        </div>
        <nav className="workspace-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.17em] text-slate-500">Workspace</p>
          {nav.map((item) => {
            const Icon = iconMap[item.icon];
            const active = pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileMenu(false)} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] transition ${active ? "bg-blue-600 text-white shadow-md shadow-blue-950/30" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"}`}>
                <Icon size={16} strokeWidth={active ? 2.2 : 1.8} /><span className="flex-1">{item.label}</span>
                {item.label === "SLA Rescue Radar" && role === "agent" && <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />}
                {item.label === "SLA Rescue Center" && role === "admin" && <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[8px] font-bold">3</span>}
              </Link>
            );
          })}
          <p className="px-3 pb-2 pt-6 text-[9px] font-bold uppercase tracking-[0.17em] text-slate-500">Discover</p>
          <Link href="/#features" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] text-slate-400 transition hover:bg-white/[0.06] hover:text-white"><Dna size={16} /><span>Product features</span></Link>
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.06] p-3">
            <span className={`grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold ${copy.tint}`}>{initials}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold">{user?.fullName}</p><p className="mt-0.5 truncate text-[9px] text-slate-400">{user?.email}</p></div>
            <button type="button" onClick={() => void logout()} title="Sign out" aria-label="Sign out" className="text-slate-400 hover:text-white"><LogOut size={15} /></button>
          </div>
          {logoutError && <p role="alert" className="mt-2 text-[9px] text-rose-300">{logoutError}</p>}
          <p className="mt-4 text-center text-[9px] text-slate-500">SOLVEX demo workspace · Hackhive</p>
        </div>
      </aside>
      {mobileMenu && <button aria-label="Close navigation overlay" onClick={() => setMobileMenu(false)} className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" />}
      <div className="min-w-0 flex-1 lg:ml-[250px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileMenu(true)} aria-label="Open navigation" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><Menu size={19} /></button>
            <div className="hidden items-center gap-2 text-[11px] text-slate-400 sm:flex"><span>Workspace</span><span>/</span><span className="font-semibold capitalize text-slate-700">{pathname.split("/").filter(Boolean).join(" / ") || "Overview"}</span></div>
            <div className="sm:hidden"><p className="text-sm font-bold text-slate-800">SOLVEX</p><p className="text-[9px] capitalize text-slate-400">{role} workspace</p></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <label className="relative hidden md:block"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input placeholder="Search anything…" className="h-9 w-[205px] rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[11px] outline-none focus:border-blue-300 focus:bg-white" /></label>
            <Link href={`/${role}/notifications`} aria-label="Notifications" className="relative grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"><Bell size={16} /><span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-white" /></Link>
            <div className="hidden h-8 w-px bg-slate-200 sm:block" />
            <span className={`grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold ${copy.tint}`}>{initials}</span>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
