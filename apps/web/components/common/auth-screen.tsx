"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Activity, ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { FormInput } from "@/components/ui/primitives";
import { apiJson, errorMessage, roleHome, type ApiRole, type ApiUser } from "@/lib/api";

type AuthRole = "customer" | "agent" | "admin";
type AuthMode = "login" | "register";

export function AuthScreen({ role = "customer", mode = "login" }: { role?: AuthRole; mode?: AuthMode }) {
  const router = useRouter();
  const [view, setView] = useState<"form" | "forgot">("form");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const submissionInFlight = useRef(false);
  const title = view === "forgot" ? "Reset your password" : mode === "register" ? "Create your account" : role === "customer" ? "Welcome back" : role === "agent" ? "Agent sign in" : "Admin sign in";
  const workspace = role === "customer" ? "/customer" : `/${role}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current) return;
    setError("");
    setMessage("");
    if (view === "forgot") {
      setMessage("Password reset is not available yet. Contact your SOLVEX administrator.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    submissionInFlight.current = true;
    setLoading(true);
    try {
      const path = mode === "register"
        ? "/auth/register"
        : `/auth/${role === "customer" ? "customer" : role}/login`;
      const input = {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        ...(mode === "register" ? { fullName: String(formData.get("fullName") ?? "") } : {}),
      };
      const result = await apiJson<{ user: ApiUser }>(path, "POST", input);
      const expectedRole: ApiRole = role === "customer" ? "CUSTOMER" : role === "agent" ? "AGENT" : "ADMIN";
      if (result.user.role !== expectedRole) {
        throw new Error("The signed-in account does not have access to this workspace.");
      }
      router.replace(roleHome(result.user.role));
    } catch (requestError) {
      setError(errorMessage(requestError));
      setLoading(false);
      submissionInFlight.current = false;
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#101f35] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute -right-44 top-16 h-[520px] w-[520px] rounded-full border border-white/[0.08]" /><div className="absolute -right-24 top-36 h-[350px] w-[350px] rounded-full border border-teal-300/10" /><div className="absolute -bottom-36 -left-20 h-[400px] w-[400px] rounded-full bg-blue-600/10 blur-3xl" />
        <Link href="/" className="relative z-10 flex w-fit items-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600"><Activity size={20} /></span><span className="text-lg font-extrabold tracking-[0.13em]">SOLVEX</span></Link>
        <div className="relative z-10 max-w-lg"><span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[9px] font-semibold text-slate-300"><ShieldCheck size={12} className="text-teal-300" /> SUPPORT THAT SEES WHAT&apos;S NEXT</span><h1 className="text-4xl font-bold leading-tight tracking-[-0.04em] xl:text-5xl">{role === "admin" ? "Clarity for every corner of support." : "Every issue deserves a better answer."}</h1><p className="mt-5 max-w-md text-sm leading-7 text-slate-400">Bring the right context, the right people, and the right next step into every customer support moment.</p><div className="mt-9 flex gap-2">{["SLA Rescue Radar", "Issue DNA", "Resolution Memory"].map((item) => <span key={item} className="rounded-full border border-white/10 px-3 py-1.5 text-[9px] text-slate-300">{item}</span>)}</div></div>
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-[9px] text-slate-500"><span>Beyond Tickets. Predicting Problems.</span><span>Hackhive · AVISHKAR&apos;26</span></div>
      </section>
      <section className="flex min-h-screen flex-col px-5 py-5 sm:px-10 lg:px-12 xl:px-20">
        <div className="flex items-center justify-between lg:justify-end"><Link href="/" className="flex items-center gap-2 lg:hidden"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#172a45] text-white"><Activity size={16} /></span><span className="text-sm font-extrabold tracking-[0.12em]">SOLVEX</span></Link><Link href="/" className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 hover:text-blue-600"><ArrowLeft size={13} /> Back to home</Link></div>
        <div className="mx-auto my-auto w-full max-w-[410px] py-10">
          <div className="mb-8 lg:hidden"><p className="text-xs font-semibold text-blue-600">Support that sees what&apos;s next.</p></div>
          <p className="eyebrow">{role === "admin" ? "Administrator access" : role === "agent" ? "Agent workspace" : "Customer portal"}</p>
          <h2 className="mt-2 text-[28px] font-bold tracking-tight text-slate-900">{title}</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">{view === "forgot" ? "Enter the email address linked to your account." : mode === "register" ? "Join SOLVEX to keep every support request moving." : "Sign in to pick up right where you left off."}</p>
          {error && <div role="alert" className="mt-5 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">{error}</div>}
          {message && <div role="status" className="mt-5 rounded-lg border border-teal-100 bg-teal-50 px-3 py-2.5 text-xs leading-relaxed text-teal-800">{message}{view === "form" && <div className="mt-2"><Link className="font-bold underline" href={workspace}>Continue to sample {role} workspace →</Link></div>}</div>}
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "register" && view === "form" && <FormInput label="Full name" name="fullName" required minLength={2} placeholder="Your name" />}
            <FormInput label="Email address" name="email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
            {view === "form" && <label className="block text-[10px] font-semibold text-slate-700">Password<div className="relative"><input name="password" required minLength={mode === "register" ? 12 : 1} type={visible ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder={mode === "register" ? "At least 12 characters" : "Enter your password"} className={`${authInput} pr-10`} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{visible ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>}
            {mode === "register" && view === "form" && <label className="flex items-start gap-2 text-[10px] leading-relaxed text-slate-500"><input type="checkbox" required className="mt-0.5 h-3.5 w-3.5 accent-blue-600" />I understand this account is for customer access.</label>}
            {role === "admin" && mode === "login" && view === "form" && <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-[10px] leading-relaxed text-amber-800">Admin accounts are provisioned privately. Public admin registration is not available.</div>}
            <button disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70">{loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />{view === "forgot" ? "Sending…" : "Please wait…"}</> : <>{view === "forgot" ? "Send reset instructions" : mode === "register" ? "Create customer account" : "Sign in"} <ArrowRight size={14} /></>}</button>
          </form>
          {view === "form" && mode === "login" && role === "customer" && <div className="mt-4 text-right"><button onClick={() => { setView("forgot"); setMessage(""); setError(""); }} className="text-[10px] font-semibold text-blue-600 hover:text-blue-800">Forgot password?</button></div>}
          {view === "forgot" && <button onClick={() => { setView("form"); setMessage(""); }} className="mt-4 text-[10px] font-semibold text-slate-500 hover:text-blue-600">← Back to sign in</button>}
          {role === "customer" && view === "form" && <p className="mt-7 border-t border-slate-100 pt-5 text-center text-[10px] text-slate-500">{mode === "register" ? "Already have an account?" : "New to SOLVEX?"} <Link href={mode === "register" ? "/login" : "/register"} className="font-bold text-blue-600 hover:underline">{mode === "register" ? "Sign in" : "Create an account"}</Link></p>}
          {role !== "customer" && <p className="mt-7 border-t border-slate-100 pt-5 text-center text-[10px] text-slate-500">Need access? Contact your SOLVEX administrator.</p>}
          {role === "customer" && <div className="mt-6 flex justify-center gap-4 text-[9px] text-slate-400"><Link href="/agent/login" className="hover:text-blue-600">Agent sign in</Link><Link href="/admin/login" className="hover:text-blue-600">Admin sign in</Link></div>}
          <p className="mt-8 text-center text-[9px] leading-relaxed text-slate-400">Sessions use secure HTTP-only cookies. Passwords are sent only to the API over this local connection.</p>
        </div>
        <p className="pb-2 text-center text-[9px] text-slate-400">© 2026 SOLVEX · Hackhive · AVISHKAR&apos;26</p>
      </section>
    </main>
  );
}

const authInput = "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
