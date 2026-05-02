"use client";

import { useState, useEffect } from "react";
import {
  Card, CardHead, Btn, TblHead, Tbl, Td, PageHeader,
  StatCard, Select, Input, Pill, DT_CYAN, DT_GREEN, DT_RED, DT_AMBER,
} from "../_components/ui";

interface Webhook {
  id: string;
  name: string;
  client: string;
  url: string;
  trigger: string;
  active: boolean;
  lastDelivery: string;
  lastStatus: "success" | "failed" | "pending" | null;
  successRate: number;
  totalDeliveries: number;
}

interface DeliveryLog {
  id: string;
  webhookId: string;
  webhookName: string;
  event: string;
  status: "success" | "failed" | "retrying";
  statusCode: number | null;
  latencyMs: number;
  retries: number;
  time: string;
}

// ─── Data fetching ───────────────────────────────────────────────────────────

function useWebhooksData() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/webhooks", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const transformed = (data.webhooks || []).map((w: Record<string, unknown>) => ({
            id: w.id as string || "",
            name: w.name as string || "Webhook",
            client: w.client as string || "Unknown",
            url: w.url as string || "",
            trigger: w.events as string || "all events",
            active: w.is_active as boolean ?? true,
            lastDelivery: w.last_delivery_at ? new Date(w.last_delivery_at as string).toLocaleString() : "Never",
            lastStatus: (w.last_status as string) as "success" | "failed" | "pending" | null || null,
            successRate: (w.success_rate as number) ?? 100,
            totalDeliveries: w.total_deliveries as number ?? 0,
          }));
          setWebhooks(transformed);
          // Delivery logs would come from a separate endpoint in production
          setLogs([]);
        }
      } catch (err) {
        console.error("Error fetching webhooks:", err);
        setError("Failed to load webhooks");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { webhooks, logs, loading, error };
}

const deliveryStatusColor: Record<string, string> = {
  success: DT_GREEN, failed: DT_RED, retrying: DT_AMBER,
};

export default function WebhooksPage() {
  const { webhooks, logs, loading, error } = useWebhooksData();
  const [showAdd, setShowAdd]           = useState(false);
  const [editWebhook, setEditWebhook]   = useState<Webhook | null>(null);
  const [testing, setTesting]           = useState<string | null>(null);
  const [testResult, setTestResult]     = useState<{ id: string; ok: boolean } | null>(null);
  const [selectedLog, setSelectedLog]   = useState<string | null>(null);
  const [modalName, setModalName]       = useState("");
  const [modalClient, setModalClient]   = useState("ZEP-RE");
  const [modalUrl, setModalUrl]         = useState("");
  const [modalTrigger, setModalTrigger] = useState("");

  useEffect(() => {
    if (editWebhook) {
      setModalName(editWebhook.name);
      setModalClient(editWebhook.client);
      setModalUrl(editWebhook.url);
      setModalTrigger(editWebhook.trigger);
    } else {
      setModalName("");
      setModalClient("ZEP-RE");
      setModalUrl("");
      setModalTrigger("");
    }
  }, [editWebhook]);

  // Use webhooks instead of WEBHOOKS constant
  const activeWebhooks = webhooks.filter((w) => w.active);
  const totalDeliveries = webhooks.reduce((sum, w) => sum + w.totalDeliveries, 0);
  const avgSuccess = webhooks.length > 0
    ? webhooks.reduce((sum, w) => sum + w.successRate, 0) / webhooks.length
    : 0;

  async function handleDelete(webhookId: string) {
    if (!confirm("Are you sure you want to delete this webhook? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/webhooks?id=${webhookId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        // Refresh data
        window.location.reload();
      }
    } catch (error) {
      console.error("Error deleting webhook:", error);
    }
  }

  function handleExport() {
    const header = "Time,Webhook,Event,Status,HTTP Code,Latency,Retries\n";
    const body = logs.map((d) =>
      `${d.time},"${d.webhookName}",${d.event},${d.status},${d.statusCode ?? ""},${d.latencyMs},${d.retries}`
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "webhook_deliveries.csv"; link.click();
  }

  function handlePayload(logId: string) {
    // In a real app, this would fetch and display the payload
    alert("Payload viewer would open here with the JSON payload for this delivery.");
  }

  async function handleSaveWebhook(webhookData: Partial<Webhook>) {
    try {
      const method = editWebhook ? "PATCH" : "POST";
      const url = editWebhook ? `/api/admin/webhooks?id=${editWebhook.id}` : "/api/admin/webhooks";
      const body = editWebhook ? { ...webhookData, isActive: editWebhook.active } : webhookData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowAdd(false);
        setEditWebhook(null);
        // Refresh data
        window.location.reload();
      }
    } catch (error) {
      console.error("Error saving webhook:", error);
    }
  }

  function handleTest(id: string) {
    setTesting(id);
    setTimeout(() => {
      setTesting(null);
      setTestResult({ id, ok: Math.random() > 0.2 });
      setTimeout(() => setTestResult(null), 3000);
    }, 1500);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-background-tertiary)" }}>
      <PageHeader
        title="Webhooks"
        sub="Endpoint registration, delivery logs, and test dispatches"
        right={<Btn variant="primary" onClick={() => setShowAdd(true)}>+ Add webhook</Btn>}
      />

      <div style={{ padding: "1rem 1.5rem .75rem", display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
        <StatCard label="Total webhooks"   value={String(webhooks.length)} sub="All clients" />
        <StatCard label="Active"           value={String(webhooks.filter((w) => w.active).length)} subColor={DT_GREEN} sub="" />
        <StatCard label="Failed (24h)"     value="4"  valColor={DT_RED}   sub="wh_004 Slack — retrying" />
        <StatCard label="Total deliveries" value={String(totalDeliveries)} sub="All time" />
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 1.5rem 1.5rem", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Webhook list */}
        <Card>
          <CardHead title="Registered endpoints" />
          <Tbl>
            <TblHead cols={["Name", "Client", "URL", "Trigger", "Status", "Success rate", "Last delivery", "Actions"]} />
            <tbody>
              {webhooks.map((w) => (
                <tr key={w.id}>
                  <Td style={{ fontWeight: 500 }}>{w.name}</Td>
                  <Td style={{ color: "var(--color-text-secondary)" }}>{w.client}</Td>
                  <Td>
                    <code style={{ fontSize: 10, fontFamily: "monospace", color: DT_CYAN }}>{w.url}</code>
                  </Td>
                  <Td style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>{w.trigger}</Td>
                  <Td>
                    {w.active
                      ? <span style={{ fontSize: 11, color: DT_GREEN, fontWeight: 500 }}>● Active</span>
                      : <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>○ Inactive</span>
                    }
                    {w.lastStatus === "failed" && (
                      <span style={{ fontSize: 10, color: DT_RED, display: "block", marginTop: 2 }}>Last: failed</span>
                    )}
                  </Td>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--color-border-tertiary)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${w.successRate}%`, background: w.successRate > 95 ? DT_GREEN : w.successRate > 85 ? DT_AMBER : DT_RED, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11 }}>{w.successRate}%</span>
                    </div>
                  </Td>
                  <Td style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>{w.lastDelivery}</Td>
                  <Td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Btn variant="xs" onClick={() => handleTest(w.id)}>
                        {testing === w.id ? "Testing…" : testResult?.id === w.id ? (testResult.ok ? "✓ OK" : "✕ Fail") : "Test"}
                      </Btn>
                      <Btn variant="xs" onClick={() => setEditWebhook(w)}>Edit</Btn>
                      <Btn variant="red" onClick={() => handleDelete(w.id)}>Delete</Btn>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </Card>

        {/* Delivery logs */}
        <Card>
          <CardHead title="Delivery log — last 24 hours" right={<Btn variant="xs" onClick={handleExport}>↓ Export</Btn>} />
          <Tbl>
            <TblHead cols={["Time", "Webhook", "Event", "Status", "HTTP code", "Latency", "Retries", ""]} />
            <tbody>
              {logs.map((d) => (
                <tr key={d.id} style={{ cursor: "pointer" }} onClick={() => setSelectedLog(selectedLog === d.id ? null : d.id)}>
                  <Td style={{ color: "var(--color-text-tertiary)", fontSize: 11, whiteSpace: "nowrap" }}>{d.time}</Td>
                  <Td style={{ fontWeight: 500, fontSize: 11 }}>{d.webhookName}</Td>
                  <Td style={{ fontFamily: "monospace", fontSize: 10, color: DT_CYAN }}>{d.event}</Td>
                  <Td>
                    <span style={{ fontSize: 11, fontWeight: 500, color: deliveryStatusColor[d.status] }}>
                      {d.status === "success" ? "✓" : d.status === "retrying" ? "↻" : "✕"} {d.status}
                    </span>
                  </Td>
                  <Td style={{ color: d.statusCode && d.statusCode < 300 ? DT_GREEN : DT_RED, fontSize: 11 }}>
                    {d.statusCode ?? "—"}
                  </Td>
                  <Td style={{ color: d.latencyMs > 2000 ? DT_RED : d.latencyMs > 500 ? DT_AMBER : DT_GREEN, fontSize: 11 }}>
                    {d.latencyMs ? `${d.latencyMs} ms` : "—"}
                  </Td>
                  <Td style={{ color: d.retries > 0 ? DT_AMBER : "var(--color-text-secondary)", fontSize: 11 }}>{d.retries}</Td>
                  <Td><Btn variant="xs" onClick={() => handlePayload(d.id)}>Payload</Btn></Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </Card>
      </div>

      {/* Add / Edit modal */}
      {(showAdd || editWebhook) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", width: 420, padding: "1.5rem" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16 }}>
              {editWebhook ? `Edit — ${editWebhook.name}` : "Add webhook"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Name</label>
                <Input placeholder="e.g. ZEP-RE deepfake alert" value={modalName} onChange={setModalName} style={{ width: "100%" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Client</label>
                <Select value={modalClient} onChange={setModalClient} style={{ width: "100%" }}>
                  {["ZEP-RE", "Innovex", "KE Guild", "Meridian Bank", "Internal"].map((c) => <option key={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Endpoint URL</label>
                <Input placeholder="https://api.client.com/hook" value={modalUrl} onChange={setModalUrl} style={{ width: "100%" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Trigger event</label>
                <Select value={modalTrigger} onChange={setModalTrigger} style={{ width: "100%" }}>
                  {["deepfake detected >80%", "deepfake detected >70%", "all scan completions", "review queue items", "credits below 20%"].map((t) => <option key={t}>{t}</option>)}
                </Select>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <Btn variant="primary" style={{ flex: 1 }} onClick={() => handleSaveWebhook({
                  name: modalName,
                  client: modalClient,
                  url: modalUrl,
                  trigger: modalTrigger,
                })}>
                  {editWebhook ? "Save changes" : "Register webhook"}
                </Btn>
                <Btn variant="default" onClick={() => { setShowAdd(false); setEditWebhook(null); }}>Cancel</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}