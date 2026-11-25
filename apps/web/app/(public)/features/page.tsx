import Link from "next/link";

export default function FeaturesPage() {
  return <main className="mx-auto max-w-3xl px-6 py-24"><p className="eyebrow">SOLVEX features</p><h1 className="mt-4 text-4xl font-bold tracking-tight">Support intelligence, built in.</h1><ul className="mt-7 space-y-4 text-sm leading-7 text-slate-600"><li><b>SLA Rescue Radar</b> prioritizes upcoming deadlines and makes risk visible.</li><li><b>Issue DNA</b> connects similar complaints to reveal possible shared incidents.</li><li><b>Resolution Memory</b> surfaces previous solutions to avoid repeating work.</li><li><b>Agent Fairness Meter</b> brings workload balance into assignment decisions.</li><li><b>No-Silence Promise</b> calls attention to requests that need a customer update.</li></ul><Link className="mt-7 inline-flex text-sm font-semibold text-blue-600" href="/">Back to SOLVEX →</Link></main>;
}
