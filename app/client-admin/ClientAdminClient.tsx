"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, CheckCircle2, ChevronRight, CircleAlert, CreditCard, KeyRound, LifeBuoy, LockKeyhole, Radar, Settings2, ShieldCheck, Users2 } from "lucide-react";

type Props = { user: { name: string; email: string; roles: string[] } };
type DashboardData = { credits?: number; creditsRemaining?: number; totalScans?: number; scans?: Array<{ status?: string; createdAt?: string; fileName?: string }>; plan?: string };

function StatCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Activity }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-500">{note}</p></div><div className="rounded-xl bg-cyan-50 p-3 text-cyan-700"><Icon size={19} /></div></div></div>;
}

function SectionHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-700">{eyebrow}</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{title}</h2></div>{action}</div>;
}

export default function ClientAdminClient({ user }: Props) {
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/users/dashboard", { credentials: "include", cache: "no-store" }), fetch("/api/usage", { credentials: "include", cache: "no-store" })])
      .then(async ([dashboard, usage]) => {
        if (!dashboard.ok || !usage.ok) {
          throw new Error("Client metrics request failed");
        }
        const dashboardJson = await dashboard.json();
        const usageJson = await usage.json();
        if (active) setData({ ...dashboardJson, ...usageJson });
      })
      .catch(() => { if (active) setError("Live client metrics are temporarily unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const scans = data.scans ?? [];
  const totalScans = data.totalScans ?? scans.length;
  const suspicious = scans.filter((scan) => ["SUSPICIOUS", "DEEPFAKE"].includes(String(scan.status).toUpperCase())).length;
  const plan = data.plan ?? "Enterprise";
  const initials = user.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const health = useMemo(() => suspicious > 0 ? "Review required" : "Operational", [suspicious]);

  return <div className="min-h-full bg-[#f6f8fa] px-5 py-6 text-slate-900 md:px-9 md:py-8">
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-8 flex flex-col gap-5 rounded-3xl bg-[#0A0E1A] px-6 py-7 text-white shadow-xl shadow-slate-300/30 md:flex-row md:items-end md:justify-between md:px-8">
        <div><div className="mb-5 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-sm font-black tracking-tight text-cyan-300">DT</div><span className="text-sm font-semibold tracking-[0.15em] text-cyan-200">DEEPTRACK / GOTHAM</span></div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Client administration</p><h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Your risk intelligence workspace</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Govern access, monitor verification activity, and keep your organization’s media-risk operations accountable from one controlled workspace.</p></div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/20 text-sm font-bold text-cyan-200">{initials || "AD"}</div><div><p className="text-sm font-semibold">{user.name}</p><p className="text-xs text-slate-400">{user.email}</p></div></div>
      </header>

      {error && <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><CircleAlert size={17} />{error}</div>}
      <div className="mb-9 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Media processed" value={loading ? "—" : totalScans.toLocaleString()} note="Across your workspace" icon={Radar} /><StatCard label="Credits remaining" value={loading ? "—" : String(data.creditsRemaining ?? data.credits ?? "—")} note={`${plan} plan allocation`} icon={CreditCard} /><StatCard label="Risk items" value={loading ? "—" : String(suspicious)} note={suspicious ? "Awaiting review" : "No open anomalies"} icon={CircleAlert} /><StatCard label="Workspace health" value={loading ? "—" : health} note="Last 24 hours" icon={ShieldCheck} /></div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
        <section><SectionHeader eyebrow="Control center" title="Workspace administration" action={<Link href="/console" className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 hover:text-cyan-900">Open API console <ArrowUpRight size={15} /></Link>} /><div className="grid gap-4 md:grid-cols-2"><Link href="/console" className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"><div className="flex items-start justify-between"><div className="rounded-xl bg-slate-100 p-3 text-slate-700"><KeyRound size={19} /></div><ChevronRight className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-cyan-600" size={19} /></div><h3 className="mt-5 text-base font-semibold">API access & keys</h3><p className="mt-2 text-sm leading-6 text-slate-500">Issue, rotate, and revoke integration keys with clear ownership and usage visibility.</p></Link><Link href="/pricing-billing" className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"><div className="flex items-start justify-between"><div className="rounded-xl bg-slate-100 p-3 text-slate-700"><CreditCard size={19} /></div><ChevronRight className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-cyan-600" size={19} /></div><h3 className="mt-5 text-base font-semibold">Plan & usage</h3><p className="mt-2 text-sm leading-6 text-slate-500">Review credits, processing volume, and billing controls for your organization.</p></Link><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="rounded-xl bg-slate-100 p-3 text-slate-700 w-fit"><Users2 size={19} /></div><h3 className="mt-5 text-base font-semibold">Team access</h3><p className="mt-2 text-sm leading-6 text-slate-500">Invite reviewers and assign role boundaries for your organization.</p><span className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-700"><Settings2 size={14} /> Role management next</span></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="rounded-xl bg-slate-100 p-3 text-slate-700 w-fit"><LockKeyhole size={19} /></div><h3 className="mt-5 text-base font-semibold">Security posture</h3><p className="mt-2 text-sm leading-6 text-slate-500">Auth0 identity, least-privilege roles, audit trails, and secure API access are active.</p><span className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-700"><CheckCircle2 size={14} /> Protected</span></div></div></section>
        <aside><SectionHeader eyebrow="Recent activity" title="Verification pulse" /><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="divide-y divide-slate-100">{scans.slice(0, 5).map((scan, index) => <div key={`${scan.fileName}-${index}`} className="flex items-center gap-3 px-5 py-4"><div className={`h-2 w-2 rounded-full ${String(scan.status).toUpperCase() === "AUTHENTIC" ? "bg-emerald-500" : "bg-amber-500"}`} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{scan.fileName ?? "Media verification"}</p><p className="mt-1 text-xs text-slate-400">{scan.status ?? "Processing"}</p></div><Activity size={15} className="text-slate-300" /></div>)}{!scans.length && <div className="px-5 py-12 text-center"><Radar className="mx-auto text-slate-300" size={28} /><p className="mt-3 text-sm font-medium text-slate-600">No recent verification activity</p><p className="mt-1 text-xs text-slate-400">Your workspace activity will appear here.</p></div>}</div><Link href="/history" className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm font-semibold text-cyan-700 hover:bg-cyan-50">View full scan history <ArrowUpRight size={15} /></Link></div><div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-5"><div className="flex gap-3"><LifeBuoy className="mt-0.5 text-cyan-700" size={18} /><div><h3 className="text-sm font-semibold text-slate-900">Need help operationalizing Gotham?</h3><p className="mt-1 text-sm leading-6 text-slate-600">Our team can help configure ingestion, review workflows, and API governance for your organization.</p><Link href="/report-bug" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-cyan-800">Contact support <ArrowUpRight size={14} /></Link></div></div></div></aside>
      </div>
      <footer className="mt-10 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 md:flex-row md:items-center md:justify-between"><span>Deeptrack Gotham · Client administration</span><span className="font-mono">Auth0 protected · Workspace scoped</span></footer>
    </div>
  </div>;
}
