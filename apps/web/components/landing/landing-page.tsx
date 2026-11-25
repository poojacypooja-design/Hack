"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CirclePlay,
  Clock3,
  Dna,
  HeartPulse,
  Menu,
  MoveUpRight,
  ShieldCheck,
  Sparkles,
  Truck,
  X,
  Zap,
} from "lucide-react";

const roles = [
  { title: "Customer portal", text: "A calm, clear view of every request and what happens next.", icon: HeartPulse, color: "bg-blue-50 text-blue-600", href: "/customer" },
  { title: "Agent workspace", text: "A focused inbox with the context and signals agents need.", icon: Zap, color: "bg-violet-50 text-violet-600", href: "/agent" },
  { title: "Admin control center", text: "A live operational picture to guide smarter decisions.", icon: ShieldCheck, color: "bg-teal-50 text-teal-600", href: "/admin" },
];

const features = [
  { number: "01", title: "SLA Rescue Radar", eyebrow: "Predict · Protect", text: "See the deadlines that need attention before they become breaches. Get clear risk signals and recommended next steps.", icon: Clock3, color: "from-rose-50 to-orange-50", tint: "text-rose-600" },
  { number: "02", title: "Issue DNA", eyebrow: "Connect · Detect", text: "Related complaints are stronger together. Spot shared symptoms, emerging incidents, and the people affected.", icon: Dna, color: "from-violet-50 to-indigo-50", tint: "text-violet-600" },
  { number: "03", title: "Resolution Memory", eyebrow: "Learn · Resolve", text: "Carry forward what worked. Surface proven steps from past resolutions so every agent starts with more context.", icon: Sparkles, color: "from-teal-50 to-cyan-50", tint: "text-teal-700" },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <main className="overflow-hidden bg-white text-[#12243a]">
      <header className="relative z-30 mx-auto flex h-[78px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#172a45] text-white"><Activity size={21} strokeWidth={2.5} /></span>
          <span><span className="block text-[18px] font-extrabold tracking-[0.13em]">SOLVEX</span><span className="-mt-0.5 block text-[8px] font-semibold tracking-[0.18em] text-slate-400">SUPPORT INTELLIGENCE</span></span>
        </Link>
        <nav className="hidden items-center gap-8 lg:flex">
          <a className="text-xs font-semibold text-slate-600 transition hover:text-blue-600" href="#home">Home</a>
          <a className="text-xs font-semibold text-slate-600 transition hover:text-blue-600" href="#features">Features</a>
          <a className="text-xs font-semibold text-slate-600 transition hover:text-blue-600" href="#how-it-works">How it works</a>
          <a className="text-xs font-semibold text-slate-600 transition hover:text-blue-600" href="#about">About</a>
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          <Link href="/login" className="text-xs font-semibold text-slate-700 hover:text-blue-600">Log in</Link>
          <Link href="/register" className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700">Get started <ArrowRight size={14} /></Link>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-700 lg:hidden">{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
        {menuOpen && <nav className="absolute left-4 right-4 top-[68px] flex flex-col gap-1 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl lg:hidden">{[["Home", "#home"], ["Features", "#features"], ["How it works", "#how-it-works"], ["About", "#about"], ["Log in", "/login"], ["Get started", "/register"]].map(([label, href]) => <a key={label} onClick={() => setMenuOpen(false)} href={href} className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">{label}</a>)}</nav>}
      </header>

      <section id="home" className="relative mx-auto grid min-h-[650px] max-w-[1240px] items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-[0.94fr_1.06fr] lg:px-8 lg:pb-24 lg:pt-14">
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/70 px-3 py-1.5 text-[10px] font-bold text-blue-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />A smarter way to support people <ArrowRight size={12} /></div>
          <h1 className="max-w-[620px] text-[44px] font-bold leading-[1.07] tracking-[-0.045em] text-[#12243a] sm:text-[55px] lg:text-[62px]">Support that sees <span className="text-blue-600">what’s next.</span></h1>
          <p className="mt-5 text-[15px] font-semibold text-slate-700">Beyond Tickets. Predicting Problems.</p>
          <p className="mt-4 max-w-[480px] text-[14px] leading-7 text-slate-500">SOLVEX gives every support team a head start — connecting customer requests, protecting service commitments, and turning solved problems into shared knowledge.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3"><Link href="/register" className="inline-flex h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow-lg shadow-blue-200/70 transition hover:-translate-y-0.5 hover:bg-blue-700">Explore SOLVEX <ArrowRight size={15} /></Link><a href="#how-it-works" className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"><CirclePlay size={16} className="text-blue-600" /> See how it works</a></div>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-100 pt-5 text-[10px] font-medium text-slate-500"><span className="flex items-center gap-1.5"><Check size={13} className="text-teal-600" />Earlier SLA intervention</span><span className="flex items-center gap-1.5"><Check size={13} className="text-teal-600" />Connected issue context</span></div>
        </div>
        <HeroDashboard />
        <div className="pointer-events-none absolute -left-44 top-16 h-96 w-96 rounded-full bg-blue-50/70 blur-3xl" />
        <div className="pointer-events-none absolute -right-36 bottom-8 h-80 w-80 rounded-full bg-teal-50/70 blur-3xl" />
      </section>

      <div className="border-y border-slate-100 bg-[#f9fbfe]">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-5 px-5 py-5 lg:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Designed for the support moments that matter</p>
          <div className="flex flex-wrap gap-6 text-[11px] font-semibold text-slate-500 sm:gap-9"><span className="flex items-center gap-2"><HeartPulse size={15} className="text-rose-500" />Health & care</span><span className="flex items-center gap-2"><Truck size={15} className="text-blue-600" />Logistics & fleet</span><span className="flex items-center gap-2"><Activity size={15} className="text-teal-600" />Smart operations</span></div>
        </div>
      </div>

      <section id="about" className="mx-auto max-w-[1240px] px-5 py-24 lg:px-8 lg:py-28">
        <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div><p className="eyebrow">The problem is bigger than the queue</p><h2 className="mt-4 max-w-md text-3xl font-bold leading-tight tracking-[-0.035em] sm:text-[40px]">Tickets tell you what happened. <span className="text-slate-400">The pattern tells you what to do.</span></h2></div>
          <div><p className="max-w-[650px] text-sm leading-7 text-slate-500">When requests pile up, small delays become missed commitments. Similar issues stay hidden in separate threads. Customers wait without context, while overloaded agents repeat work someone has already solved.</p><div className="mt-8 grid gap-3 sm:grid-cols-3">{[["Delayed assignment", "The right person gets the ticket too late."], ["SLA blind spots", "Deadlines surface when there’s no time left."], ["Lost context", "Repeated problems start from zero." ]].map(([title, text]) => <div key={title} className="rounded-xl border border-slate-100 bg-[#fafbfd] p-4"><span className="mb-3 block h-1 w-7 rounded-full bg-gradient-to-r from-blue-500 to-teal-400" /><p className="text-xs font-bold text-slate-800">{title}</p><p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{text}</p></div>)}</div></div>
        </div>
      </section>

      <section id="features" className="bg-[#f7f9fc] py-24 lg:py-28">
        <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow">A step ahead, by design</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-[40px]">Support intelligence, <span className="text-slate-400">built in.</span></h2></div><p className="max-w-sm text-xs leading-6 text-slate-500">More than ticket tracking. SOLVEX helps your team understand urgency, uncover patterns, and carry knowledge forward.</p></div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">{features.map((feature) => <article key={feature.title} className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60"><div className={`mb-7 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${feature.color} ${feature.tint}`}><feature.icon size={22} /></div><p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">{feature.eyebrow}</p><h3 className="mt-2 text-lg font-bold text-slate-900">{feature.title}</h3><p className="mt-3 text-xs leading-6 text-slate-500">{feature.text}</p><a href="#how-it-works" className="mt-6 inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-600">Explore feature <ArrowRight size={13} className="transition group-hover:translate-x-1" /></a><span className="absolute right-5 top-5 text-[10px] font-bold tracking-widest text-slate-200">{feature.number}</span></article>)}</div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-24 lg:px-8 lg:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <div><p className="eyebrow">SLA Rescue Radar</p><h2 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.04em] sm:text-[40px]">A deadline isn’t a surprise if you see it coming.</h2><p className="mt-4 max-w-md text-sm leading-7 text-slate-500">Prioritize by risk, not by who shouts loudest. Surface approaching deadlines, understand what’s driving the risk, and see an action your team can take now.</p><ul className="mt-6 space-y-3 text-xs text-slate-600">{["A clear countdown for every critical commitment", "Risk signals that factor in urgency and workload", "Recommended next steps your team can act on"].map((item) => <li key={item} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-teal-50 text-teal-600"><Check size={12} /></span>{item}</li>)}</ul><Link href="/agent/sla" className="mt-7 inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800">Explore the Rescue Radar <ArrowRight size={14} /></Link></div>
          <div className="rounded-[26px] border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/50 p-4 sm:p-7"><RadarPreview /></div>
        </div>
      </section>

      <section id="how-it-works" className="bg-[#111f35] py-24 text-white lg:py-28">
        <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
          <div className="max-w-xl"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300">One connected journey</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-[40px]">From first signal to lasting resolution.</h2><p className="mt-4 text-sm leading-7 text-slate-400">Everyone sees the context they need — customers get clarity, agents get focus, and leaders get a better view of what’s ahead.</p></div>
          <div className="relative mt-14 grid gap-8 md:grid-cols-4">{[["01", "Listen", "Capture the customer’s issue and what they’ve already tried."], ["02", "Connect", "Link similar cases and route requests to the right team."], ["03", "Protect", "Watch commitments and surface risk while there’s still time."], ["04", "Learn", "Reuse resolutions and improve every next response."]].map(([num, title, text], index) => <div key={num} className="relative"><span className={`mb-5 grid h-11 w-11 place-items-center rounded-xl border text-xs font-bold ${index === 0 ? "border-teal-300/40 bg-teal-300/10 text-teal-200" : "border-white/10 bg-white/5 text-slate-300"}`}>{num}</span><h3 className="text-sm font-bold">{title}</h3><p className="mt-2 max-w-[230px] text-xs leading-6 text-slate-400">{text}</p>{index < 3 && <ArrowRight className="absolute right-0 top-4 hidden text-slate-600 md:block" size={18} />}</div>)}</div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-24 lg:px-8 lg:py-28">
        <div className="text-center"><p className="eyebrow">Three perspectives. One better outcome.</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-[40px]">Every role, thoughtfully supported.</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">One connected support experience that keeps customers, agents, and administrators moving together.</p></div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">{roles.map((role) => <Link href={role.href} key={role.title} className="group rounded-2xl border border-slate-200 p-6 transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/50"><span className={`grid h-11 w-11 place-items-center rounded-xl ${role.color}`}><role.icon size={21} /></span><h3 className="mt-5 text-sm font-bold">{role.title}</h3><p className="mt-2 min-h-[42px] text-xs leading-5 text-slate-500">{role.text}</p><span className="mt-5 inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-600">Explore workspace <MoveUpRight size={13} className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span></Link>)}</div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 pb-24 lg:px-8">
        <div className="relative overflow-hidden rounded-[26px] bg-[#edf6f5] px-6 py-12 sm:px-12 lg:px-16"><div className="relative z-10 max-w-2xl"><p className="eyebrow">Your domain. Your language.</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-[38px]">Flexible enough for the work you do.</h2><p className="mt-3 max-w-xl text-xs leading-6 text-slate-600">Choose Health / Telehealth, Logistics / Fleet Tracking, or Smart Operations. Domain modes shape ticket categories and the context teams collect.</p><div className="mt-6 flex flex-wrap gap-2">{["Health / Telehealth", "Logistics / Fleet Tracking", "Smart Operations"].map((domain) => <span key={domain} className="rounded-full border border-white bg-white/80 px-3 py-2 text-[10px] font-semibold text-slate-700 shadow-sm">{domain}</span>)}</div></div><div className="pointer-events-none absolute -right-10 -top-20 h-72 w-72 rounded-full border-[34px] border-teal-100/80" /><div className="pointer-events-none absolute -bottom-40 right-32 h-72 w-72 rounded-full border-[32px] border-white/80" /></div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 pb-20 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-7 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-teal-50/70 p-8 text-center sm:flex-row sm:p-10 sm:text-left"><div><p className="eyebrow">Ready to see what’s next?</p><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Give your support team a head start.</h2><p className="mt-2 text-xs text-slate-500">Explore the SOLVEX demo workspaces.</p></div><Link href="/register" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700">Get started <ArrowRight size={14} /></Link></div>
      </section>

      <footer className="border-t border-slate-100 bg-[#fafbfd]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-7 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8"><Link href="/" className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#172a45] text-white"><Activity size={16} /></span><span className="text-sm font-extrabold tracking-[0.13em]">SOLVEX</span></Link><p className="text-[10px] text-slate-500">Built with purpose by <b className="text-slate-700">Hackhive</b> · <b className="text-slate-700">AVISHKAR&apos;26</b></p><div className="flex gap-4 text-[10px] text-slate-500"><Link href="/login" className="hover:text-blue-600">Log in</Link><Link href="/admin/login" className="hover:text-blue-600">Admin</Link><a href="#home" className="hover:text-blue-600">Back to top ↑</a></div></div>
      </footer>
    </main>
  );
}

function HeroDashboard() {
  return <div className="relative z-10 mx-auto w-full max-w-[620px] lg:ml-auto">
    <div className="absolute -right-4 -top-6 z-20 hidden animate-pulse items-center gap-2 rounded-xl border border-teal-100 bg-white px-3 py-2.5 shadow-lg shadow-slate-200/70 sm:flex"><span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-50 text-teal-700"><ShieldCheck size={15} /></span><span><span className="block text-[9px] font-bold text-slate-800">SLA protected</span><span className="block text-[8px] text-slate-400">24 deadlines in safe range</span></span><Check size={13} className="text-teal-600" /></div>
    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-2xl shadow-slate-300/50">
      <div className="flex h-12 items-center justify-between border-b border-slate-100 px-4 sm:px-5"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-400" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-teal-400" /><span className="ml-2 text-[9px] font-semibold text-slate-400">SOLVEX / operations overview</span></div><span className="rounded-md bg-slate-50 px-2 py-1 text-[8px] font-medium text-slate-400">This week <ChevronDown size={10} className="ml-1 inline" /></span></div>
      <div className="grid grid-cols-3 gap-2.5 p-3.5 sm:gap-3 sm:p-5">{[["Total tickets", "2,486", "+8.4%"], ["SLA compliance", "96.8%", "+2.1%"], ["At risk", "02", "−12%"]].map((item, index) => <div key={item[0]} className="rounded-xl border border-slate-100 p-2.5 sm:p-3"><p className="text-[8px] font-medium text-slate-400 sm:text-[9px]">{item[0]}</p><p className="mt-1 text-base font-bold tracking-tight sm:text-xl">{item[1]}</p><p className={`mt-1 text-[8px] font-semibold ${index === 2 ? "text-emerald-600" : "text-teal-600"}`}><ArrowUpRight size={10} className="mr-0.5 inline" />{item[2]} <span className="font-normal text-slate-400">vs last month</span></p></div>)}</div>
      <div className="grid gap-3 px-3.5 pb-3.5 sm:grid-cols-[1.4fr_0.9fr] sm:px-5 sm:pb-5">
        <div className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between"><div><p className="text-[9px] font-bold text-slate-700">Ticket volume</p><p className="text-[8px] text-slate-400">Opened vs resolved</p></div><span className="text-[8px] text-slate-400">7 days</span></div><MiniGraph /></div>
        <div className="rounded-xl border border-rose-100 bg-gradient-to-br from-white to-rose-50/50 p-3"><div className="flex items-center gap-1.5"><span className="grid h-6 w-6 place-items-center rounded-md bg-rose-100 text-rose-600"><Clock3 size={12} /></span><span className="text-[9px] font-bold">SLA Rescue Radar</span></div><div className="mt-3 rounded-lg bg-white p-2.5 shadow-sm"><div className="flex justify-between"><span className="text-[8px] font-semibold">SVX-2841</span><span className="text-[8px] font-bold text-rose-600">HIGH RISK</span></div><p className="mt-1.5 font-mono text-lg font-bold text-rose-600">00:18:42</p><div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[82%] bg-rose-500" /></div><p className="mt-2 text-[8px] text-slate-400">Suggested: reassign to specialist</p></div><div className="mt-2 flex items-center justify-between text-[8px] text-slate-400"><span>2 tickets at risk</span><span className="font-semibold text-blue-600">Review radar →</span></div></div>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-5"><div className="flex -space-x-1.5">{["MC", "DK", "JL", "AO"].map((initial, i) => <span key={initial} className={`grid h-6 w-6 place-items-center rounded-full border-2 border-white text-[7px] font-bold ${["bg-violet-100 text-violet-700", "bg-sky-100 text-sky-700", "bg-amber-100 text-amber-700", "bg-teal-100 text-teal-700"][i]}`}>{initial}</span>)}</div><span className="text-[8px] text-slate-400">Fair workload. Focused team. Better outcomes.</span><span className="hidden h-2 w-2 rounded-full bg-teal-400 sm:block" /></div>
    </div>
    <div className="absolute -bottom-7 -left-4 z-20 hidden items-center gap-2.5 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-lg shadow-slate-200/70 sm:flex"><span className="grid h-8 w-8 place-items-center rounded-full bg-violet-50 text-violet-600"><Dna size={16} /></span><span><span className="block text-[9px] font-bold text-slate-800">Issue DNA found a pattern</span><span className="block text-[8px] text-slate-400">4 related reports · 92% match</span></span><ArrowUpRight size={13} className="text-blue-600" /></div>
  </div>;
}

function MiniGraph() {
  return <svg viewBox="0 0 310 105" className="mt-2 h-[105px] w-full" aria-label="Sample ticket trend chart" role="img"><defs><linearGradient id="heroBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4968f5" stopOpacity=".22" /><stop offset="1" stopColor="#4968f5" stopOpacity="0" /></linearGradient></defs><path d="M0 80 C20 74 28 51 49 58 S77 75 96 53 S122 41 143 50 S169 23 190 35 S218 57 237 30 S266 44 286 18 S300 27 310 10 V105 H0Z" fill="url(#heroBlue)" /><path d="M0 80 C20 74 28 51 49 58 S77 75 96 53 S122 41 143 50 S169 23 190 35 S218 57 237 30 S266 44 286 18 S300 27 310 10" fill="none" stroke="#4968f5" strokeWidth="2.5" /><path d="M0 88 C20 83 32 70 49 74 S78 83 96 70 S125 69 143 64 S171 48 190 56 S217 70 237 51 S265 64 286 42 S300 51 310 36" fill="none" stroke="#20bba5" strokeWidth="2" /><g fill="#a5afbe" fontSize="7" fontFamily="Arial"><text x="0" y="103">MON</text><text x="48" y="103">TUE</text><text x="96" y="103">WED</text><text x="143" y="103">THU</text><text x="190" y="103">FRI</text><text x="237" y="103">SAT</text><text x="286" y="103">SUN</text></g></svg>;
}

function RadarPreview() {
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-300/40"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5"><div><p className="text-xs font-bold text-slate-800">SLA Rescue Center</p><p className="mt-0.5 text-[9px] text-slate-400">Risk-ranked · Sample workspace signals</p></div><span className="rounded-full bg-rose-50 px-2.5 py-1 text-[8px] font-bold text-rose-600">3 NEED ATTENTION</span></div><div className="divide-y divide-slate-100">{[["SVX-2841", "GPS location not updating", "00:18:42", "CRITICAL", "bg-rose-50 text-rose-700"], ["SVX-2839", "Patient notes access issue", "01:42:08", "HIGH", "bg-orange-50 text-orange-700"], ["SVX-2832", "Temperature alert incorrect", "00:54:19", "MEDIUM", "bg-amber-50 text-amber-700"]].map(([id, title, time, risk, tint]) => <div key={id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 sm:grid-cols-[1fr_auto_auto] sm:px-5"><div><p className="text-[10px] font-bold text-blue-700">{id}</p><p className="mt-1 text-[10px] font-semibold text-slate-800 sm:text-xs">{title}</p><p className="mt-1 text-[9px] text-slate-400">Assigned · Maya Chen</p></div><span className={`hidden rounded-full px-2 py-1 text-[8px] font-bold sm:block ${tint}`}>{risk}</span><div className="text-right"><p className="font-mono text-xs font-bold text-slate-800">{time}</p><p className="mt-1 text-[8px] text-slate-400">to breach</p></div></div>)}</div><div className="flex items-center justify-between bg-slate-50 px-4 py-3 text-[9px] sm:px-5"><span className="text-slate-500"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />High risk detected · 2 min ago</span><Link href="/agent/sla" className="font-bold text-blue-600">Open radar <ArrowRight size={11} className="ml-1 inline" /></Link></div></div>;
}
