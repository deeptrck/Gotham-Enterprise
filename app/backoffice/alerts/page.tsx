"use client";

import { useState, useEffect } from "react";
import {
  Card, CardHead, Btn, TblHead, Tbl, Td, PageHeader,
  StatCard, Select, Input, DT_CYAN, DT_GREEN, DT_RED, DT_AMBER,
} from "../_components/ui";

type Severity = "critical" | "error" | "warn" | "info";

interface Alert {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  source: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
}

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: Severity;
  enabled: boolean;
  lastFired?: string;
}

// ─── Data fetching ───────────────────────────────────────────────────────────

function useAlertsData() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [history, setHistory] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/alerts", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const transformedAlerts = (data.alerts || []).map((a: Record<string, unknown>) => ({
            id: a.id as string || "",
            severity: (a.severity as Severity) || "info",
            title: a.title as string || "Alert",
            body: a.message as string || "",
            source: a.source as string || "system",
            timestamp: a.created_at ? new Date(a.created_at as string).toISOString().replace("T", " ").slice(0, 19) : "",
            acknowledged: a.acknowledged as boolean ?? false,
            acknowledgedBy: a.acknowledged_by as string | undefined,
          }));
          setAlerts(transformedAlerts.filter((a: Alert) => !a.acknowledged));
          setHistory(transformedAlerts.filter((a: Alert) => a.acknowledged));
          // Rules would come from a separate endpoint in production
          setRules([]);
        }
      } catch (err) {
        console.error("Error fetching alerts:", err);
        setError("Failed to load alerts");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { alerts, history, rules, loading, error };
}

const sevColor: Record<Severity, string> = { critical: DT_RED, error: DT_RED, warn: DT_AMBER, info: DT_CYAN };
const sevBg:    Record<Severity, string> = {
  critical: "rgba(220,38,38,.12)", error: "rgba(220,38,38,.08)",
  warn:     "rgba(217,119,6,.08)", info: "rgba(0,168,204,.08)",
};
const sevIcon:  Record<Severity, string> = { critical: "🚨", error: "❌", warn: "⚠️", info: "ℹ️" };

export default function AlertsPage() {
  const { alerts, history, rules, loading, error } = useAlertsData();
  const [tab, setTab] = useState<"active" | "history" | "rules">("active");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<string | null>(null);

  async function handleAlertAction(alertId: string, action: "acknowledge" | "dismiss") {
    setProcessing(alertId);
    try {
      await fetch("/api/admin/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ alertId, action }),
      });
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(alertId);
        return next;
      });
    } catch (error) {
      console.error("Alert action failed:", error);
    } finally {
      setProcessing(null);
    }
  }

  const activeAlerts = alerts.filter((a) => !a.acknowledged && !dismissed.has(a.id));
  const ackAlerts    = [...history, ...alerts.filter((a) => a.acknowledged || dismissed.has(a.id))];

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: "6px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none",
    background: "transparent", fontFamily: "inherit",
    borderBottom: tab === t ? `2px solid ${DT_CYAN}` : "2px solid transparent",
    color: tab === t ? DT_CYAN : "var(--color-text-secondary)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-background-tertiary)" }}>
      <PageHeader
        title="System alerts"
        sub="Active alerts, history, and configurable alert rules"
        right={<Btn variant="default" onClick={() => window.location.assign('/backoffice/settings')}>⚙ Configure notifications</Btn>}
      />

      <div style={{ padding: "1rem 1.5rem .75rem", display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
        <StatCard label="Active alerts"   value={String(activeAlerts.length)} valColor={activeAlerts.some((a) => a.severity === "critical") ? DT_RED : DT_AMBER} sub="" />
        <StatCard label="Critical"        value={String(activeAlerts.filter((a) => a.severity === "critical").length)} valColor={DT_RED} sub="" />
        <StatCard label="Warnings"        value={String(activeAlerts.filter((a) => a.severity === "warn").length)} valColor={DT_AMBER} sub="" />
        <StatCard label="Rules enabled"   value={String(rules.filter((r) => r.enabled).length)} sub={`of ${rules.length} total`} />
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 1.5rem", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex" }}>
        <button style={tabStyle("active")}  onClick={() => setTab("active")}>Active ({activeAlerts.length})</button>
        <button style={tabStyle("history")} onClick={() => setTab("history")}>History</button>
        <button style={tabStyle("rules")}   onClick={() => setTab("rules")}>Alert rules</button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "1rem 1.5rem 1.5rem", display: "flex", flexDirection: "column", gap: 10 }}>

        {tab === "active" && (
          <>
            {activeAlerts.length === 0 && (
              <div style={{ padding: "3rem", textAlign: "center", color: DT_GREEN, fontSize: 14 }}>
                ✓ All clear — no active alerts
              </div>
            )}
            {activeAlerts.map((a) => (
              <div key={a.id} style={{
                background: sevBg[a.severity],
                border: `0.5px solid ${sevColor[a.severity]}`,
                borderRadius: "var(--border-radius-lg)",
                padding: "1rem 1.25rem",
                display: "flex", alignItems: "flex-start", gap: 12,
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{sevIcon[a.severity]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: sevColor[a.severity] }}>{a.title}</span>
                    <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: sevBg[a.severity], border: `0.5px solid ${sevColor[a.severity]}`, color: sevColor[a.severity] }}>
                      {a.severity}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6, lineHeight: 1.5 }}>{a.body}</div>
                  <div style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>Source: {a.source} · {a.timestamp}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Btn variant="xs" onClick={() => handleAlertAction(a.id, "acknowledge")} disabled={processing === a.id}>Acknowledge</Btn>
                  <Btn variant="xs" onClick={() => handleAlertAction(a.id, "dismiss")} disabled={processing === a.id}>Dismiss</Btn>
                </div>
              </div>
            ))}

            {/* Acknowledged */}
            {ackAlerts.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-tertiary)", marginTop: 8 }}>Acknowledged</div>
                {ackAlerts.map((a) => (
                  <div key={a.id} style={{
                    background: "var(--color-background-primary)",
                    border: "0.5px solid var(--color-border-tertiary)",
                    borderRadius: "var(--border-radius-lg)",
                    padding: ".75rem 1.25rem",
                    display: "flex", alignItems: "center", gap: 12, opacity: 0.65,
                  }}>
                    <span style={{ fontSize: 16 }}>{sevIcon[a.severity]}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>{a.title}</div>
                      <div style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>
                        Acknowledged{a.acknowledgedBy ? ` by ${a.acknowledgedBy}` : ""} · {a.timestamp}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {tab === "history" && (
          <Card>
            <Tbl>
              <TblHead cols={["Severity", "Title", "Source", "Fired", "Acknowledged by"]} />
              <tbody>
                {[...ackAlerts, ...history].map((a) => (
                  <tr key={a.id}>
                    <Td>
                      <span style={{ fontSize: 11, fontWeight: 500, color: sevColor[a.severity] }}>
                        {sevIcon[a.severity]} {a.severity}
                      </span>
                    </Td>
                    <Td style={{ fontWeight: 500, fontSize: 12 }}>{a.title}</Td>
                    <Td style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>{a.source}</Td>
                    <Td style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>{a.timestamp}</Td>
                    <Td style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>{a.acknowledgedBy ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Tbl>
          </Card>
        )}

        {tab === "rules" && (
          <Card>
            <CardHead title="Alert configuration rules" right={<Btn variant="primary">+ Add rule</Btn>} />
            <Tbl>
              <TblHead cols={["Rule name", "Condition", "Severity", "Enabled", "Last fired", ""]} />
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <Td style={{ fontWeight: 500, fontSize: 12 }}>{r.name}</Td>
                    <Td style={{ fontFamily: "monospace", fontSize: 10, color: "var(--color-text-secondary)" }}>{r.condition}</Td>
                    <Td><span style={{ fontSize: 11, fontWeight: 500, color: sevColor[r.severity] }}>{sevIcon[r.severity]} {r.severity}</span></Td>
                    <Td>
                      <div style={{
                        width: 32, height: 18, borderRadius: 99, cursor: "pointer",
                        background: r.enabled ? DT_GREEN : "var(--color-border-secondary)",
                        position: "relative", flexShrink: 0, display: "inline-flex", alignItems: "center",
                      }}>
                        <div style={{
                          width: 12, height: 12, borderRadius: "50%", background: "#fff",
                          position: "absolute", left: r.enabled ? 16 : 2, transition: "left .2s",
                        }} />
                      </div>
                    </Td>
                    <Td style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>{r.lastFired ?? "Never"}</Td>
                    <Td><Btn variant="xs" onClick={() => window.alert("Edit rule coming soon")}>Edit</Btn></Td>
                  </tr>
                ))}
              </tbody>
            </Tbl>
          </Card>
        )}
      </div>
    </div>
  );
}