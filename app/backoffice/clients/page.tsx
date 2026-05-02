"use client";

import { useState, useEffect } from "react";
import {
  Card, CardHead, Btn, TblHead, Tbl, Td, PageHeader,
  StatCard, Select, Input, Pill, DT_CYAN, DT_GREEN, DT_RED, DT_AMBER,
} from "../_components/ui";

interface Client {
  id: string;
  name: string;
  slug: string;
  plan: "Trial" | "Starter" | "Growth" | "Enterprise";
  status: "active" | "suspended" | "trial_expired";
  email: string;
  credits: number;
  creditLimit: number;
  apiKeys: number;
  scans: number;
  created: string;
  lastActivity: string;
}

// ─── Data fetching ───────────────────────────────────────────────────────────

function useClientsData() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClients() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/clients?limit=100", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const transformed = (data.clients || []).map((c: Record<string, unknown>) => ({
            id: c.id as string || "",
            name: c.name as string || "Unknown",
            slug: (c.name as string || "").toLowerCase().replace(/\s+/g, "-"),
            plan: (c.plan as string || "starter").charAt(0).toUpperCase() + (c.plan as string || "starter").slice(1).toLowerCase() as Client["plan"],
            status: "active" as const,
            email: c.email as string || "",
            credits: c.credits_remaining as number || 0,
            creditLimit: c.total as number || 0,
            apiKeys: 0,
            scans: c.calls as number || 0,
            created: c.created_at ? new Date(c.created_at as string).toISOString().split("T")[0] : "",
            lastActivity: c.last_active ? new Date(c.last_active as string).toLocaleDateString() : "",
          }));
          setClients(transformed);
        }
      } catch (err) {
        console.error("Error fetching clients:", err);
        setError("Failed to load clients");
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, []);

  return { clients, loading, error };
}

const planVariant = (p: string) => p === "Growth" ? "growth" : p === "Enterprise" ? "enterprise" : p === "Trial" ? "trial" : "starter";
const statusVariant = (s: string) => s === "active" ? "active" : "suspended";

export default function ClientsPage() {
  const { clients, loading, error } = useClientsData();
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan]     = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showAdd, setShowAdd]           = useState(false);
  const [editClient, setEditClient]     = useState<Client | null>(null);
  const [modalName, setModalName]       = useState("");
  const [modalEmail, setModalEmail]     = useState("");
  const [modalSlug, setModalSlug]       = useState("");
  const [modalPlan, setModalPlan]       = useState("Starter");
  const [modalCreditLimit, setModalCreditLimit] = useState("");

  useEffect(() => {
    if (editClient) {
      setModalName(editClient.name);
      setModalEmail(editClient.email);
      setModalSlug(editClient.slug);
      setModalPlan(editClient.plan);
      setModalCreditLimit(String(editClient.creditLimit));
    } else {
      setModalName("");
      setModalEmail("");
      setModalSlug("");
      setModalPlan("Starter");
      setModalCreditLimit("");
    }
  }, [editClient]);

  const filtered = clients.filter((c) => {
    if (filterPlan   !== "All" && c.plan   !== filterPlan)   return false;
    if (filterStatus !== "All" && c.status !== filterStatus) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleSuspend(clientId: string) {
    try {
      const res = await fetch(`/api/admin/clients?id=${clientId}&action=suspend`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        // Refresh data
        window.location.reload();
      } else {
        alert("Failed to suspend client");
      }
    } catch (error) {
      console.error("Error suspending client:", error);
      alert("Error suspending client");
    }
  }

  async function handleReactivate(clientId: string) {
    try {
      const res = await fetch(`/api/admin/clients?id=${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: true }),
      });
      if (res.ok) {
        // Refresh data
        window.location.reload();
      } else {
        alert("Failed to reactivate client");
      }
    } catch (error) {
      console.error("Error reactivating client:", error);
      alert("Error reactivating client");
    }
  }

  async function handleDelete(clientId: string) {
    if (!confirm("Are you sure you want to delete this client? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/clients?id=${clientId}&action=delete`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        // Refresh data
        window.location.reload();
      } else {
        alert("Failed to delete client");
      }
    } catch (error) {
      console.error("Error deleting client:", error);
      alert("Error deleting client");
    }
  }

  async function handleSaveClient(clientData: Partial<Client>) {
    try {
      const method = editClient ? "PUT" : "POST";
      const url = editClient ? `/api/admin/clients?id=${editClient.id}` : "/api/admin/clients";
      const body = editClient ? { ...clientData, status: editClient.status } : clientData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowAdd(false);
        setEditClient(null);
        // Refresh data
        window.location.reload();
      }
    } catch (error) {
      console.error("Error saving client:", error);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-background-tertiary)" }}>
      <PageHeader
        title="Client accounts"
        sub="All client organisations — plans, status, credits and API access"
        right={<Btn variant="primary" onClick={() => setShowAdd(true)}>+ Add client</Btn>}
      />

      <div style={{ padding: "1rem 1.5rem .75rem", display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
        <StatCard label="Total clients"   value={String(clients.length)} sub="All time" />
        <StatCard label="Active"          value={String(clients.filter((c) => c.status === "active").length)} subColor={DT_GREEN} sub="Paying & trial" />
        <StatCard label="Suspended"       value={String(clients.filter((c) => c.status === "suspended").length)} valColor={DT_RED} sub="" />
        <StatCard label="Total scans"     value={clients.reduce((a, c) => a + c.scans, 0).toLocaleString()} sub="Across all clients" />
      </div>

      {/* Filters */}
      <div style={{ padding: "0 1.5rem .75rem", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Input placeholder="Search name or email…" value={search} onChange={setSearch} style={{ width: 220 }} />
        <Select value={filterPlan} onChange={setFilterPlan}>
          {["All", "Trial", "Starter", "Growth", "Enterprise"].map((p) => <option key={p}>{p}</option>)}
        </Select>
        <Select value={filterStatus} onChange={setFilterStatus}>
          {["All", "active", "suspended", "trial_expired"].map((s) => <option key={s}>{s}</option>)}
        </Select>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 1.5rem 1.5rem" }}>
        <Card>
          <Tbl>
            <TblHead cols={["Client", "Plan", "Status", "Email", "Credits", "API Keys", "Total scans", "Last active", "Actions"]} />
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <div style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", fontFamily: "monospace" }}>{c.slug}</div>
                  </Td>
                  <Td><Pill variant={planVariant(c.plan) as any}>{c.plan}</Pill></Td>
                  <Td><Pill variant={statusVariant(c.status) as any}>{c.status.replace("_", " ")}</Pill></Td>
                  <Td style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>{c.email}</Td>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--color-border-tertiary)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 2,
                          width: `${Math.round((1 - c.credits / c.creditLimit) * 100)}%`,
                          background: c.credits / c.creditLimit < 0.15 ? DT_RED : c.credits / c.creditLimit < 0.3 ? DT_AMBER : DT_GREEN,
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: "var(--color-text-primary)" }}>{c.credits.toLocaleString()}</span>
                      <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>/ {c.creditLimit.toLocaleString()}</span>
                    </div>
                  </Td>
                  <Td style={{ color: "var(--color-text-secondary)", textAlign: "center" }}>{c.apiKeys}</Td>
                  <Td style={{ color: "var(--color-text-secondary)" }}>{c.scans.toLocaleString()}</Td>
                  <Td style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>{c.lastActivity}</Td>
                  <Td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Btn variant="xs" onClick={() => setEditClient(c)}>Edit</Btn>
                      {c.status === "active"
                        ? <Btn variant="amber" style={{ fontSize: 11, padding: "3px 9px" }} onClick={() => handleSuspend(c.id)}>Suspend</Btn>
                        : <Btn variant="green" style={{ fontSize: 11, padding: "3px 9px" }} onClick={() => handleReactivate(c.id)}>Reactivate</Btn>
                      }
                      <Btn variant="red" onClick={() => handleDelete(c.id)}>Delete</Btn>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </Card>
      </div>

      {/* Add / Edit modal */}
      {(showAdd || editClient) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", width: 420, padding: "1.5rem" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16 }}>
              {editClient ? `Edit — ${editClient.name}` : "Add new client"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Organisation name", modalName, setModalName, "e.g. ZEP-RE"] as const,
                ["Billing email",     modalEmail, setModalEmail, "e.g. ops@client.com"] as const,
                ["Slug",              modalSlug, setModalSlug, "url-safe-slug"] as const,
              ].map(([label, val, setter, ph]) => (
                <div key={label}>
                  <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>{label}</label>
                  <Input placeholder={ph} value={val} onChange={setter} style={{ width: "100%" }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Plan</label>
                <Select value={modalPlan} onChange={setModalPlan} style={{ width: "100%" }}>
                  {["Trial", "Starter", "Growth", "Enterprise"].map((p) => <option key={p}>{p}</option>)}
                </Select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Monthly credit limit</label>
                <Input placeholder="e.g. 1000" value={modalCreditLimit} onChange={setModalCreditLimit} style={{ width: "100%" }} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Btn variant="primary" style={{ flex: 1 }} onClick={() => handleSaveClient({
                  name: modalName,
                  email: modalEmail,
                  slug: modalSlug,
                  plan: modalPlan as Client["plan"],
                  creditLimit: parseInt(modalCreditLimit) || 0,
                })}>
                  {editClient ? "Save changes" : "Create client"}
                </Btn>
                <Btn variant="default" onClick={() => { setShowAdd(false); setEditClient(null); }}>Cancel</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}