"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from "recharts";
import {
  Card, CardHead, Btn, TblHead, Tbl, Td, PageHeader,
  StatCard, Select, Pill, DT_CYAN, DT_GREEN, DT_RED, DT_AMBER,
} from "../_components/ui";

const ACCURACY = [
  { week: "W1 Feb", fpRate: 2.1, fnRate: 1.4, accuracy: 96.5, confidence: 89.2 },
  { week: "W2 Feb", fpRate: 1.9, fnRate: 1.6, accuracy: 96.5, confidence: 90.1 },
  { week: "W3 Feb", fpRate: 2.3, fnRate: 1.2, accuracy: 96.5, confidence: 91.0 },
  { week: "W4 Feb", fpRate: 2.0, fnRate: 1.5, accuracy: 96.5, confidence: 91.8 },
  { week: "W1 Mar", fpRate: 1.7, fnRate: 1.8, accuracy: 96.5, confidence: 92.3 },
  { week: "W2 Mar", fpRate: 1.5, fnRate: 2.1, accuracy: 96.4, confidence: 92.0 },
  { week: "W3 Mar", fpRate: 1.8, fnRate: 1.9, accuracy: 96.3, confidence: 91.5 },
  { week: "W4 Mar", fpRate: 2.2, fnRate: 2.3, accuracy: 95.5, confidence: 90.8 },
  { week: "W1 Apr", fpRate: 2.4, fnRate: 2.5, accuracy: 95.1, confidence: 90.2 },
  { week: "W2 Apr", fpRate: 2.6, fnRate: 2.8, accuracy: 94.6, confidence: 89.8 },
  { week: "W3 Apr", fpRate: 2.8, fnRate: 3.1, accuracy: 94.1, confidence: 89.1 },
];

const BY_MEDIA = [
  { type: "Video",    fp: 2.1, fn: 3.4, accuracy: 94.5, threshold: 75, samples: 1840 },
  { type: "Audio",    fp: 3.8, fn: 2.9, accuracy: 93.3, threshold: 80, samples: 1120 },
  { type: "Image",    fp: 1.4, fn: 1.8, accuracy: 96.8, threshold: 70, samples: 980  },
  { type: "Document", fp: 1.0, fn: 1.2, accuracy: 97.8, threshold: 65, samples: 620  },
];

const RETRAIN_HISTORY = [
  { id: "rt_004", date: "2026-03-28", status: "trained",    samples: 4820, delta: "+1.2% accuracy", duration: "6h 14m" },
  { id: "rt_003", date: "2026-02-14", status: "trained",    samples: 3640, delta: "+0.8% accuracy", duration: "5h 02m" },
  { id: "rt_002", date: "2026-01-10", status: "trained",    samples: 2100, delta: "+2.1% accuracy", duration: "4h 38m" },
  { id: "rt_001", date: "2025-12-01", status: "trained",    samples: 1200, delta: "Baseline",       duration: "3h 55m" },
];

const LABEL_PIPELINE = [
  { id: "lp_014", scanId: "sc_7c4d9e1b", label: "authentic", reviewer: "Tauil M.", certainty: "certain", status: "queued",    age: "2h ago" },
  { id: "lp_013", scanId: "sc_4d7a0c3e", label: "authentic", reviewer: "Brian K.", certainty: "likely",  status: "augmented", age: "1d ago" },
  { id: "lp_012", scanId: "sc_2c3d4e5f", label: "deepfake",  reviewer: "Tauil M.", certainty: "certain", status: "augmented", age: "3d ago" },
  { id: "lp_011", scanId: "sc_5e6f7a8b", label: "deepfake",  reviewer: "Brian K.", certainty: "likely",  status: "trained",   age: "8d ago" },
];

const statusColor: Record<string, string> = {
  queued: DT_AMBER, augmented: DT_CYAN, trained: DT_GREEN, archived: "var(--color-text-tertiary)",
};
const statusVariant = (s: string) => s === "trained" ? "active" : s === "queued" ? "rev" : "proc";

export default function ModelFeedbackPage() {
  const [window, setWindow] = useState("12w");
  const [triggering, setTriggering] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  async function handleTriggerRetrain() {
    setTriggering(true);
    try {
      const res = await fetch("/api/admin/model-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "push_to_retrain" }),
      });
      if (res.ok) {
        setStatusMessage("Retrain job pushed to queue.");
      } else {
        const data = await res.json();
        setStatusMessage(data?.error || "Failed to trigger retrain.");
      }
    } catch (error) {
      console.error(error);
      setStatusMessage("Failed to trigger retrain.");
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-background-tertiary)" }}>
      <PageHeader
        title="Model feedback"
        sub="Accuracy trends, FP/FN rates, retraining queue, dataset pipeline"
        right={
          <>
            <Select value={window} onChange={setWindow}>
              {["4w", "12w", "6m"].map((w) => <option key={w}>{w}</option>)}
            </Select>
            <Btn variant="primary" onClick={handleTriggerRetrain} disabled={triggering}>
              {triggering ? "Triggering…" : "▶ Trigger retrain"}
            </Btn>
          </>
        }
      />

      <div style={{ padding: "1rem 1.5rem .75rem", display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10 }}>
        <StatCard label="Model accuracy"  value="94.1%"  sub="−2.4pts in 12 weeks"  subColor={DT_RED}   />
        <StatCard label="FP rate"         value="2.8%"   sub="+0.7pts — rising"     subColor={DT_RED}   valColor={DT_AMBER} />
        <StatCard label="FN rate"         value="3.1%"   sub="+1.7pts — rising"     subColor={DT_RED}   valColor={DT_AMBER} />
        <StatCard label="Labels queued"   value="14"     sub="Next export: 02:00 EAT" subColor="var(--color-text-secondary)" />
        <StatCard label="Avg confidence"  value="89.1%"  sub="−3.2pts audio drift"  subColor={DT_AMBER} />
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 1.5rem 1.5rem", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Accuracy trend + FP/FN rates */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
          <Card>
            <CardHead title="Model accuracy & confidence trend" right={<span style={{ fontSize: 10, color: DT_RED }}>⚠ Drift detected</span>} />
            <div style={{ padding: "1rem", height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ACCURACY}>
                  <CartesianGrid vertical={false} stroke="var(--color-border-tertiary)" />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis domain={[85, 100]} tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6 }} />
                  <Line dataKey="accuracy"   name="Accuracy %" stroke={DT_CYAN}  strokeWidth={2} dot={false} />
                  <Line dataKey="confidence" name="Avg conf %"  stroke={DT_GREEN} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHead title="FP / FN rates over time" />
            <div style={{ padding: "1rem", height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ACCURACY}>
                  <CartesianGrid vertical={false} stroke="var(--color-border-tertiary)" />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6 }} />
                  <Line dataKey="fpRate" name="FP rate %" stroke={DT_RED}   strokeWidth={2} dot={false} />
                  <Line dataKey="fnRate" name="FN rate %" stroke={DT_AMBER} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* By media type */}
        <Card>
          <CardHead title="Accuracy by media type" />
          <Tbl>
            <TblHead cols={["Media type", "Accuracy", "FP rate", "FN rate", "Auto-escalate threshold", "Total samples"]} />
            <tbody>
              {BY_MEDIA.map((m) => (
                <tr key={m.type}>
                  <Td style={{ fontWeight: 500 }}>{m.type}</Td>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 60, height: 5, borderRadius: 3, background: "var(--color-border-tertiary)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${m.accuracy}%`, background: m.accuracy > 96 ? DT_GREEN : m.accuracy > 93 ? DT_AMBER : DT_RED, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12 }}>{m.accuracy}%</span>
                    </div>
                  </Td>
                  <Td style={{ color: m.fp > 3 ? DT_RED : m.fp > 2 ? DT_AMBER : DT_GREEN }}>{m.fp}%</Td>
                  <Td style={{ color: m.fn > 3 ? DT_RED : m.fn > 2 ? DT_AMBER : DT_GREEN }}>{m.fn}%</Td>
                  <Td style={{ color: "var(--color-text-secondary)" }}>Escalate below {m.threshold}%</Td>
                  <Td style={{ color: "var(--color-text-secondary)" }}>{m.samples.toLocaleString()}</Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </Card>

        {/* Bottom row: label pipeline + retrain history */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Card>
            <CardHead title="Label pipeline" right={
              <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>Next export: 02:00 EAT</span>
            } />
            <Tbl>
              <TblHead cols={["Scan ID", "Label", "Reviewer", "Certainty", "Status"]} />
              <tbody>
                {LABEL_PIPELINE.map((l) => (
                  <tr key={l.id}>
                    <Td style={{ fontFamily: "monospace", fontSize: 10, color: DT_CYAN }}>{l.scanId}</Td>
                    <Td style={{ color: l.label === "deepfake" ? DT_RED : DT_GREEN, fontWeight: 500 }}>{l.label}</Td>
                    <Td style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>{l.reviewer}</Td>
                    <Td style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>{l.certainty}</Td>
                    <Td>
                      <span style={{ fontSize: 11, color: statusColor[l.status], fontWeight: 500 }}>{l.status}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tbl>
          </Card>

          <Card>
            <CardHead title="Retrain history" right={
            <Btn variant="primary" onClick={handleTriggerRetrain} disabled={triggering}>
              {triggering ? "Triggering…" : "▶ Trigger now"}
            </Btn>
          } />
            <Tbl>
              <TblHead cols={["Run ID", "Date", "Samples", "Outcome", "Duration"]} />
              <tbody>
                {RETRAIN_HISTORY.map((r) => (
                  <tr key={r.id}>
                    <Td style={{ fontFamily: "monospace", fontSize: 11, color: DT_CYAN }}>{r.id}</Td>
                    <Td style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>{r.date}</Td>
                    <Td style={{ color: "var(--color-text-secondary)" }}>{r.samples.toLocaleString()}</Td>
                    <Td style={{ color: DT_GREEN, fontSize: 11 }}>{r.delta}</Td>
                    <Td style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>{r.duration}</Td>
                  </tr>
                ))}
              </tbody>
            </Tbl>
            <div style={{ padding: "10px 12px", borderTop: "0.5px solid var(--color-border-tertiary)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
              Last retrain: 2026-03-28 · Next scheduled: 2026-04-28 (pending 14 queued labels)
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}