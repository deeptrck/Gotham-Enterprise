"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  Card, CardHead, Btn, TblHead, Tbl, Td, PageHeader,
  StatCard, DT_CYAN, DT_GREEN, DT_RED, DT_AMBER,
} from "../_components/ui";

const PIPELINE_STEPS = [
  { step: "Label export",    status: "complete", time: "02:00 EAT", detail: "14 labels exported to R2 as JSONL" },
  { step: "ML notification", status: "complete", time: "02:01 EAT", detail: "Webhook fired to ML pipeline" },
  { step: "Augmentation",    status: "running",  time: "04:30 EAT", detail: "Dataset augmentation in progress" },
  { step: "Model retrain",   status: "pending",  time: "Est. 08:00 EAT", detail: "Waiting for augmentation" },
  { step: "Eval & validate", status: "pending",  time: "Est. 14:00 EAT", detail: "Automated eval suite" },
  { step: "Deploy",          status: "pending",  time: "Est. 16:00 EAT", detail: "Replace production weights" },
];

const INGESTION_QUEUE = [
  { export: "datasets/labels_2026-04-18.jsonl", labels: 14, size: "8.2 KB",  status: "augmented", date: "2026-04-18 02:00" },
  { export: "datasets/labels_2026-04-11.jsonl", labels: 22, size: "13.1 KB", status: "trained",   date: "2026-04-11 02:00" },
  { export: "datasets/labels_2026-04-04.jsonl", labels: 18, size: "10.8 KB", status: "trained",   date: "2026-04-04 02:00" },
  { export: "datasets/labels_2026-03-28.jsonl", labels: 31, size: "18.4 KB", status: "trained",   date: "2026-03-28 02:00" },
  { export: "datasets/labels_2026-03-21.jsonl", labels: 9,  size: "5.4 KB",  status: "archived",  date: "2026-03-21 02:00" },
];

const RETRAIN_JOBS = [
  { id: "rt_005", started: "2026-04-18 04:30", status: "running",  samples: 4834, duration: "~3h 30m remaining", accuracy: "—" },
  { id: "rt_004", started: "2026-03-28 06:00", status: "trained",  samples: 4820, duration: "6h 14m",            accuracy: "+1.2%" },
  { id: "rt_003", started: "2026-02-14 06:00", status: "trained",  samples: 3640, duration: "5h 02m",            accuracy: "+0.8%" },
  { id: "rt_002", started: "2026-01-10 06:00", status: "trained",  samples: 2100, duration: "4h 38m",            accuracy: "+2.1%" },
];

const LABEL_BY_TYPE = [
  { type: "Video",    queued: 5,  augmented: 8,  trained: 21 },
  { type: "Audio",    queued: 4,  augmented: 6,  trained: 14 },
  { type: "Image",    queued: 3,  augmented: 5,  trained: 12 },
  { type: "Document", queued: 2,  augmented: 3,  trained: 7  },
];

const stepColor: Record<string, string> = {
  complete: DT_GREEN, running: DT_CYAN, pending: "var(--color-text-tertiary)", failed: DT_RED,
};
const statusBg: Record<string, string> = {
  complete: "rgba(5,150,105,.12)", running: "rgba(0,168,204,.12)", pending: "var(--color-background-secondary)", failed: "rgba(220,38,38,.12)",
};
const jobStatusColor: Record<string, string> = {
  running: DT_CYAN, trained: DT_GREEN, failed: DT_RED, archived: "var(--color-text-tertiary)",
};

export default function PipelinePage() {
  const [showTrigger, setShowTrigger] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string>("");

  function exportJSONL() {
    const rows = INGESTION_QUEUE.map((entry) => [entry.export, String(entry.labels), entry.size, entry.status, entry.date].join(","));
    const csv = ["export,labels,size,status,date", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pipeline_exports.csv";
    a.click();
  }

  async function handleConfirmTrigger() {
    setTriggering(true);
    try {
      const res = await fetch("/api/admin/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "trigger_run" }),
      });
      if (res.ok) {
        setTriggerMessage("Pipeline run queued successfully.");
      } else {
        const errorData = await res.json();
        setTriggerMessage(errorData?.error || "Failed to trigger pipeline run.");
      }
    } catch (error) {
      console.error("Trigger pipeline error:", error);
      setTriggerMessage("Failed to trigger pipeline run.");
    } finally {
      setTriggering(false);
      setShowTrigger(false);
    }
  }

  function openLogs() {
    window.open("/backoffice/scan-log", "_blank");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-background-tertiary)" }}>
      <PageHeader
        title="Dataset pipeline"
        sub="Label ingestion, augmentation progress, and retrain job lifecycle"
        right={
          <>
            <Btn variant="default" onClick={exportJSONL}>↓ Export JSONL</Btn>
            <Btn variant="primary" onClick={() => setShowTrigger(true)}>▶ Trigger pipeline run</Btn>
          </>
        }
      />

      <div style={{ padding: "1rem 1.5rem .75rem", display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
        <StatCard label="Labels queued"     value="14"    sub="Ready for next export" valColor={DT_AMBER} />
        <StatCard label="Total labels"      value="154"   sub="All time" />
        <StatCard label="Active retrain"    value="1"     sub="rt_005 — running"      valColor={DT_CYAN} />
        <StatCard label="Next export"       value="02:00" sub="Daily · EAT" />
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 1.5rem 1.5rem", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Pipeline status flow */}
        <Card>
          <CardHead title="Current pipeline run — rt_005" right={
            <span style={{ fontSize: 11, color: DT_CYAN }}>● Augmentation in progress</span>
          } />
          <div style={{ padding: "1.25rem 1rem", display: "flex", alignItems: "flex-start", gap: 0, overflowX: "auto" }}>
            {PIPELINE_STEPS.map((s, i) => (
              <div key={s.step} style={{ display: "flex", alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 130 }}>
                  {/* Node */}
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: statusBg[s.status],
                    border: `1.5px solid ${stepColor[s.status]}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, marginBottom: 8,
                  }}>
                    {s.status === "complete" ? "✓" : s.status === "running" ? "↻" : "○"}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: stepColor[s.status], textAlign: "center" }}>{s.step}</div>
                  <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 2, textAlign: "center" }}>{s.time}</div>
                  <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", textAlign: "center", marginTop: 2, maxWidth: 110 }}>{s.detail}</div>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div style={{
                    width: 40, height: 1.5, marginTop: 15, flexShrink: 0,
                    background: i < 2 ? DT_GREEN : i < 3 ? DT_CYAN : "var(--color-border-tertiary)",
                  }} />
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Chart + ingestion queue */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 14 }}>
          <Card>
            <CardHead title="Labels by media type & status" />
            <div style={{ padding: "1rem", height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={LABEL_BY_TYPE} barCategoryGap="30%" barGap={2}>
                  <CartesianGrid vertical={false} stroke="var(--color-border-tertiary)" />
                  <XAxis dataKey="type" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6 }} />
                  <Bar dataKey="queued"    name="Queued"    fill={DT_AMBER} radius={[2,2,0,0]} maxBarSize={14} />
                  <Bar dataKey="augmented" name="Augmented" fill={DT_CYAN}  radius={[2,2,0,0]} maxBarSize={14} />
                  <Bar dataKey="trained"   name="Trained"   fill={DT_GREEN} radius={[2,2,0,0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHead title="Ingestion queue — JSONL exports" />
            <Tbl>
              <TblHead cols={["Export file", "Labels", "Size", "Status", "Date"]} />
              <tbody>
                {INGESTION_QUEUE.map((e) => (
                  <tr key={e.export}>
                    <Td style={{ fontFamily: "monospace", fontSize: 10, color: DT_CYAN }}>{e.export}</Td>
                    <Td style={{ color: "var(--color-text-secondary)" }}>{e.labels}</Td>
                    <Td style={{ color: "var(--color-text-secondary)" }}>{e.size}</Td>
                    <Td style={{ color: jobStatusColor[e.status], fontWeight: 500, fontSize: 11 }}>{e.status}</Td>
                    <Td style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>{e.date}</Td>
                  </tr>
                ))}
              </tbody>
            </Tbl>
          </Card>
        </div>

        {/* Retrain job history */}
        <Card>
          <CardHead title="Retrain job history" />
          <Tbl>
            <TblHead cols={["Job ID", "Started", "Status", "Samples", "Accuracy delta", "Duration", ""]} />
            <tbody>
              {RETRAIN_JOBS.map((r) => (
                <tr key={r.id}>
                  <Td style={{ fontFamily: "monospace", fontSize: 11, color: DT_CYAN }}>{r.id}</Td>
                  <Td style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>{r.started}</Td>
                  <Td>
                    {r.status === "running"
                      ? <span style={{ fontSize: 11, color: DT_CYAN, fontWeight: 500 }}>● Running</span>
                      : <span style={{ fontSize: 11, color: jobStatusColor[r.status], fontWeight: 500 }}>{r.status}</span>
                    }
                  </Td>
                  <Td style={{ color: "var(--color-text-secondary)" }}>{r.samples.toLocaleString()}</Td>
                  <Td style={{ color: r.accuracy.startsWith("+") ? DT_GREEN : "var(--color-text-secondary)" }}>{r.accuracy}</Td>
                  <Td style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>{r.duration}</Td>
                  <Td><Btn variant="xs">View logs</Btn></Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </Card>
      </div>

      {/* Trigger modal */}
      {showTrigger && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", width: 360, padding: "1.5rem" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8 }}>Trigger pipeline run</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 }}>
              This will export 14 queued labels to R2, notify the ML pipeline webhook, and queue a retrain job.
              This action cannot be undone.
            </div>
            <div style={{ padding: "10px 12px", background: "rgba(217,119,6,.08)", border: "0.5px solid rgba(217,119,6,.3)", borderRadius: "var(--border-radius-md)", fontSize: 11, color: DT_AMBER, marginBottom: 16 }}>
              ⚠ A retrain is already in progress (rt_005). Triggering now will queue a new job after completion.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="primary" style={{ flex: 1 }} onClick={handleConfirmTrigger} disabled={triggering}>
                {triggering ? "Triggering…" : "Confirm trigger"}
              </Btn>
              <Btn variant="default" onClick={() => setShowTrigger(false)} disabled={triggering}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}