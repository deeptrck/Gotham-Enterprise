"use client";

import { useState, useEffect } from "react";
import {
  Card, CardHead, Btn, TblHead, Tbl, Td, PageHeader,
  StatCard, Pill, ConfBar, DT_CYAN, DT_GREEN, DT_RED, DT_AMBER,
} from "../_components/ui";

type QueueTab = "all" | "fp" | "fn";
type Escalation = "client_dispute" | "auto_escalated" | "internal_flag";

interface QueueItem {
  id: string;
  scanId: string;
  client: string;
  file: string;
  icon: string;
  mediaType: "Video" | "Audio" | "Image" | "Document";
  originalVerdict: "authentic" | "deepfake";
  confidence: number;
  rdScore: number;
  dtScore: number;
  type: "fp" | "fn";
  escalation: Escalation;
  age: string;
  duration?: string;
  fileSize: string;
  reviewStatus: "pending" | "confirmed" | "dismissed";
}

// ─── Data fetching ───────────────────────────────────────────────────────────

function useFpQueueData() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/fp-queue?limit=50", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const transformed = (data.items || []).map((item: Record<string, unknown>) => ({
          id: item.id as string || "",
          scanId: item.scan_id as string || "",
          client: "Unknown",
          file: item.name as string || "",
          icon: item.icon as string || "🎬",
          mediaType: "Video" as const,
          originalVerdict: item.type === "fp" ? "deepfake" as const : "authentic" as const,
          confidence: item.confidence as number || 0,
          rdScore: item.confidence as number || 0,
          dtScore: item.confidence as number || 0,
          type: item.type as "fp" | "fn",
          escalation: "auto_escalated" as const,
          age: "Recently",
          reviewStatus: (item.status as string) as "pending" | "confirmed" | "dismissed" || "pending",
        }));
        setItems(transformed);
      }
    } catch (err) {
      console.error("Error fetching FP queue:", err);
      setError("Failed to load queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  return { items, loading, error, refetch: fetchData };
}

const escalationLabel: Record<Escalation, { label: string; color: string }> = {
  client_dispute: { label: "Client dispute", color: DT_RED   },
  auto_escalated: { label: "Auto-escalated", color: DT_AMBER },
  internal_flag:  { label: "Internal flag",  color: DT_CYAN  },
};

export default function FpQueuePage() {
  const { items: queueItems, loading, error, refetch } = useFpQueueData();
  const [tab, setTab]           = useState<QueueTab>("all");
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [checked, setChecked]   = useState<Set<string>>(new Set());
  const [successMessage, setSuccessMessage] = useState<string>("");

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const items = tab === "all" ? queueItems : queueItems.filter((q) => q.type === tab);
  const pending = items.filter((q) => q.reviewStatus === "pending");

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const tabStyle = (t: QueueTab): React.CSSProperties => ({
    padding: "6px 16px",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    border: "none",
    background: "transparent",
    fontFamily: "inherit",
    borderBottom: tab === t ? `2px solid ${DT_CYAN}` : "2px solid transparent",
    color: tab === t ? DT_CYAN : "var(--color-text-secondary)",
  });

  async function handleBulkAction(action: "confirm_fp" | "confirm_fn" | "dismiss") {
    if (checked.size === 0) return;

    try {
      const reviewStatus = action === "dismiss" ? "dismissed" : "confirmed";
      const feedbackType = action === "confirm_fp" ? "fp" : action === "confirm_fn" ? "fn" : null;

      const promises = Array.from(checked).map(scanId =>
        fetch("/api/admin/fp-queue", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ scanId, reviewStatus, feedbackType }),
        })
      );

      await Promise.all(promises);
      setChecked(new Set());
      await refetch();
      setSuccessMessage(`Bulk action completed: ${action.replace("_", " ").toUpperCase()}`);
    } catch (error) {
      console.error("Error performing bulk action:", error);
    }
  }

  async function handleItemAction(scanId: string, action: "confirm_fp" | "confirm_fn" | "dismiss") {
    try {
      const reviewStatus = action === "dismiss" ? "dismissed" : "confirmed";
      const feedbackType = action === "confirm_fp" ? "fp" : action === "confirm_fn" ? "fn" : null;

      const res = await fetch("/api/admin/fp-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scanId, reviewStatus, feedbackType }),
      });

      if (res.ok) {
        await refetch();
        setSuccessMessage(`Item ${action.replace("_", " ").toUpperCase()} successfully`);
      }
    } catch (error) {
      console.error("Error performing item action:", error);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-background-tertiary)" }}>
      {successMessage && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 1000,
          background: DT_GREEN, color: "#fff", padding: "12px 16px",
          borderRadius: "var(--border-radius-md)", fontSize: 14, fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
        }}>
          ✓ {successMessage}
        </div>
      )}
      <PageHeader
        title="FP / FN review queue"
        sub="Scans flagged for human review — client disputes, auto-escalated, internal flags"
        right={
          checked.size > 0
            ? <>
                <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{checked.size} selected</span>
                <Btn variant="green" onClick={() => handleBulkAction("confirm_fp")}>Bulk: Confirm FP</Btn>
                <Btn variant="red" onClick={() => handleBulkAction("confirm_fn")}>Bulk: Confirm FN</Btn>
                <Btn variant="xs" onClick={() => handleBulkAction("dismiss")}>Bulk: Dismiss</Btn>
              </>
            : <Btn variant="primary" onClick={refetch}>↻ Refresh</Btn>
        }
      />

      <div style={{ padding: "1rem 1.5rem .75rem", display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
        <StatCard label="Total pending"      value={String(queueItems.filter((q) => q.reviewStatus === "pending").length)} valColor={DT_AMBER} sub="Needs human review" />
        <StatCard label="False positives"    value={String(queueItems.filter((q) => q.type === "fp").length)} valColor={DT_RED}   sub="Model said deepfake" />
        <StatCard label="False negatives"    value={String(queueItems.filter((q) => q.type === "fn").length)} valColor={DT_AMBER} sub="Model missed it" />
        <StatCard label="Oldest item"        value="2d"    sub="Target: review within 4h" subColor={DT_RED} />
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 1.5rem", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", gap: 0 }}>
        {(["all", "fp", "fn"] as QueueTab[]).map((t) => (
          <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>
            {t === "all" ? `All (${queueItems.length})` : t === "fp" ? `False positives (${queueItems.filter((q) => q.type === "fp").length})` : `False negatives (${queueItems.filter((q) => q.type === "fn").length})`}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", gap: 0, padding: "1rem 1.5rem 1.5rem" }}>
        {/* Queue list */}
        <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelected(selected?.id === item.id ? null : item)}
                style={{
                  background: selected?.id === item.id ? "var(--color-background-secondary)" : "var(--color-background-primary)",
                  border: `0.5px solid ${selected?.id === item.id ? DT_CYAN : "var(--color-border-tertiary)"}`,
                  borderRadius: "var(--border-radius-lg)",
                  padding: "12px 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={checked.has(item.scanId)}
                  onChange={() => toggleCheck(item.scanId)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ marginTop: 2, cursor: "pointer", accentColor: DT_CYAN }}
                />

                {/* Icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: "var(--border-radius-md)", flexShrink: 0,
                  background: item.type === "fp" ? "rgba(220,38,38,.1)" : "rgba(217,119,6,.1)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                }}>
                  {item.icon}
                </div>

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.file}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 99,
                      background: item.type === "fp" ? "rgba(220,38,38,.15)" : "rgba(217,119,6,.15)",
                      color: item.type === "fp" ? DT_RED : DT_AMBER,
                    }}>
                      {item.type.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
                    {item.client} · {item.mediaType} · {item.fileSize}{item.duration ? ` · ${item.duration}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 1 }}>
                    Original verdict: <span style={{ color: item.originalVerdict === "deepfake" ? DT_RED : DT_GREEN, fontWeight: 500 }}>{item.originalVerdict}</span>
                    &nbsp;·&nbsp;
                    <span style={{ color: escalationLabel[item.escalation].color }}>{escalationLabel[item.escalation].label}</span>
                    &nbsp;·&nbsp;{item.age}
                  </div>
                </div>

                {/* Confidence + actions */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <ConfBar pct={item.confidence} color={item.type === "fp" ? DT_RED : DT_AMBER} />
                  <div style={{ display: "flex", gap: 4 }}>
                    <Btn variant="green" onClick={() => handleItemAction(item.scanId, item.type === "fp" ? "confirm_fp" : "confirm_fn")}>Confirm {item.type.toUpperCase()}</Btn>
                    <Btn variant="xs" onClick={() => handleItemAction(item.scanId, "dismiss")}>Dismiss</Btn>
                    <Btn variant="xs" onClick={() => setSelected(item)}>Forensics</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{
            width: 300, flexShrink: 0, marginLeft: 12,
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-lg)",
            overflow: "auto", display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: ".65rem 1rem", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Review detail</span>
              <button onClick={() => setSelected(null)} style={{ fontSize: 14, background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontFamily: "inherit" }}>✕</button>
            </div>
            <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* File preview placeholder */}
              <div style={{
                height: 120, borderRadius: "var(--border-radius-md)",
                background: "var(--color-background-secondary)",
                border: "0.5px solid var(--color-border-tertiary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 6,
              }}>
                <span style={{ fontSize: 32 }}>{selected.icon}</span>
                <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>
                  {selected.duration ?? selected.fileSize} · {selected.mediaType}
                </span>
                <Btn variant="xs">Download original</Btn>
              </div>

              {/* Scan info */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[
                  ["Scan ID",           selected.scanId],
                  ["Client",            selected.client],
                  ["Original verdict",  selected.originalVerdict],
                  ["Escalation",        escalationLabel[selected.escalation].label],
                  ["Age",               selected.age],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "var(--color-text-tertiary)" }}>{k}</span>
                    <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Model scores */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 8 }}>Model scores</div>
                {[["Deeptrack Scan", selected.rdScore], ["Deeptrack", selected.dtScore], ["Ensemble", selected.confidence]].map(([l, v]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{l}</span>
                    <ConfBar pct={v as number} color={selected.type === "fp" ? DT_RED : DT_AMBER} />
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Btn variant="green"   style={{ width: "100%", textAlign: "center" }} onClick={() => handleItemAction(selected.id, selected.type === "fp" ? "confirm_fp" : "confirm_fn")}>✓ Confirm {selected.type.toUpperCase()} — model wrong</Btn>
                <Btn variant="default" style={{ width: "100%", textAlign: "center" }}>Keep verdict — model correct</Btn>
                <Btn variant="amber"   style={{ width: "100%", textAlign: "center", fontSize: 11, padding: "3px 9px" }}>Escalate to Tauil</Btn>
                <Btn variant="primary" style={{ width: "100%", textAlign: "center" }} onClick={() => window.open(`/backoffice/forensics?scanId=${selected.scanId}`, '_blank')}>Open full forensics</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}