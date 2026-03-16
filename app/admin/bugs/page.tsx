"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
type Bug = {
  _id: string;
  title: string;
  description: string;
  page?: string;
  priority: "low" | "medium" | "high";
  status: "open" | "resolved";
  userEmail?: string;
  createdAt: string;
};

export default function AdminBugsPage() {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBugs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/bugs", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || "Unable to load bug reports.");
        setBugs([]);
      } else {
        const payload = await response.json();
        setBugs(payload.bugs || []);
      }
    } catch {
      setError("Unable to load bug reports.");
      setBugs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBugs();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4">
      <div className="mx-auto w-full max-w-5xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Bug Reports</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">Only admins can view and manage these reports.</p>
          </div>
          <Link href="/admin/dashboard" className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">Back to Dashboard</Link>
        </div>

        {error && <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        {loading ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-slate-700">Loading bug reports...</div>
        ) : bugs.length === 0 ? (
          <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 text-slate-700 dark:text-slate-200">No bug reports yet.</div>
        ) : (
          <div className="space-y-3">
            {bugs.map((bug) => (
              <div key={String(bug._id)} className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{bug.title}</p>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{bug.priority}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">#{String(bug._id)} • reported by {bug.userEmail || "unknown"} • {new Date(bug.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${bug.status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-50"}`}>{bug.status}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{bug.description}</p>
                {bug.page && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Page: {bug.page}</p>}
                <div className="mt-2">
                  <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200 px-2 py-0.5 text-xs font-medium">
                    Bug status: {bug.status === "open" ? "Open" : "Resolved"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
