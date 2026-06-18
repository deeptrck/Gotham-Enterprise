"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { formatDateHuman } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Verdict = "authentic" | "deepfake" | "review";

interface Scan {
  id: string;
  client: string;
  type: string;
  verdict: Verdict;
  confidence: number;
  time: string;
}

interface ClientCredit {
  id: string;
  name: string;
  email?: string;
  plan: "Growth" | "Starter" | "Trial" | "Enterprise";
  used: number;
  total: number;
  credits_remaining: number;
  calls: number;
}

interface FPItem {
  id: string;
  scan_id: string;
  icon: string;
  name: string;
  detail: string;
  meta: string;
  type: "fp" | "fn";
  confidence: number;
  status: string;
}

interface AlertItem {
  id: string;
  level: "error" | "warn" | "info";
  title: string;
  body: string;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  env: "live" | "test";
  is_active: boolean;
  client: string;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  trigger: string;
  client: string;
  is_active: boolean;
}

interface DashboardStats {
  scans_today: number;
  scans_total: number;
  active_clients: number;
  credits_used: number;
  avg_confidence: number;
  pending_review: number;
}

// ─── Data fetching hooks ─────────────────────────────────────────────────────

function useBackofficeData(duration: string) {
  const { user, isLoaded } = useUser();
  const [scans, setScans] = useState<Scan[]>([]);
  const [clients, setClients] = useState<ClientCredit[]>([]);
  const [fpItems, setFpItems] = useState<FPItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    scans_today: 0,
    scans_total: 0,
    active_clients: 0,
    credits_used: 0,
    avg_confidence: 0,
    pending_review: 0,
  });
  const [detectionScans, setDetectionScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(() => {
    const now = new Date();
    const days = duration === "Last 7 days" ? 7 : duration === "Last 90 days" ? 90 : 30;
    const from = new Date(now.getTime() - days * 86400000).toISOString();
    const to = now.toISOString();
    return { from, to };
  }, [duration]);

  useEffect(() => {
    async function fetchData() {
      if (!isLoaded || !user) return;
      
      setLoading(true);

      try {
        const [scansRes, clientsRes, fpRes, alertsRes, keysRes, webhooksRes, statsRes, detRes] = await Promise.all([
          fetch("/api/admin/scans?limit=23", { credentials: "include" }),
          fetch("/api/admin/clients", { credentials: "include" }),
          fetch("/api/admin/fp-queue?limit=10", { credentials: "include" }),
          fetch("/api/admin/alerts", { credentials: "include" }),
          fetch("/api/admin/api-keys", { credentials: "include" }),
          fetch("/api/admin/webhooks", { credentials: "include" }),
          fetch(`/api/admin/stats?from=${dateRange.from}&to=${dateRange.to}`, { credentials: "include" }),
          fetch(`/api/admin/scans?limit=5000&from=${dateRange.from}&to=${dateRange.to}`, { credentials: "include" }),
        ]);

        if (scansRes.ok) {
          const scansData = await scansRes.json();
          setScans(scansData.scans?.map((s: Record<string, unknown>) => ({
            id: s.id as string,
            client: s.client as string,
            type: s.type as string,
            verdict: s.verdict as Verdict,
            confidence: s.confidence as number,
            time: s.time as string,
          })) || []);
        }

        if (clientsRes.ok) {
          const clientsData = await clientsRes.json();
          setClients(clientsData.clients?.map((c: Record<string, unknown>) => ({
            id: c.id as string,
            name: c.name as string,
            email: c.email as string,
            plan: c.plan as "Growth" | "Starter" | "Trial" | "Enterprise",
            used: c.used as number,
            total: c.total as number,
            credits_remaining: c.credits_remaining as number,
            calls: c.calls as number,
          })) || []);
        }

        if (fpRes.ok) {
          const fpData = await fpRes.json();
          setFpItems(fpData.items?.map((item: Record<string, unknown>) => ({
            id: item.id as string,
            scan_id: item.scan_id as string,
            icon: item.icon as string,
            name: item.name as string,
            detail: item.detail as string,
            meta: item.meta as string,
            type: item.type as "fp" | "fn",
            confidence: item.confidence as number,
            status: item.status as string,
          })) || []);
        }

        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          setAlerts(alertsData.alerts || []);
        }

        if (keysRes.ok) {
          const keysData = await keysRes.json();
          setApiKeys(keysData.keys?.map((k: Record<string, unknown>) => ({
            id: k.id as string,
            name: k.name as string,
            prefix: k.prefix as string,
            env: k.env as "live" | "test",
            is_active: k.is_active as boolean,
            client: k.client as string,
          })) || []);
        }

        if (webhooksRes.ok) {
          const webhooksData = await webhooksRes.json();
          setWebhooks(webhooksData.webhooks?.map((w: Record<string, unknown>) => ({
            id: w.id as string,
            name: w.name as string,
            url: w.url as string,
            trigger: w.trigger as string,
            client: w.client as string,
            is_active: w.is_active as boolean,
          })) || []);
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats({
            scans_today: 0,
            scans_total: statsData.scans_total ?? 0,
            active_clients: statsData.active_clients ?? 0,
            credits_used: statsData.credits_used ?? 0,
            avg_confidence: statsData.avg_confidence ?? 0,
            pending_review: statsData.pending_review ?? 0,
          });
        }

        if (detRes.ok) {
          const detData = await detRes.json();
          setDetectionScans(detData.scans?.map((s: Record<string, unknown>) => ({
            id: s.id as string,
            client: s.client as string,
            type: s.type as string,
            verdict: s.verdict as Verdict,
            confidence: s.confidence as number,
            time: s.time as string,
          })) || []);
        }

      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Auto-refresh every 60 seconds
    const pollInterval = setInterval(() => {
      fetchData();
    }, 60000);

    return () => clearInterval(pollInterval);
  }, [isLoaded, user, dateRange]);

  return { scans, detectionScans, clients, fpItems, alerts, apiKeys, webhooks, stats, loading, setScans, setClients, setApiKeys, setWebhooks, setStats };
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

const DT_CYAN  = "#00A8CC";
const DT_GREEN = "#059669";
const DT_RED   = "#DC2626";
const DT_AMBER = "#D97706";

const verdictColor: Record<Verdict, string> = {
  authentic: DT_GREEN,
  deepfake:  DT_RED,
  review:    DT_AMBER,
};

// ─── Tiny shared primitives ───────────────────────────────────────────────────

function Pill({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "auth" | "fake" | "rev" | "proc" | "trial";
}) {
  const map = {
    auth:  { bg: "#EAF3DE", color: "#27500A" },
    fake:  { bg: "#FCEBEB", color: "#791F1F" },
    rev:   { bg: "#FAEEDA", color: "#633806" },
    proc:  { bg: "#E6F1FB", color: "#0C447C" },
    trial: { bg: "var(--color-background-secondary)", color: "var(--color-text-tertiary)" },
  };
  const s = map[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 11,
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: 99,
        whiteSpace: "nowrap",
        background: s.bg,
        color: s.color,
      }}
    >
      {children}
    </span>
  );
}

function ConfBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{
          height: 5,
          borderRadius: 3,
          background: "var(--color-border-tertiary)",
          overflow: "hidden",
          width: 50,
          flexShrink: 0,
        }}
      >
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{pct}%</span>
    </div>
  );
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--color-background-primary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-lg)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardHead({
  title,
  right,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: ".65rem 1rem",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{title}</span>
      {right && <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>{right}</div>}
    </div>
  );
}

function Btn({
  children,
  variant = "default",
  onClick,
  style,
  disabled,
}: {
  children: React.ReactNode;
  variant?: "default" | "primary" | "green" | "red" | "xs";
  onClick?: () => void;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const base: React.CSSProperties = {
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: "var(--border-radius-md)",
    background: "transparent",
    fontFamily: "inherit",
    opacity: disabled ? 0.6 : 1,
  };
  const variants: Record<string, React.CSSProperties> = {
    default:  { fontSize: 12, padding: "5px 12px", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)" },
    primary:  { fontSize: 12, padding: "5px 14px", background: DT_CYAN, color: "#fff", border: `0.5px solid ${DT_CYAN}` },
    green:    { fontSize: 11, padding: "3px 9px",  border: `0.5px solid ${DT_GREEN}`, color: DT_GREEN },
    red:      { fontSize: 11, padding: "3px 9px",  border: `0.5px solid ${DT_RED}`,   color: DT_RED   },
    xs:       { fontSize: 11, padding: "3px 9px",  border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

function TblHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr>
        {cols.map((c) => (
          <th
            key={c}
            style={{
              textAlign: "left",
              fontSize: 11,
              fontWeight: 500,
              color: "var(--color-text-secondary)",
              padding: "7px 10px",
              borderBottom: "0.5px solid var(--color-border-tertiary)",
              whiteSpace: "nowrap",
            }}
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Tbl({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 12,
        tableLayout: "fixed",
        ...style,
      }}
    >
      {children}
    </table>
  );
}

// ─── Modal Component ──────────────────────────────────────────────────────────

function Modal({ 
  isOpen, 
  title, 
  children, 
  onClose 
}: { 
  isOpen: boolean; 
  title: string; 
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!isOpen) return null;
  
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}>
      <div style={{
        background: "var(--color-background-primary)",
        borderRadius: 8,
        padding: "1.5rem",
        width: "90%",
        maxWidth: 500,
        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
        border: "1px solid var(--color-border-secondary)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--color-text-secondary)" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── New Client Modal ─────────────────────────────────────────────────────────

function NewClientModalContent({ 
  onClose, 
  setClients 
}: { 
  onClose: () => void; 
  setClients: (fn: (prev: ClientCredit[]) => ClientCredit[]) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("Starter");
  const [credits, setCredits] = useState(100);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, plan, credits }),
      });
      
      if (res.ok) {
        const newClient = await res.json();
        setClients(prev => [...prev, newClient]);
        onClose();
      } else {
        alert("Failed to create client");
      }
    } catch (err) {
      console.error("Error creating client:", err);
      alert("Error creating client");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Company Name</label>
        <input value={name} onChange={e => setName(e.target.value)} required
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, fontFamily: "inherit", color: "var(--color-text-primary)", background: "var(--color-background-primary)", boxSizing: "border-box" }} />
      </div>
      <div>
        <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" required
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, fontFamily: "inherit", color: "var(--color-text-primary)", background: "var(--color-background-primary)", boxSizing: "border-box" }} />
      </div>
      <div>
        <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Plan</label>
        <select value={plan} onChange={e => setPlan(e.target.value)}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, fontFamily: "inherit", color: "var(--color-text-primary)", background: "var(--color-background-primary)", boxSizing: "border-box" }}>
          <option value="Starter">Starter</option>
          <option value="Growth">Growth</option>
          <option value="Enterprise">Enterprise</option>
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Credits</label>
        <input value={credits} onChange={e => setCredits(Number(e.target.value))} type="number" min={1}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, fontFamily: "inherit", color: "var(--color-text-primary)", background: "var(--color-background-primary)", boxSizing: "border-box" }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", fontFamily: "inherit" }}>Cancel</button>
        <button type="submit" disabled={loading} style={{ flex: 1, padding: "10px", borderRadius: 6, border: "none", background: DT_CYAN, color: "white", cursor: loading ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 500, opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}>
          {loading ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
}

// ─── Page sections ────────────────────────────────────────────────────────────

function MetricsRow({ stats }: { stats: DashboardStats }) {
  const cards = [
    { label: "Total scans", value: stats.scans_total.toLocaleString()},
    { label: "Active clients", value: stats.active_clients.toString()},
    { label: "Credits used", value: stats.credits_used.toLocaleString()},
    { label: "Pending review", value: stats.pending_review.toString()},
    { label: "Avg confidence", value: `${stats.avg_confidence}%` },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10 }}>
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            background: "var(--color-background-secondary)",
            borderRadius: "var(--border-radius-md)",
            padding: ".75rem 1rem",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 3 }}>{c.label}</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)" }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function ScanLog({
  scans,
  duration,
}: {
  scans: Scan[];
  duration: string;
}) {
  const router = useRouter();
  const [searchId, setSearchId] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [verdictFilter, setVerdictFilter] = useState("All");

  const filtered = useMemo(() => {
    return scans.filter((s) => {
      const matchesSearch =
        searchId === "" ||
        s.id.toLowerCase().includes(searchId.toLowerCase()) ||
        s.client.toLowerCase().includes(searchId.toLowerCase());
      const matchesType = typeFilter === "All" || s.type === typeFilter;
      const matchesVerdict = verdictFilter === "All" || s.verdict === verdictFilter;
      return matchesSearch && matchesType && matchesVerdict;
    });
  }, [scans, searchId, typeFilter, verdictFilter]);

  return (
    <Card>
      <CardHead
        title="Scan log — recent"
        right={
          <>
            <input
              type="text"
              placeholder="Search ID / client…"
              value={searchId}
              onChange={e => setSearchId(e.target.value)}
              style={{
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: "var(--border-radius-md)",
                border: "0.5px solid var(--color-border-secondary)",
                background: "var(--color-background-primary)",
                color: "var(--color-text-primary)",
                width: 150,
                fontFamily: "inherit",
              }}
            />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", cursor: "pointer", fontFamily: "inherit" }}>
              <option value="All">All types</option><option value="video">Video</option><option value="audio">Audio</option><option value="image">Image</option>
            </select>
            <select value={verdictFilter} onChange={e => setVerdictFilter(e.target.value)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", cursor: "pointer", fontFamily: "inherit" }}>
              <option value="All">All verdicts</option><option value="authentic">Authentic</option><option value="deepfake">Deepfake</option><option value="review">Review</option>
            </select>
          </>
        }
      />
      <div style={{ overflowX: "auto" }}>
        <Tbl>
          <colgroup>
            <col style={{ width: 80 }} /><col style={{ width: 70 }} /><col style={{ width: 58 }} />
            <col style={{ width: 70 }} /><col style={{ width: 88 }} /><col style={{ width: 58 }} />
            <col style={{ width: 70 }} />
          </colgroup>
          <TblHead cols={["Scan ID", "Client", "Type", "Verdict", "Confidence", "Time", "Action"]} />
          <tbody>
            {filtered.map((s) => (
              <tr
                key={s.id}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).querySelectorAll("td").forEach(td => { td.style.background = "var(--color-background-secondary)"; }); }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).querySelectorAll("td").forEach(td => { td.style.background = ""; }); }}
              >
                <td style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", verticalAlign: "middle", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-secondary)" }}>{s.id}</td>
                <td style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", verticalAlign: "middle", color: "var(--color-text-primary)" }}>{s.client}</td>
                <td style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", verticalAlign: "middle" }}><Pill variant="proc">{s.type}</Pill></td>
                <td style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", verticalAlign: "middle" }}>
                  <Pill variant={s.verdict === "authentic" ? "auth" : s.verdict === "deepfake" ? "fake" : "rev"}>
                    {s.verdict === "authentic" ? "Authentic" : s.verdict === "deepfake" ? "Deepfake" : "Review"}
                  </Pill>
                </td>
                <td style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", verticalAlign: "middle" }}>
                  <ConfBar pct={s.confidence} color={verdictColor[s.verdict]} />
                </td>
                <td style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", verticalAlign: "middle", color: "var(--color-text-secondary)", fontSize: 11 }}>
                  {formatDateHuman(s.time)}
                  </td>
                <td style={{ padding: "4px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", verticalAlign: "middle" }}>
                  <Btn
                    variant="xs"
                    onClick={() => router.push(`/results/${s.id}`)}
                    style={{ 
                      width: "100%",
                      textAlign: "center",
                      ...(s.verdict === "review" ? { borderColor: DT_AMBER, color: DT_AMBER } : {}),
                    }}
                  >
                    {s.verdict === "review" ? "Review" : "View"}
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", padding: "6px 12px", borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "var(--color-text-tertiary)" }}>Showing {filtered.length} of {scans.length}</span>
        <span>← 1 2 3 … →</span>
      </div>
    </Card>
  );
}

function CreditUsage({ clients }: { clients: ClientCredit[] }) {
  const planVariant = (plan: ClientCredit["plan"]): "proc" | "auth" | "trial" =>
    plan === "Growth" || plan === "Enterprise" ? "proc" : plan === "Trial" ? "trial" : "auth";

  const planColor = (plan: ClientCredit["plan"]) => {
    if (plan === "Growth" || plan === "Enterprise") return DT_CYAN;
    if (plan === "Trial") return DT_RED;
    if (plan === "Starter") return DT_GREEN;
    return DT_AMBER;
  };

  return (
    <Card>
      <CardHead title="Credit usage by client" right={<Btn variant="default">Manage plans</Btn>} />
      <Tbl>
        <colgroup>
          <col style={{ width: 90 }} /><col style={{ width: 70 }} />
          <col /><col style={{ width: 64 }} />
        </colgroup>
        <TblHead cols={["Client", "Plan", "Credits used", "Calls"]} />
        <tbody>
          {clients.map((c) => {
            const pct = Math.round((c.used / c.total) * 100);
            return (
              <tr key={c.id}>
                <td style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", fontWeight: 500, color: "var(--color-text-primary)" }}>{c.name}</td>
                <td style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}><Pill variant={planVariant(c.plan)}>{c.plan}</Pill></td>
                <td style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 2 }}>{c.used.toLocaleString()} / {c.total.toLocaleString()}</div>
                  <div style={{ height: 7, borderRadius: 4, background: "var(--color-border-tertiary)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: planColor(c.plan), borderRadius: 4 }} />
                  </div>
                </td>
                <td style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-secondary)" }}>{c.calls.toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </Tbl>
    </Card>
  );
}

function MiniChart({ scans }: { scans: Scan[] }) {
  const fallbackBars = [53, 60, 97, 90, 72, 26, 19, 64, 71, 28, 100, 93, 66, 64];
  return (
    <Card>
      <CardHead title="Scan volume — last 14 days" />
      <div style={{ height: 32, display: "flex", alignItems: "flex-end", gap: 2, padding: "0 12px 8px" }}>
        {fallbackBars.map((v, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              borderRadius: "2px 2px 0 0",
              background: DT_CYAN,
              opacity: 0.7,
              height: `${v}%`,
              minWidth: 0,
            }}
          />
        ))}
      </div>
    </Card>
  );
}

function FPQueue({ items, onRefresh }: { items: FPItem[]; onRefresh: () => void }) {
  const [activeTab, setActiveTab] = useState<"fp" | "fn">("fp");
  const [processing, setProcessing] = useState<string | null>(null);
  const filtered = items.filter((f) => f.type === activeTab);
  const fpCount = items.filter((f) => f.type === "fp").length;
  const fnCount = items.filter((f) => f.type === "fn").length;

  async function handleAction(item: FPItem, action: "confirm" | "keep" | "forensics") {
    if (action === "forensics") {
      window.open(`/results/${item.scan_id}`, "_blank");
      return;
    }
    
    setProcessing(item.id);
    try {
      const reviewStatus = action === "keep" ? "dismissed" : "confirmed";
      const feedbackType = item.type; // fp or fn
      
      const res = await fetch("/api/admin/fp-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scanId: item.scan_id, reviewStatus, feedbackType }),
      });
      
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setProcessing(null);
    }
  }

  return (
    <Card>
      <CardHead
        title="False positive / negative queue"
        right={
          <>
            
            <span style={{ background: "#FAECE7", color: "#712B13", fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 99 }}>
              {fpCount + fnCount} pending
            </span>
          </>
        }
      />
      <div style={{ display: "flex", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "0 12px" }}>
        {(["fp", "fn"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              fontSize: 12,
              padding: "7px 10px",
              color: activeTab === t ? DT_CYAN : "var(--color-text-secondary)",
              cursor: "pointer",
              fontWeight: activeTab === t ? 500 : 400,
              background: "transparent",
              border: "none",
              borderBottom: activeTab === t ? `2px solid ${DT_CYAN}` : "2px solid transparent",
              marginBottom: -1,
              fontFamily: "inherit",
            }}
          >
            {t === "fp" ? `False positives (${fpCount})` : `False negatives (${fnCount})`}
          </button>
        ))}
      </div>
      {filtered.map((f) => (
        <div
          key={f.id}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "10px 12px",
            borderBottom: "0.5px solid var(--color-border-tertiary)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--border-radius-md)",
              background: "var(--color-background-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              flexShrink: 0,
              border: "0.5px solid var(--color-border-tertiary)",
            }}
          >
            {f.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{f.detail}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{f.meta}</div>
          </div>
          <div style={{ display: "flex", gap: 5, flexShrink: 0, flexWrap: "wrap" }}>
            <Btn variant="green" onClick={() => handleAction(f, "confirm")} disabled={processing === f.id}>
              Confirm
            </Btn>
            <Btn variant="red" onClick={() => handleAction(f, "keep")} disabled={processing === f.id}>
              Keep
            </Btn>
            <Btn variant="xs" onClick={() => handleAction(f, "forensics")}>
              Forensics
            </Btn>
          </div>
        </div>
      ))}
      <div style={{ padding: "6px 12px", fontSize: 11, color: "var(--color-text-tertiary)", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
        Reviewed items → retraining dataset pipeline automatically
      </div>
    </Card>
  );
}

function DetectionByType({ scans }: { scans: Scan[] }) {
  const typeStats = scans.reduce((acc, s) => {
    const t = s.type || "Unknown";
    if (!acc[t]) acc[t] = { scans: 0, fakes: 0, confTotal: 0 };
    acc[t].scans++;
    acc[t].confTotal += s.confidence;
    if (s.verdict === "deepfake") acc[t].fakes++;
    return acc;
  }, {} as Record<string, { scans: number; fakes: number; confTotal: number }>);

  const rows = Object.entries(typeStats)
    .map(([type, stats]) => {
      const rate = stats.scans > 0 ? (stats.fakes / stats.scans) * 100 : 0;
      const avgConf = stats.scans > 0 ? Math.round(stats.confTotal / stats.scans) : 0;
      return {
        type: type.charAt(0).toUpperCase() + type.slice(1),
        scans: stats.scans.toLocaleString(),
        fakes: stats.fakes.toLocaleString(),
        rate: `${rate.toFixed(1)}%`,
        conf: avgConf,
      };
    })
    .sort((a, b) => {
      const aNum = parseInt(a.scans.replace(/\D/g, ""), 10);
      const bNum = parseInt(b.scans.replace(/\D/g, ""), 10);
      return bNum - aNum;
    });

  return (
    <Card>
      <CardHead title="Detection by media type" />
      <Tbl>
        <colgroup>
          <col style={{ width: 70 }} /><col style={{ width: 52 }} />
          <col style={{ width: 52 }} /><col style={{ width: 64 }} /><col />
        </colgroup>
        <TblHead cols={["Type", "Scans", "Fakes", "Rate", "Avg conf"]} />
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: "16px", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 12 }}>
                No scan data available
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.type}>
                <td style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-primary)" }}>{r.type}</td>
                <td style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-primary)" }}>{r.scans}</td>
                <td style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-primary)" }}>{r.fakes}</td>
                <td style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)", color: "var(--color-text-primary)" }}>{r.rate}</td>
                <td style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                  <ConfBar pct={r.conf} color={DT_GREEN} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Tbl>
    </Card>
  );
}

function SystemAlerts({ alerts }: { alerts: AlertItem[] }) {
  const displayAlerts = alerts.length > 0 ? alerts : [
    { id: "1", title: "Innovex hitting credit limit", body: "Innovex (Starter) at 89% credits used.", level: "error" as const },
    { id: "2", title: "Model confidence drift — Audio", body: "7-day rolling avg audio confidence down 3.2pts.", level: "warn" as const },
    { id: "3", title: "Webhook delivery failure — Slack", body: "Internal Slack alert failing with HTTP 503.", level: "error" as const },
  ];

  return (
    <Card>
      <CardHead
        title="System alerts"
        right={
          <span style={{ background: "#FAECE7", color: "#712B13", fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 99 }}>
            {displayAlerts.length} active
          </span>
        }
      />
      {displayAlerts.map((a) => {
        const isError = a.level === "error";
        const bg = isError ? "#FCEBEB" : "#FAEEDA";
        const color = isError ? DT_RED : DT_AMBER;
        return (
          <div
            key={a.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "9px 12px",
              borderBottom: "0.5px solid var(--color-border-tertiary)",
              fontSize: 12,
            }}
          >
            <div style={{ width: 26, height: 26, borderRadius: "var(--border-radius-md)", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1L11 10H1L6 1Z" stroke={color} strokeWidth="1.2" fill="none" />
                <line x1="6" y1="5" x2="6" y2="7.5" stroke={color} strokeWidth="1.2" />
                <circle cx="6" cy="9" r=".5" fill={color} />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{a.title}</div>
              <div style={{ color: "var(--color-text-secondary)", marginTop: 2 }}>{a.body}</div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function ApiKeysPanel({ keys, setApiKeys }: { keys: ApiKey[]; setApiKeys: (fn: (prev: ApiKey[]) => ApiKey[]) => void }) {
  const displayKeys = keys.length > 0 ? keys : [
    { id: "1", name: "ZEP-RE production", prefix: "gt_live_9f2a…4c1d", env: "live" as const, is_active: true, client: "ZEP-RE" },
    { id: "2", name: "ZEP-RE staging", prefix: "gt_test_9f2a…8e3b", env: "test" as const, is_active: true, client: "ZEP-RE" },
    { id: "3", name: "Innovex integration", prefix: "gt_live_8e1b…7a2f", env: "live" as const, is_active: true, client: "Innovex" },
  ];

  async function revokeKey(keyId: string) {
    if (!confirm("Are you sure you want to revoke this key?")) return;
    
    try {
      const res = await fetch(`/api/admin/api-keys?id=${keyId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (res.ok) {
        setApiKeys(prev => prev.filter(k => k.id !== keyId));
      }
    } catch (err) {
      console.error("Error revoking key:", err);
    }
  }

  return (
    <Card>
      <CardHead title="API keys" right={<Btn variant="default">+ New key</Btn>} />
      {displayKeys.map((k) => (
        <div
          key={k.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderBottom: "0.5px solid var(--color-border-tertiary)",
            fontSize: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{k.name}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-secondary)", marginTop: 1 }}>{k.prefix}</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Pill variant={k.env === "live" ? "auth" : "trial"}>{k.env === "live" ? "Live" : "Test"}</Pill>
            <Btn variant="xs" onClick={() => revokeKey(k.id)}>Revoke</Btn>
          </div>
        </div>
      ))}
    </Card>
  );
}

function ModelFeedback() {
  const [loading, setLoading] = useState(false);

  async function handlePushToRetrain() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/model-feedback", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ action: "push_to_retrain" }),
      });
      
      if (res.ok) {
        alert("Pushed to retrain pipeline!");
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHead title="Model feedback loop" />
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
        {[
          { label: "Samples in retraining queue", value: "127", color: "var(--color-text-primary)" },
          { label: "Last retrain pushed", value: "Apr 14", color: "var(--color-text-primary)" },
          { label: "FP rate (30d)", value: "2.1%", color: DT_AMBER },
          { label: "FN rate (30d)", value: "1.4%", color: DT_AMBER },
        ].map((row) => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--color-text-secondary)" }}>{row.label}</span>
            <span style={{ fontWeight: 500, color: row.color }}>{row.value}</span>
          </div>
        ))}
        <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 8 }}>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 5 }}>Overall accuracy</div>
          <div style={{ height: 5, borderRadius: 3, background: "var(--color-border-tertiary)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "91%", background: DT_CYAN, borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>91.2% · target 95%</div>
        </div>
        <Btn variant="default" onClick={handlePushToRetrain} disabled={loading} style={{ alignSelf: "flex-start", fontSize: 11 }}>
          {loading ? "Pushing..." : "Push to retrain pipeline ↗"}
        </Btn>
      </div>
    </Card>
  );
}

function WebhooksPanel({ webhooks, setWebhooks }: { webhooks: Webhook[]; setWebhooks: (fn: (prev: Webhook[]) => Webhook[]) => void }) {
  const displayWebhooks = webhooks.length > 0 ? webhooks : [
    { id: "1", name: "ZEP-RE deepfake alert", url: "https://api.zepre.com/gt/hook", trigger: "deepfake detected >80%", client: "ZEP-RE", is_active: true },
    { id: "2", name: "Innovex scan complete", url: "https://innovex.io/webhooks/gt", trigger: "all scan completions", client: "Innovex", is_active: true },
    { id: "3", name: "KE Guild deepfake alert", url: "https://api.keguild.co.ke/hooks", trigger: "deepfake detected >70%", client: "KE Guild", is_active: true },
  ];

  async function deleteWebhook(webhookId: string) {
    if (!confirm("Delete this webhook?")) return;
    
    try {
      const res = await fetch(`/api/admin/webhooks?id=${webhookId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (res.ok) {
        setWebhooks(prev => prev.filter(w => w.id !== webhookId));
      }
    } catch (err) {
      console.error("Error:", err);
    }
  }

  return (
    <Card>
      <CardHead title="Webhook endpoints" right={<Btn variant="default">+ Add</Btn>} />
      {displayWebhooks.map((w) => (
        <div
          key={w.id}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "8px 12px",
            borderBottom: "0.5px solid var(--color-border-tertiary)",
            fontSize: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{w.name}</span>
            <div style={{ display: "flex", gap: 4 }}>
              <Pill variant="auth">Live</Pill>
              <Btn variant="xs" onClick={() => deleteWebhook(w.id)}>Delete</Btn>
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-secondary)" }}>{w.url}</div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{w.trigger}</div>
        </div>
      ))}
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BackofficePage() {
  const [duration, setDuration] = useState("Last 30 days");
  const { scans, detectionScans, fpItems, clients, alerts, apiKeys, webhooks, stats, setScans, setClients, setApiKeys, setWebhooks, setStats } = useBackofficeData(duration);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Gate access — check admin allowlist before rendering anything
  useEffect(() => {
    fetch("/api/admin/access", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.allowed) {
          setIsAdmin(true);
        } else {
          router.replace("/");
        }
      })
      .catch(() => router.replace("/"))
      .finally(() => setAdminChecked(true));
  }, [router]);

  if (!adminChecked) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "var(--color-text-secondary)", fontSize: 14 }}>
        Checking access...
      </div>
    );
  }

  if (!isAdmin) return null;

  function exportToCSV() {
    const csvData = scans.map(s => ({
      "Scan ID": s.id,
      Client: s.client,
      Type: s.type,
      Verdict: s.verdict,
      Confidence: s.confidence,
      Time: s.time,
    }));

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(","),
      ...csvData.map(row =>
        headers.map(h => {
          const val = String(row[h as keyof typeof row] ?? "");
          return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `scans_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  }

  return (
    <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Modal isOpen={showNewClientModal} title="Add New Client" onClose={() => setShowNewClientModal(false)}>
        <NewClientModalContent onClose={() => setShowNewClientModal(false)} setClients={setClients} />
      </Modal>

      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500, color: "var(--color-text-primary)" }}>Platform overview</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
            {today} {duration}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ background: "#FAECE7", color: "#712B13", fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 99 }}>
            {fpItems.length} items need review
          </span>
          <select value={duration} onChange={e => setDuration(e.target.value)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", cursor: "pointer", fontFamily: "inherit" }}>
            <option>Last 30 days</option><option>Last 7 days</option><option>Last 90 days</option>
          </select>
          <Btn variant="default" onClick={exportToCSV}>Export CSV</Btn>
          <Btn variant="primary" onClick={() => setShowNewClientModal(true)}>+ New client</Btn>
        </div>
      </div>

      {/* Metrics */}
      <MetricsRow stats={stats} />

      {/* Row 1: Scan log + right column */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <ScanLog scans={scans} duration={duration}/>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <CreditUsage clients={clients} />
          <MiniChart scans={scans} />
        </div>
      </div>

      {/* Row 2: FP queue + right column */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <FPQueue items={fpItems} onRefresh={() => {}} />
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <DetectionByType scans={detectionScans} />
          <SystemAlerts alerts={alerts} />
        </div>
      </div>

      {/* Row 3: Three columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
        <ApiKeysPanel keys={apiKeys} setApiKeys={setApiKeys} />
        <ModelFeedback />
        <WebhooksPanel webhooks={webhooks} setWebhooks={setWebhooks} />
      </div>
    </div>
  );
}