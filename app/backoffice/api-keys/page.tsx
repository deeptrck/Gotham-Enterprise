"use client";

import { useState, useEffect } from "react";
import {
  Card, CardHead, Btn, TblHead, Tbl, Td, PageHeader,
  StatCard, Select, Input, Pill, DT_CYAN, DT_GREEN, DT_RED, DT_AMBER,
} from "../_components/ui";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  client: string;
  env: "live" | "test";
  active: boolean;
  created: string;
  lastUsed: string | null;
  scans: number;
}

// ─── Data fetching ───────────────────────────────────────────────────────────

function useApiKeysData() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/api-keys", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const transformed = (data.keys || []).map((k: Record<string, unknown>) => ({
            id: k.id as string || "",
            name: k.name as string || "API Key",
            prefix: k.prefix as string || "",
            client: k.client as string || "Unknown",
            env: (k.env as string) as "live" | "test" || "test",
            active: k.is_active as boolean ?? true,
            created: k.created_at ? new Date(k.created_at as string).toISOString().split("T")[0] : "",
            lastUsed: k.last_used ? new Date(k.last_used as string).toLocaleDateString() : null,
            scans: 0,
          }));
          setKeys(transformed);
        }
      } catch (err) {
        console.error("Error fetching API keys:", err);
        setError("Failed to load API keys");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { keys, loading, error };
}

export default function ApiKeysPage() {
  const { keys: apiKeys, loading, error } = useApiKeysData();
  const [filterClient, setFilterClient] = useState("All");
  const [filterEnv, setFilterEnv]       = useState("All");
  const [filterActive, setFilterActive] = useState("All");
  const [showCreate, setShowCreate]     = useState(false);
  const [newKey, setNewKey]             = useState<{ prefix: string; full: string } | null>(null);
  const [copied, setCopied]             = useState<string | null>(null);
  const [createClient, setCreateClient] = useState("ZEP-RE");
  const [createName, setCreateName]     = useState("");
  const [createEnv, setCreateEnv]       = useState("live");

  const filtered = apiKeys.filter((k) => {
    if (filterClient !== "All" && k.client !== filterClient)                  return false;
    if (filterEnv    !== "All" && k.env    !== filterEnv)                     return false;
    if (filterActive === "active"   && !k.active)                             return false;
    if (filterActive === "revoked"  &&  k.active)                             return false;
    return true;
  });

  const clients = ["All", ...Array.from(new Set(apiKeys.map((k) => k.client)))];

  async function handleRevoke(keyId: string) {
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/api-keys?id=${keyId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        // Refresh data
        window.location.reload();
      }
    } catch (error) {
      console.error("Error revoking API key:", error);
    }
  }

  async function handleCreateKey(client: string, name: string, env: string) {
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ client, name, env }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewKey({
          prefix: data.prefix || "gt_live_x9k2…7m4p",
          full: data.key || "gt_live_x9k2a8b3c1d4e5f6g7h8i9j0k1l2m3n4o5p",
        });
        setShowCreate(false);
        // Refresh data
        window.location.reload();
      }
    } catch (error) {
      console.error("Error creating API key:", error);
    }
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleCreate() {
    setNewKey({
      prefix: "gt_live_x9k2…7m4p",
      full:   "gt_live_x9k2a8b3c1d4e5f6g7h8i9j0k1l2m3n4o5p",
    });
    setShowCreate(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-background-tertiary)" }}>
      <PageHeader
        title="API keys"
        sub="All keys across all clients — create, revoke, filter by environment"
        right={<Btn variant="primary" onClick={() => setShowCreate(true)}>+ Create API key</Btn>}
      />

      <div style={{ padding: "1rem 1.5rem .75rem", display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
        <StatCard label="Total keys"    value={String(apiKeys.length)} sub="All clients" />
        <StatCard label="Active"        value={String(apiKeys.filter((k) => k.active).length)}  subColor={DT_GREEN} sub="Accepting requests" />
        <StatCard label="Revoked"       value={String(apiKeys.filter((k) => !k.active).length)} valColor={DT_RED} sub="" />
        <StatCard label="Live keys"     value={String(apiKeys.filter((k) => k.env === "live" && k.active).length)} sub="Production traffic" />
      </div>

      {/* Filters */}
      <div style={{ padding: "0 1.5rem .75rem", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Select value={filterClient} onChange={setFilterClient}>
          {clients.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select value={filterEnv} onChange={setFilterEnv}>
          {["All", "live", "test"].map((e) => <option key={e}>{e}</option>)}
        </Select>
        <Select value={filterActive} onChange={setFilterActive}>
          {[["All", "All"], ["active", "Active only"], ["revoked", "Revoked only"]].map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 1.5rem 1.5rem" }}>
        <Card>
          <Tbl>
            <TblHead cols={["Name", "Client", "Key prefix", "Environment", "Status", "Last used", "Scans", "Actions"]} />
            <tbody>
              {filtered.map((k) => (
                <tr key={k.id}>
                  <Td style={{ fontWeight: 500 }}>{k.name}</Td>
                  <Td style={{ color: "var(--color-text-secondary)" }}>{k.client}</Td>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <code style={{ fontSize: 11, fontFamily: "monospace", color: DT_CYAN, background: "rgba(0,168,204,.08)", padding: "2px 6px", borderRadius: 4 }}>
                        {k.prefix}
                      </code>
                      <button
                        onClick={() => handleCopy(k.prefix, k.id)}
                        style={{ fontSize: 11, background: "none", border: "none", cursor: "pointer", color: copied === k.id ? DT_GREEN : "var(--color-text-tertiary)", fontFamily: "inherit", padding: 0 }}
                      >
                        {copied === k.id ? "✓" : "⧉"}
                      </button>
                    </div>
                  </Td>
                  <Td><Pill variant={k.env as any}>{k.env}</Pill></Td>
                  <Td>
                    {k.active
                      ? <span style={{ fontSize: 11, color: DT_GREEN, fontWeight: 500 }}>● Active</span>
                      : <span style={{ fontSize: 11, color: DT_RED,   fontWeight: 500 }}>✕ Revoked</span>
                    }
                  </Td>
                  <Td style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>{k.lastUsed ?? "Never"}</Td>
                  <Td style={{ color: "var(--color-text-secondary)" }}>{k.scans.toLocaleString()}</Td>
                  <Td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Btn variant="xs" onClick={() => handleCopy(k.prefix, `copy-${k.id}`)}>Copy</Btn>
                      {k.active
                        ? <Btn variant="red" onClick={() => handleRevoke(k.id)}>Revoke</Btn>
                        : <Btn variant="xs" style={{ opacity: 0.5 }}>Revoked</Btn>
                      }
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        </Card>
      </div>

      {/* Create key modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", width: 400, padding: "1.5rem" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16 }}>Create API key</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Client</label>
                <Select value={createClient} onChange={setCreateClient} style={{ width: "100%" }}>
                  {["ZEP-RE", "Innovex", "KE Guild", "Meridian Bank", "Trial user"].map((c) => <option key={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Key name (human label)</label>
                <Input placeholder="e.g. ZEP-RE production v2" value={createName} onChange={setCreateName} style={{ width: "100%" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Environment</label>
                <Select value={createEnv} onChange={setCreateEnv} style={{ width: "100%" }}>
                  <option>live</option>
                  <option>test</option>
                </Select>
              </div>
              <div style={{ padding: "8px 10px", background: "rgba(220,38,38,.06)", border: "0.5px solid rgba(220,38,38,.2)", borderRadius: "var(--border-radius-md)", fontSize: 11, color: DT_AMBER }}>
                ⚠ The full key is shown only once on creation. It cannot be retrieved after creation — only revoked.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <Btn variant="primary" style={{ flex: 1 }} onClick={() => handleCreateKey(createClient, createName, createEnv)}>Generate key</Btn>
                <Btn variant="default" onClick={() => setShowCreate(false)}>Cancel</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New key reveal modal */}
      {newKey && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", width: 440, padding: "1.5rem" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: DT_GREEN, marginBottom: 8 }}>✓ API key created</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12 }}>
              Copy this key now. You will not be able to see the full key again.
            </div>
            <div style={{
              padding: "10px 12px", background: "rgba(0,168,204,.08)", border: `0.5px solid ${DT_CYAN}`, borderRadius: "var(--border-radius-md)",
              fontFamily: "monospace", fontSize: 12, color: DT_CYAN, wordBreak: "break-all", marginBottom: 12,
            }}>
              {newKey.full}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="primary" style={{ flex: 1 }} onClick={() => handleCopy(newKey.full, "new")}>
                {copied === "new" ? "✓ Copied!" : "Copy to clipboard"}
              </Btn>
              <Btn variant="default" onClick={() => setNewKey(null)}>Done</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}