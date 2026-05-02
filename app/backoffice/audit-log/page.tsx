"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Card, CardHead, Btn, TblHead, Tbl, Td, PageHeader,
  StatCard, Select, Input, DT_CYAN, DT_GREEN, DT_RED, DT_AMBER,
} from "../_components/ui";

type ActionType =
  | "scan.reviewed"     | "scan.forensics_viewed"
  | "client.created"    | "client.suspended"   | "client.credits_adjusted"
  | "api_key.created"   | "api_key.revoked"
  | "webhook.created"   | "webhook.deleted"    | "webhook.test_sent"
  | "settings.updated"  | "alert.acknowledged"
  | "pipeline.triggered"| "label.promoted";

interface AuditEntry {
  id: string;
  actor: string;
  actorRole: "admin" | "reviewer" | "system";
  action: ActionType;
  target: string;
  ip: string;
  timestamp: string;
  details?: string;
}

// ─── Data fetching ───────────────────────────────────────────────────────────

function useAuditLogData() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/audit-log", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const transformed = (data.logs || []).map((l: Record<string, unknown>) => ({
            id: l.id as string || "",
            actor: l.actor as string || "Unknown",
            actorRole: (l.actor_role as string) as "admin" | "reviewer" | "system" || "admin",
            action: l.action as ActionType || "unknown",
            target: l.target as string || "",
            ip: l.ip as string || "",
            timestamp: l.timestamp ? new Date(l.timestamp as string).toISOString().replace("T", " ").slice(0, 19) : "",
            details: l.details as string | undefined,
          }));
          setEntries(transformed);
        }
      } catch (err) {
        console.error("Error fetching audit logs:", err);
        setError("Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { entries, loading, error };
}

const actionColor: Record<string, string> = {
  "scan.reviewed":          DT_CYAN,
  "scan.forensics_viewed":  "var(--color-text-secondary)",
  "client.created":         DT_GREEN,
  "client.suspended":       DT_RED,
  "client.credits_adjusted":DT_AMBER,
  "api_key.created":        DT_GREEN,
  "api_key.revoked":        DT_RED,
  "webhook.created":        DT_GREEN,
  "webhook.deleted":        DT_RED,
  "webhook.test_sent":      DT_CYAN,
  "settings.updated":       DT_AMBER,
  "alert.acknowledged":     "var(--color-text-secondary)",
  "pipeline.triggered":     DT_CYAN,
  "label.promoted":         DT_GREEN,
};

const roleColor = (r: string) => r === "admin" ? DT_CYAN : r === "reviewer" ? DT_AMBER : "var(--color-text-tertiary)";

export default function AuditLogPage() {
  const { entries, loading, error } = useAuditLogData();
  const [search, setSearch]           = useState("");
  const [filterActor, setFilterActor] = useState("All");
  const [filterAction, setFilterAction] = useState("All");
  const [page, setPage]               = useState(1);
  const PER_PAGE = 10;

  const actors  = ["All", ...Array.from(new Set(entries.map((a) => a.actor)))];
  const actions = ["All", ...Array.from(new Set(entries.map((a) => a.action.split(".")[0])))];

  const filtered = useMemo(() => {
    return entries.filter((a) => {
      if (filterActor  !== "All" && a.actor  !== filterActor)            return false;
      if (filterAction !== "All" && !a.action.startsWith(filterAction))  return false;
      if (search) {
        const q = search.toLowerCase();
        if (!a.target.toLowerCase().includes(q) && !a.actor.toLowerCase().includes(q) && !a.action.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [search, filterActor, filterAction, entries]);

  const pages = Math.ceil(filtered.length / PER_PAGE);
  const rows  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function exportCSV() {
    const header = "ID,Actor,Role,Action,Target,IP,Timestamp,Details\n";
    const body = filtered.map((a) =>
      `${a.id},"${a.actor}",${a.actorRole},${a.action},${a.target},${a.ip},${a.timestamp},"${a.details ?? ""}"`
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "audit_log.csv"; link.click();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-background-tertiary)" }}>
      <PageHeader
        title="Audit log"
        sub="Immutable record of all actions — EU AI Act compliant · 36-month retention"
        right={
          <>
            <Btn variant="default" onClick={exportCSV}>↓ Export CSV</Btn>
          </>
        }
      />

      <div style={{ padding: "1rem 1.5rem .75rem", display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
        <StatCard label="Total entries"    value="20"   sub="All time (sample shown)" />
        <StatCard label="Actions today"    value="8"    sub="2026-04-18" />
        <StatCard label="Unique actors"    value="3"    sub="Brian · Tauil · System" />
        <StatCard label="Retention"        value="36mo" sub="EU AI Act requirement" subColor={DT_GREEN} />
      </div>

      {/* Filters */}
      <div style={{ padding: "0 1.5rem .75rem", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Input placeholder="Search action, actor, target…" value={search} onChange={(v) => { setSearch(v); setPage(1); }} style={{ width: 240 }} />
        <Select value={filterActor} onChange={(v) => { setFilterActor(v); setPage(1); }}>
          {actors.map((a) => <option key={a}>{a}</option>)}
        </Select>
        <Select value={filterAction} onChange={(v) => { setFilterAction(v); setPage(1); }}>
          {actions.map((a) => <option key={a}>{a}</option>)}
        </Select>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", alignSelf: "center", marginLeft: 4 }}>
          {filtered.length} entries
        </span>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 1.5rem 1.5rem" }}>
        <Card>
          <Tbl>
            <TblHead cols={["Timestamp", "Actor", "Role", "Action", "Target", "Details", "IP"]} />
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <Td style={{ color: "var(--color-text-tertiary)", fontSize: 11, whiteSpace: "nowrap", fontFamily: "monospace" }}>{a.timestamp}</Td>
                  <Td style={{ fontWeight: 500, fontSize: 12 }}>{a.actor}</Td>
                  <Td style={{ fontSize: 11, color: roleColor(a.actorRole) }}>{a.actorRole}</Td>
                  <Td>
                    <code style={{ fontSize: 10, fontFamily: "monospace", color: actionColor[a.action] ?? DT_CYAN }}>
                      {a.action}
                    </code>
                  </Td>
                  <Td style={{ fontFamily: "monospace", fontSize: 11, color: DT_CYAN }}>{a.target}</Td>
                  <Td style={{ color: "var(--color-text-secondary)", fontSize: 11, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.details ?? "—"}
                  </Td>
                  <Td style={{ fontFamily: "monospace", fontSize: 10, color: "var(--color-text-tertiary)" }}>{a.ip}</Td>
                </tr>
              ))}
            </tbody>
          </Tbl>

          {/* Pagination */}
          <div style={{ padding: "8px 12px", borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", gap: 6, alignItems: "center" }}>
            <Btn variant="xs" onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ opacity: page === 1 ? 0.4 : 1 }}>← Prev</Btn>
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} style={{
                width: 24, height: 24, borderRadius: "var(--border-radius-md)", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                border: p === page ? `0.5px solid ${DT_CYAN}` : "0.5px solid var(--color-border-secondary)",
                background: p === page ? "rgba(0,168,204,.12)" : "transparent",
                color: p === page ? DT_CYAN : "var(--color-text-secondary)",
              }}>{p}</button>
            ))}
            <Btn variant="xs" onClick={() => setPage((p) => Math.min(pages, p + 1))} style={{ opacity: page === pages ? 0.4 : 1 }}>Next →</Btn>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-text-tertiary)" }}>
              Page {page} of {pages}
            </span>
          </div>

          {/* Compliance note */}
          <div style={{ padding: "8px 12px", borderTop: "0.5px solid var(--color-border-tertiary)", fontSize: 11, color: "var(--color-text-tertiary)", background: "var(--color-background-secondary)" }}>
            🔒 This log is INSERT-only at the database role level. No record can be updated or deleted. Retained for 36 months per EU AI Act requirements.
          </div>
        </Card>
      </div>
    </div>
  );
}