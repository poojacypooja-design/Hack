"use client";

import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleHelp,
  Clock3,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSlaRisks } from "@/lib/use-sla-risks";

export function StatCard({
  label,
  value,
  change,
  icon: Icon,
  tone = "blue",
  caption,
}: {
  label: string;
  value: string;
  change?: string;
  icon: LucideIcon;
  tone?: "blue" | "teal" | "amber" | "violet" | "rose";
  caption?: string;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    teal: "bg-teal-50 text-teal-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <div className="surface-card min-w-0 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-[27px] font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon size={19} />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs">
        {change && <span className="flex items-center font-semibold text-emerald-600"><ArrowUpRight size={14} />{change}</span>}
        <span className="text-slate-400">{caption ?? "vs. last 30 days"}</span>
      </div>
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-card min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function VolumeChart({ type = "area", data }: { type?: "area" | "bar"; data?: Array<{ day: string; opened: number; resolved: number }> }) {
  if (!data) return <p className="grid h-[235px] place-items-center text-center text-xs text-slate-500">Time-series data is not provided by the current analytics API.</p>;
  return (
    <div className="h-[235px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart data={data} barGap={5}>
            <CartesianGrid vertical={false} stroke="#eef1f6" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#91a0b4", fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#91a0b4", fontSize: 11 }} width={26} />
            <Tooltip />
            <Bar dataKey="opened" fill="#4968f5" radius={[4, 4, 0, 0]} />
            <Bar dataKey="resolved" fill="#21bba5" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <AreaChart data={data}>
            <defs>
              <linearGradient id="openedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4968f5" stopOpacity={0.19} />
                <stop offset="90%" stopColor="#4968f5" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="resolvedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#21bba5" stopOpacity={0.15} />
                <stop offset="90%" stopColor="#21bba5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#eef1f6" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#91a0b4", fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#91a0b4", fontSize: 11 }} width={26} />
            <Tooltip />
            <Area type="monotone" dataKey="opened" stroke="#4968f5" strokeWidth={2.5} fill="url(#openedFill)" />
            <Area type="monotone" dataKey="resolved" stroke="#21bba5" strokeWidth={2.5} fill="url(#resolvedFill)" />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryChart({ data }: { data?: Array<{ name: string; value: number }> }) {
  if (!data?.length) return <p className="grid h-[180px] place-items-center text-center text-xs text-slate-500">No category analytics are available for this period.</p>;
  const colors = ["#4968f5", "#20bba5", "#8f78ec", "#f2ae57", "#d8dfe9"];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const chartData = data.map((item, index) => ({ ...item, color: colors[index % colors.length] }));
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="h-[180px] w-full max-w-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" innerRadius={53} outerRadius={78} paddingAngle={4} stroke="none">
              {chartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full space-y-3">
        {chartData.map((item) => (
          <div className="flex items-center justify-between gap-2 text-xs" key={item.name}>
            <span className="flex items-center gap-2 text-slate-600"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>
            <span className="font-semibold text-slate-800">{total ? Math.round((item.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RiskCard({ compact = false }: { compact?: boolean }) {
  const { risks, loading, error } = useSlaRisks();
  const topRisk = risks[0];
  const countdown = topRisk && topRisk.remainingMs > 0
    ? [Math.floor(topRisk.remainingMs / 3_600_000), Math.floor((topRisk.remainingMs % 3_600_000) / 60_000), Math.floor((topRisk.remainingMs % 60_000) / 1000)]
      .map((part) => String(part).padStart(2, "0")).join(":")
    : "Breached";
  return (
    <div className={`overflow-hidden rounded-2xl border border-rose-100 bg-white ${compact ? "" : "shadow-sm"}`}>
      <div className="flex items-center justify-between bg-gradient-to-r from-[#fff5f4] to-[#fffaf5] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-rose-100 text-rose-600"><Clock3 size={16} /><span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500 ring-2 ring-white" /></span>
          <div><p className="text-xs font-bold text-slate-800">SLA Rescue Radar</p><p className="text-[10px] text-slate-500">Proactive deadline protection</p></div>
        </div>
        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[9px] font-extrabold tracking-wider text-rose-700">{loading ? "LOADING" : `${risks.filter((risk) => risk.level === "HIGH" || risk.level === "CRITICAL").length} AT RISK`}</span>
      </div>
      {error ? <p role="alert" className="p-4 text-xs text-rose-700">{error}</p> : !topRisk ? <p className="p-4 text-xs text-slate-500">{loading ? "Loading API risk data…" : "No active SLA risks were returned."}</p> : <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div><p className="text-xs font-semibold text-slate-800">{topRisk.ticketCode} <span className="font-normal text-slate-500">· {topRisk.subject ?? "Ticket"}</span></p><p className="mt-1 text-[10px] text-slate-500">Deadline {new Date(topRisk.deadline).toLocaleString()}</p></div>
          <div className="text-right"><p className="font-mono text-sm font-bold text-rose-600">{countdown}</p><p className="text-[9px] font-bold text-rose-500">{topRisk.level}</p></div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500" style={{ width: `${topRisk.score}%` }} /></div>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-800">{topRisk.recommendedAction}</p>
      </div>}
    </div>
  );
}

export function MiniLink({ children }: { children: ReactNode }) {
  return <a href="/admin/analytics" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 transition hover:text-blue-800">{children}<ArrowRight size={13} /></a>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center"><div><CircleHelp className="mx-auto mb-3 text-slate-300" size={27} /><p className="text-sm font-semibold text-slate-800">{title}</p><p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">{description}</p></div></div>;
}

export function TrendDown() {
  return <span className="inline-flex items-center text-emerald-600"><ArrowDownRight size={14} /> SLA breaches down 12%</span>;
}
