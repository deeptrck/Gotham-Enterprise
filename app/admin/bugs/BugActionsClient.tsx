"use client";

import { useState } from "react";

type BugActionsClientProps = {
  bugId: string;
  onUpdated: () => void;
};

export default function BugActionsClient({ bugId, onUpdated }: BugActionsClientProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = async (status: "open" | "resolved") => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bugs/${bugId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || "Failed to update bug status.");
      } else {
        onUpdated();
      }
    } catch {
      setError("Failed to update bug status.");
    } finally {
      setLoading(false);
    }
  };

  const deleteBug = async () => {
    if (!confirm("Are you sure you want to delete this bug report?")) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bugs/${bugId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error || "Failed to delete bug report.");
      } else {
        onUpdated();
      }
    } catch {
      setError("Failed to delete bug report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        onClick={() => updateStatus("resolved")}
        disabled={loading}
        className="rounded bg-emerald-600 text-white px-2 py-1 text-xs hover:bg-emerald-700 disabled:opacity-60"
      >
        Mark done
      </button>
      <button
        type="button"
        onClick={() => updateStatus("open")}
        disabled={loading}
        className="rounded bg-yellow-500 text-white px-2 py-1 text-xs hover:bg-yellow-600 disabled:opacity-60"
      >
        Mark pending
      </button>
      <button
        type="button"
        onClick={deleteBug}
        disabled={loading}
        className="rounded bg-red-600 text-white px-2 py-1 text-xs hover:bg-red-700 disabled:opacity-60"
      >
        Delete
      </button>
      {error && <p className="text-xs text-red-500 w-full">{error}</p>}
    </div>
  );
}
