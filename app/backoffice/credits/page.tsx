"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  Card, CardHead, Btn, TblHead, Tbl, Td, PageHeader,
  StatCard, Select, Input, Pill, DT_CYAN, DT_GREEN, DT_RED, DT_AMBER,
} from "../_components/ui";

interface ClientCredits {
  name: string;
  plan: string;
  remaining: number;
  limit: number;
  used: number;
  pct: number;
  status: string;
}

interface LedgerEntry {
  id: string;
  client: string;
  type: string;
  amount: number;
  note: string;
  date: string;
}

// ─── Data fetching ───────────────────────────────────────────────────────────

function useCreditsData() {
  const [clients, setClients] = useState<ClientCredits[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [creditsRes, clientsRes] = await Promise.all([
          fetch("/api/admin/credits", { credentials: "include" }),
          fetch("/api/admin/clients?limit=100", { credentials: "include" }),
        ]);

        if (creditsRes.ok) {
          const creditsData = await creditsRes.json();
          setLedger((creditsData.ledger || []).map((l: Record<string, unknown>) => ({
            id: l.id as string || "",
            client: l.client_id as string || "Unknown",
            type: l.type as string || "deduction",
            amount: l.amount as number || 0,
            note: `Transaction ${l.id}`,
            date: l.created_at ? new Date(l.created_at as string).toLocaleString() : "",
          })));
        }

        if (clientsRes.ok) {
          const clientsData = await clientsRes.json();
          const transformed = (clientsData.clients || []).map((c: Record<string, unknown>) => ({
            name: c.name as string || "Unknown",
            plan: (c.plan as string) || "starter",
            remaining: c.credits_remaining as number || 0,
            limit: c.total as number || 0,
            used: c.used as number || 0,
            pct: (c.total as number) > 0 ? Math.round(((c.used as number) / (c.total as number)) * 100) : 0,
            status: "active",
          }));
          setClients(transformed);
        }
      } catch (err) {
        console.error("Error fetching credits:", err);
        setError("Failed to load credits");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { clients, ledger, loading, error };
}

const typeColor: Record<string, string> = {
  allocation: DT_GREEN, deduction: "var(--color-text-secondary)",
  refund: DT_CYAN, adjustment: DT_AMBER, expiry: DT_RED,
};
const planVariant = (p: string) => p === "Growth" ? "growth" : p === "Enterprise" ? "enterprise" : "starter";
const statusVariant = (s: string) => s === "active" ? "active" : "suspended";

export default function CreditsPage() {
  const { clients, ledger: ledgerData, loading, error } = useCreditsData();
  const [filterClient, setFilterClient] = useState("All");
  const [adjustClient, setAdjustClient] = useState("ZEP-RE");
  const [adjustAmt, setAdjustAmt]       = useState("");
  const [adjustNote, setAdjustNote]     = useState("");
  const [showAdjust, setShowAdjust]     = useState(false);

  const ledger = filterClient === "All" ? ledgerData : ledgerData.filter((l) => l.client === filterClient);

  async function handleApplyAdjustment() {
    try {
      const amount = parseInt(adjustAmt);
      if (isNaN(amount) || !adjustNote.trim()) {
        alert("Please enter a valid amount and note");
        return;
      }

      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clientId: adjustClient, // This might need to be the actual client ID, not name
          amount,
          note: adjustNote,
          type: "adjustment",
        }),
      });

      if (res.ok) {
        setShowAdjust(false);
        setAdjustAmt("");
        setAdjustNote("");
        // Refresh data
        window.location.reload();
      } else {
        alert("Failed to apply adjustment");
      }
    } catch (error) {
      console.error("Error applying adjustment:", error);
      alert("Error applying adjustment");
    }
  }

  const totalIssued = clients.reduce((sum, c) => sum + c.limit, 0);
  const totalConsumed = clients.reduce((sum, c) => sum + c.used, 0);
  const totalRemaining = clients.reduce((sum, c) => sum + c.remaining, 0);
  const nearLimitCount = clients.filter(c => c.pct >= 90).length;
  const nearLimitNames = clients.filter(c => c.pct >= 90).map(c => c.name).join(" · ");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-background-tertiary)" }}>
      <PageHeader
        title="Credits & billing"
        sub="Balance per client, ledger history, and manual adjustments"
        right={<Btn variant="primary" onClick={() => setShowAdjust(true)}>+ Adjust credits</Btn>}
      />

      {/* Stats */}
      <div style={{ padding: "1rem 1.5rem .75rem", display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
        <StatCard label="Total credits issued" value={totalIssued.toLocaleString()} sub="This billing cycle" />
        <StatCard label="Credits consumed" value={totalConsumed.toLocaleString()} sub={`${totalIssued > 0 ? Math.round((totalConsumed / totalIssued) * 100) : 0}% utilisation`} />
        <StatCard label="Credits remaining" value={totalRemaining.toLocaleString()} sub="Across all clients" />
        <StatCard label="Clients near limit" value={nearLimitCount.toString()} sub={nearLimitNames || "None"} valColor={nearLimitCount > 0 ? DT_AMBER : undefined} />
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 1.5rem 1.5rem", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Per-client balances */}
        <Card>
          <CardHead title="Credit balance by client" />
          <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 14 }}>
            {clients.map((c) => (
              <div key={c.name}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{c.name}</span>
                    <Pill variant={planVariant(c.plan) as any}>{c.plan}</Pill>
                    <Pill variant={statusVariant(c.status) as any}>{c.status.replace("_", " ")}</Pill>
                  </div>
                  <span style={{ fontSize: 12, color: c.pct >= 90 ? DT_RED : c.pct >= 70 ? DT_AMBER : DT_GREEN, fontWeight: 500 }}>
                    {c.remaining.toLocaleString()} / {c.limit.toLocaleString()} remaining
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "var(--color-border-tertiary)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    width: `${c.pct}%`,
                    background: c.pct >= 90 ? DT_RED : c.pct >= 70 ? DT_AMBER : DT_CYAN,
                    transition: "width .3s",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                  <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{c.used.toLocaleString()} used</span>
                  <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{c.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Chart + Ledger split */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 14 }}>

          {/* Monthly usage chart */}
          <Card>
            <CardHead title="Monthly credit usage" />
            <div style={{ padding: "1rem", height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { month: "Jan", zepre: 4200, innovex: 1800, keguild: 900 },
                  { month: "Feb", zepre: 3800, innovex: 2100, keguild: 750 },
                  { month: "Mar", zepre: 4500, innovex: 2400, keguild: 820 },
                  { month: "Apr", zepre: 4100, innovex: 1950, keguild: 680 },
                ]} barCategoryGap="30%" barGap={2}>
                  <CartesianGrid vertical={false} stroke="var(--color-border-tertiary)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 6 }} />
                  <Bar dataKey="zepre"   name="ZEP-RE"  fill={DT_CYAN}  radius={[2,2,0,0]} maxBarSize={14} />
                  <Bar dataKey="innovex" name="Innovex" fill={DT_GREEN} radius={[2,2,0,0]} maxBarSize={14} />
                  <Bar dataKey="keguild" name="KE Guild" fill={DT_AMBER} radius={[2,2,0,0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Ledger */}
          <Card>
            <CardHead
              title="Credit ledger"
              right={
                <Select value={filterClient} onChange={setFilterClient}>
                  {["All", ...clients.map((c) => c.name)].map((n) => <option key={n}>{n}</option>)}
                </Select>
              }
            />
            <Tbl>
              <TblHead cols={["Client", "Type", "Amount", "Note", "Date"]} />
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id}>
                    <Td style={{ fontWeight: 500 }}>{l.client}</Td>
                    <Td style={{ color: typeColor[l.type] }}>{l.type}</Td>
                    <Td style={{ fontWeight: 500, color: l.amount > 0 ? DT_GREEN : l.amount < 0 ? DT_RED : "var(--color-text-primary)" }}>
                      {l.amount > 0 ? "+" : ""}{l.amount}
                    </Td>
                    <Td style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>{l.note}</Td>
                    <Td style={{ color: "var(--color-text-tertiary)", whiteSpace: "nowrap", fontSize: 11 }}>{l.date}</Td>
                  </tr>
                ))}
              </tbody>
            </Tbl>
          </Card>
        </div>
      </div>

      {/* Adjust modal */}
      {showAdjust && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", width: 380, padding: "1.5rem" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16 }}>Adjust credits</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Client</label>
                <Select value={adjustClient} onChange={setAdjustClient} style={{ width: "100%" }}>
                  {clients.map((c) => <option key={c.name}>{c.name}</option>)}
                </Select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Amount (positive = top-up, negative = deduct)</label>
                <Input placeholder="e.g. 500 or -50" value={adjustAmt} onChange={setAdjustAmt} style={{ width: "100%" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Note (required for audit log)</label>
                <Input placeholder="Reason for adjustment…" value={adjustNote} onChange={setAdjustNote} style={{ width: "100%" }} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <Btn variant="primary" style={{ flex: 1 }} onClick={handleApplyAdjustment}>Apply adjustment</Btn>
                <Btn variant="default" onClick={() => setShowAdjust(false)}>Cancel</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}