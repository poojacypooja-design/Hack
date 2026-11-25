"use client";

import { useEffect, type InputHTMLAttributes, type ReactNode } from "react";
import { Search, X } from "lucide-react";

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
      <section role="dialog" aria-modal="true" aria-labelledby="modal-heading" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4"><h2 id="modal-heading" className="text-sm font-bold text-slate-900">{title}</h2><button aria-label="Close dialog" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={17} /></button></div>
        {children}
      </section>
    </div>
  );
}

export function FormInput({
  label,
  error,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return <label className="block text-[10px] font-semibold text-slate-700">{label}<input {...props} aria-invalid={Boolean(error)} className={`mt-1.5 h-11 w-full rounded-lg border bg-white px-3 text-xs outline-none transition placeholder:text-slate-400 focus:ring-2 ${error ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : "border-slate-200 focus:border-blue-400 focus:ring-blue-100"} ${className}`} />{error && <span role="alert" className="mt-1 block text-[10px] font-medium text-rose-600">{error}</span>}</label>;
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <span role="status" className="inline-flex items-center gap-2 text-xs font-medium text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />{label}</span>;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
  ariaLabel = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return <label className="relative min-w-[180px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>;
}

export function FilterPanel({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function NotificationPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return <div role="list" aria-label={`${title}: ${description}`}>{children}</div>;
}

export function TicketTimeline({ activeIndex = 3 }: { activeIndex?: number }) {
  const steps = ["Submitted", "Assigned", "Investigating", "In progress", "Resolved", "Feedback"];
  return <div className="space-y-0">{steps.map((step, index) => {
    const complete = index < activeIndex;
    const active = index === activeIndex;
    return <div key={step} className="flex gap-3"><div className="flex w-5 flex-col items-center">{complete ? <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white"><span className="text-[10px]">✓</span></span> : active ? <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-blue-500 bg-white"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /></span> : <span className="h-5 w-5 rounded-full border-2 border-slate-200 bg-white" />}{index < steps.length - 1 && <span className={`my-1 h-5 w-px ${complete ? "bg-emerald-300" : "bg-slate-200"}`} />}</div><div className="flex flex-1 items-center justify-between pb-3"><p className={`text-xs ${complete || active ? "font-semibold text-slate-800" : "text-slate-400"}`}>{step}</p>{active && <span className="text-[9px] font-semibold text-blue-600">In progress</span>}</div></div>;
  })}</div>;
}

export function SLAIndicator({ risk = "CRITICAL", countdown = "00:18:42" }: { risk?: string; countdown?: string }) {
  const color = risk === "CRITICAL" ? "text-rose-600 bg-rose-50" : risk === "HIGH" ? "text-orange-700 bg-orange-50" : risk === "MEDIUM" ? "text-amber-700 bg-amber-50" : "text-teal-700 bg-teal-50";
  return <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2"><span className={`rounded-full px-2 py-1 text-[9px] font-extrabold ${color}`}>{risk}</span><span className="font-mono text-xs font-bold text-slate-800">{countdown}</span></div>;
}

export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return <section className="surface-card"><header className="border-b border-slate-100 px-5 py-4"><h2 className="text-[15px] font-bold text-slate-900">{title}</h2>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</header><div className="p-5">{children}</div></section>;
}
