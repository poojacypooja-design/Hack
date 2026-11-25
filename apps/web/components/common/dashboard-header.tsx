import type { ReactNode } from "react";

export function DashboardHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow mb-2">{eyebrow}</p><h1 className="text-[25px] font-bold tracking-tight text-slate-900 sm:text-[30px]">{title}</h1><p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p></div>{action}</div>;
}
