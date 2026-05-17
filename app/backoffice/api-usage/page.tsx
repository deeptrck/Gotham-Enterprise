"use client";

import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  Card, CardHead, Btn, TblHead, Tbl, Td, PageHeader,
  Select, StatCard, DT_CYAN, DT_GREEN, DT_RED, DT_AMBER,
} from "../_components/ui";

interface EndpointBreakdown {
  endpoint: string;
  calls: number;
  pct: number;
  errors: number;
  errPct: number;
  p95ms: number;
}

interface ApiUsageStats {
  totalCalls: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  errorCount: number;
  errorRate: number;
  activeKeys: number;
  clientCount: number;
  endpoints: EndpointBreakdown[];
  dailyVolume: Array<{ date: string; calls: number }>;
  latencyHistory: Array<{ date: string; p50: number; p95: number; p99: number }>;
}

export default function ApiUsagePage() {
  const [window, setWindow] = useState("7d");
  const [stats, setStats] = useState<ApiUsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(() => {
    const now = new Date();
    const days = window === "24h" ? 1 : window === "7d" ? 7 : window === "30d" ? 30 : 90;
    return {
      from: new Date(now.getTime() - days * 86400000).toISOString(),
      to: now.toISOString(),
    };
  }, [window]);

  useEffect(() => {
    async function fetchApiUsage() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/api-usage?from=${dateRange.from}&to=${dateRange.to}`,
          { credentials: "include" }
        );
        if (res.ok) setStats(await res.json());
      } finally {
        setLoading(false);
      }
    }
    fetchApiUsage();
  }, [dateRange]);

  const fmt = (n: number) => n.toLocaleString();
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

  function exportUsage() {
    const rows = (stats?.endpoints ?? []).map((ep) => [
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
        <StatCard
          label="Total API calls"
          value={loading ? "—" : fmt(stats?.totalCalls ?? 0)}
          sub={loading ? "" : `across ${stats?.clientCount ?? 0} clients`}
        />
        <StatCard
          label="P95 latency"
          value={loading ? "—" : `${fmt(stats?.p95Latency ?? 0)} ms`}
        />
        <StatCard
          label="Error rate"
          value={loading ? "—" : pct(stats?.errorRate ?? 0)}
          sub={loading ? "" : `${stats?.errorCount ?? 0} errors total`}
        />
        <StatCard
          label="Rate limit hits"
          value="—"
          sub="Not tracked yet"
          valColor="var(--color-text-tertiary)"
        />
        <StatCard
          label="Active keys"
          value={loading ? "—" : fmt(stats?.activeKeys ?? 0)}
          sub={loading ? "" : `across ${stats?.clientCount ?? 0} clients`}
        />
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 1.5rem 1.5rem", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Call volume chart */}
        <Card style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <CardHead title="Daily API call volume" />
          <div style={{ padding: "1rem", flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.dailyVolume ?? []}>
                <CartesianGrid vertical={false} stroke="var(--color-border-tertiary)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6 }} />
                <Line dataKey="calls" name="Calls" stroke={DT_CYAN} strokeWidth={2} dot={false} />
              </LineChart>
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
                <LineChart data={stats?.latencyHistory ?? []}>
                  <CartesianGrid vertical={false} stroke="var(--color-border-tertiary)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6 }} />
                  <Line dataKey="p50" name="P50" stroke={DT_GREEN} strokeWidth={1.5} dot={false} />
                  <Line dataKey="p95" name="P95" stroke={DT_AMBER} strokeWidth={1.5} dot={false} />
                  <Line dataKey="p99" name="P99" stroke={DT_RED}   strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ padding: "0 1rem .75rem", display: "flex", gap: 14 }}>
              {[
                ["P50", stats?.p50Latency ?? 0, DT_GREEN],
                ["P95", stats?.p95Latency ?? 0, DT_AMBER],
                ["P99", stats?.p99Latency ?? 0, DT_RED],
              ].map(([label, val, color]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: color as string }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{fmt(val as number)} ms</div>
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
                {(stats?.endpoints ?? []).map((ep) => (
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


      </div>
    </div>
  );
}