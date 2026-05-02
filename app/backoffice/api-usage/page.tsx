"use client";

import { useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  Card, CardHead, Btn, TblHead, Tbl, Td, PageHeader,
  Select, StatCard, DT_CYAN, DT_GREEN, DT_RED, DT_AMBER,
} from "../_components/ui";

const DAILY_CALLS = [
  { day: "Apr 12", zepre: 380, innovex: 210, keguild: 120, trial: 30 },
  { day: "Apr 13", zepre: 420, innovex: 185, keguild: 145, trial: 25 },
  { day: "Apr 14", zepre: 310, innovex: 240, keguild: 130, trial: 40 },
  { day: "Apr 15", zepre: 490, innovex: 290, keguild: 160, trial: 20 },
  { day: "Apr 16", zepre: 540, innovex: 310, keguild: 180, trial: 35 },
  { day: "Apr 17", zepre: 460, innovex: 270, keguild: 155, trial: 28 },
  { day: "Apr 18", zepre: 580, innovex: 350, keguild: 210, trial: 45 },
];

const LATENCY_DATA = [
  { day: "Apr 12", p50: 1200, p95: 3200, p99: 5100 },
  { day: "Apr 13", p50: 1150, p95: 3100, p99: 4900 },
  { day: "Apr 14", p50: 1300, p95: 3600, p99: 5800 },
  { day: "Apr 15", p50: 1100, p95: 2900, p99: 4600 },
  { day: "Apr 16", p50: 1400, p95: 3800, p99: 6100 },
  { day: "Apr 17", p50: 1250, p95: 3300, p99: 5300 },
  { day: "Apr 18", p50: 1180, p95: 3150, p99: 5050 },
];

const ENDPOINTS = [
  { endpoint: "POST /v1/scans",              calls: 6240, pct: 68, errors: 12, errPct: 0.19, p95ms: 3840 },
  { endpoint: "GET /v1/scans/{id}",          calls: 2180, pct: 24, errors: 3,  errPct: 0.14, p95ms: 180  },
  { endpoint: "GET /v1/scans",               calls: 480,  pct: 5,  errors: 0,  errPct: 0.00, p95ms: 420  },
  { endpoint: "GET /v1/credits",             calls: 190,  pct: 2,  errors: 0,  errPct: 0.00, p95ms: 95   },
  { endpoint: "POST /v1/scans/{id}/dispute", calls: 50,   pct: 1,  errors: 1,  errPct: 2.00, p95ms: 210  },
];

const CLIENT_USAGE = [
  { client: "ZEP-RE",     plan: "Growth",     rpm: 42, rpmLimit: 200, total: 4280, errorPct: 0.12, rateHits: 0 },
  { client: "Innovex",    plan: "Starter",    rpm: 18, rpmLimit: 60,  total: 1780, errorPct: 0.22, rateHits: 3 },
  { client: "KE Guild",   plan: "Starter",    rpm: 11, rpmLimit: 60,  total: 842,  errorPct: 0.00, rateHits: 0 },
  { client: "Trial user", plan: "Trial",      rpm: 2,  rpmLimit: 10,  total: 238,  errorPct: 0.00, rateHits: 0 },
];

const planColor: Record<string, string> = {
  Growth: DT_CYAN, Starter: "var(--color-text-secondary)", Trial: "var(--color-text-tertiary)", Enterprise: DT_AMBER,
};

export default function ApiUsagePage() {
  const [window, setWindow] = useState("7d");
  const [activeClient, setActiveClient] = useState("All");

  function exportUsage() {
    const rows = ENDPOINTS.map((ep) => [
      ep.endpoint,
      ep.calls.toString(),
      `${ep.errPct.toFixed(2)}%`,
      `${ep.p95ms} ms`,
    ].join(","));
    const csv = ["endpoint,calls,error_rate,p95_ms", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "api_usage.csv";
    a.click();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-background-tertiary)" }}>
      <PageHeader
        title="API usage"
        sub="Call volume, latency, error rates and rate limit events"
        right={
          <>
            <Select value={window} onChange={setWindow}>
              {["24h", "7d", "30d", "90d"].map((w) => <option key={w}>{w}</option>)}
            </Select>
            <Btn variant="default" onClick={exportUsage}>↓ Export</Btn>
          </>
        }
      />

      {/* Stats */}
      <div style={{ padding: "1rem 1.5rem .75rem", display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10 }}>
        <StatCard label="Total API calls" value="9,140" sub="+24% vs last period" subColor={DT_GREEN} />
        <StatCard label="P95 latency" value="3,150 ms" sub="+640ms — monitor" subColor={DT_AMBER} />
        <StatCard label="Error rate" value="0.17%" sub="16 errors total" />
        <StatCard label="Rate limit hits" value="3" sub="Innovex · Starter plan" valColor={DT_AMBER} />
        <StatCard label="Active keys" value="7" sub="across 4 clients" />
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 1.5rem 1.5rem", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Call volume chart */}
        <Card>
          <CardHead
            title="Daily API call volume by client"
            right={
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--color-text-secondary)" }}>
                {[["ZEP-RE", DT_CYAN], ["Innovex", DT_GREEN], ["KE Guild", DT_AMBER], ["Trial", "#6B7280"]].map(([name, color]) => (
                  <span key={name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: color as string, display: "inline-block" }} />
                    {name}
                  </span>
                ))}
              </div>
            }
          />
          <div style={{ padding: "1rem", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DAILY_CALLS} barCategoryGap="30%" barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--color-border-tertiary)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6 }} />
                <Bar dataKey="zepre"    name="ZEP-RE"  fill={DT_CYAN}    radius={[2,2,0,0]} maxBarSize={18} />
                <Bar dataKey="innovex"  name="Innovex" fill={DT_GREEN}   radius={[2,2,0,0]} maxBarSize={18} />
                <Bar dataKey="keguild" name="KE Guild" fill={DT_AMBER}   radius={[2,2,0,0]} maxBarSize={18} />
                <Bar dataKey="trial"    name="Trial"   fill="#6B7280"    radius={[2,2,0,0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Two-column row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

          {/* Latency */}
          <Card>
            <CardHead title="Latency percentiles (ms)" />
            <div style={{ padding: "1rem", height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={LATENCY_DATA}>
                  <CartesianGrid vertical={false} stroke="var(--color-border-tertiary)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6 }} />
                  <Line dataKey="p50" name="P50" stroke={DT_GREEN} strokeWidth={1.5} dot={false} />
                  <Line dataKey="p95" name="P95" stroke={DT_AMBER} strokeWidth={1.5} dot={false} />
                  <Line dataKey="p99" name="P99" stroke={DT_RED}   strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ padding: "0 1rem .75rem", display: "flex", gap: 14 }}>
              {[["P50", "1,180 ms", DT_GREEN], ["P95", "3,150 ms", DT_AMBER], ["P99", "5,050 ms", DT_RED]].map(([label, val, color]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: color as string }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{val}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Endpoint breakdown */}
          <Card>
            <CardHead title="Endpoint breakdown" />
            <Tbl>
              <TblHead cols={["Endpoint", "Calls", "Errors", "P95"]} />
              <tbody>
                {ENDPOINTS.map((ep) => (
                  <tr key={ep.endpoint}>
                    <Td style={{ fontFamily: "monospace", fontSize: 11, color: DT_CYAN }}>{ep.endpoint}</Td>
                    <Td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--color-border-tertiary)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${ep.pct}%`, background: DT_CYAN, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 11 }}>{ep.calls.toLocaleString()}</span>
                      </div>
                    </Td>
                    <Td style={{ color: ep.errPct > 0.5 ? DT_RED : ep.errPct > 0 ? DT_AMBER : DT_GREEN }}>
                      {ep.errors} ({ep.errPct.toFixed(2)}%)
                    </Td>
                    <Td style={{ color: "var(--color-text-secondary)" }}>{ep.p95ms.toLocaleString()} ms</Td>
                  </tr>
                ))}
              </tbody>
            </Tbl>
          </Card>
        </div>

        {/* Per-client usage table */}
        <Card>
          <CardHead title="Usage by client" right={<span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Current RPM is sampled</span>} />
          <Tbl>
            <TblHead cols={["Client", "Plan", "Total calls", "Current RPM", "Rate limit", "Errors", "Rate limit hits"]} />
            <tbody>
              {CLIENT_USAGE.map((c) => (
                <tr key={c.client}>
                  <Td style={{ fontWeight: 500 }}>{c.client}</Td>
                  <Td style={{ color: planColor[c.plan] }}>{c.plan}</Td>
                  <Td>{c.total.toLocaleString()}</Td>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 50, height: 4, borderRadius: 2, background: "var(--color-border-tertiary)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${(c.rpm / c.rpmLimit) * 100}%`,
                          background: (c.rpm / c.rpmLimit) > 0.8 ? DT_RED : DT_GREEN,
                          borderRadius: 2,
                        }} />
                      </div>
                      <span style={{ fontSize: 11 }}>{c.rpm} / {c.rpmLimit}</span>
                    </div>
                  </Td>
                  <Td style={{ color: "var(--color-text-secondary)" }}>{c.rpmLimit} RPM</Td>
                  <Td style={{ color: c.errorPct > 0.5 ? DT_RED : c.errorPct > 0 ? DT_AMBER : "var(--color-text-secondary)" }}>
                    {c.errorPct.toFixed(2)}%
                  </Td>
                  <Td style={{ color: c.rateHits > 0 ? DT_RED : DT_GREEN }}>
                    {c.rateHits > 0 ? `${c.rateHits} hits` : "None"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </Card>
      </div>
    </div>
  );
}