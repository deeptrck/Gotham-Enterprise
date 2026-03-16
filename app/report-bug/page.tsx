"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bug } from "lucide-react";

export default function ReportBugPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [page, setPage] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      const response = await fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, page, priority }),
      });

      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error || "Could not submit bug report. Please try again.");
      } else {
        setTitle("");
        setDescription("");
        setPage("");
        setPriority("medium");
        setStatus("Bug report submitted. Thank you!");
      }
    } catch (err) {
      console.error(err);
      setStatus("Could not submit bug report. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4">
      <div className="mx-auto w-full max-w-2xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow">
        <div className="flex items-center gap-2 mb-4">
          <Bug className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Report a Bug</h1>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Found something wrong? Create a bug report and our admins can follow up.</p>

        {status && <div className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-3 text-sm text-slate-700 dark:text-slate-200 mb-4">{status}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1 rounded border border-slate-300 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="What went wrong?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Description</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full mt-1 rounded border border-slate-300 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Steps to reproduce, expected behavior, actual behavior"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Page (optional)</label>
            <input
              value={page}
              onChange={(e) => setPage(e.target.value)}
              className="w-full mt-1 rounded border border-slate-300 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="/login or /dashboard"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
              className="mt-1 w-full rounded border border-slate-300 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Submit Bug Report"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
