"use client";

import { useState } from "react";
import {
  Card, CardHead, Btn, PageHeader,
  Select, Input, DT_CYAN, DT_GREEN, DT_RED, DT_AMBER,
} from "../_components/ui";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "reviewer";
  lastLogin: string;
  mfa: boolean;
}

const ADMIN_USERS: AdminUser[] = [
  { id: "usr_001", name: "Brian K'Oyundi",  email: "brian@deeptrack.io",  role: "admin",    lastLogin: "2 min ago",  mfa: true  },
  { id: "usr_002", name: "Tauil M.",        email: "tauil@deeptrack.io",  role: "reviewer", lastLogin: "1h ago",     mfa: true  },
  { id: "usr_003", name: "Wanjiku N.",      email: "wanjiku@deeptrack.io",role: "reviewer", lastLogin: "2d ago",     mfa: false },
];

const MODEL_VERSIONS = [
  { id: "mv_004", version: "v4.1.2", released: "2026-03-28", accuracy: "94.1%", status: "active"   },
  { id: "mv_003", version: "v4.0.8", released: "2026-02-14", accuracy: "93.3%", status: "previous" },
  { id: "mv_002", version: "v3.9.1", released: "2026-01-10", accuracy: "92.5%", status: "archived" },
];

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Toggle({ value, onChange, label, sub }: { value: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 1 }}>{sub}</div>}
      </div>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 36, height: 20, borderRadius: 99, cursor: "pointer", flexShrink: 0, position: "relative",
          background: value ? DT_GREEN : "var(--color-border-secondary)", transition: "background .2s",
        }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: "50%", background: "#fff",
          position: "absolute", top: 3, left: value ? 19 : 3, transition: "left .2s",
        }} />
      </div>
    </div>
  );
}

function ThresholdRow({ label, sub, value, onChange, unit = "%", min = 0, max = 100 }: {
  label: string; sub?: string; value: number; onChange: (v: number) => void; unit?: string; min?: number; max?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="range" min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: 100, accentColor: DT_CYAN }}
        />
        <div style={{
          width: 52, textAlign: "center", fontSize: 12, fontWeight: 600,
          color: value > 80 ? DT_GREEN : value > 50 ? DT_AMBER : DT_RED,
          background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)",
          padding: "3px 8px", border: "0.5px solid var(--color-border-secondary)",
        }}>
          {value}{unit}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  // Scan thresholds
  const [deepfakeMin,   setDeepfakeMin]   = useState(75);
  const [reviewMin,     setReviewMin]     = useState(40);
  const [reviewMax,     setReviewMax]     = useState(74);
  const [audioAdj,      setAudioAdj]      = useState(5);
  const [videoAdj,      setVideoAdj]      = useState(0);

  // Notifications
  const [emailAlerts,   setEmailAlerts]   = useState(true);
  const [slackAlerts,   setSlackAlerts]   = useState(true);
  const [creditWarn,    setCreditWarn]    = useState(true);
  const [fpEscalation,  setFpEscalation]  = useState(true);
  const [weeklyReport,  setWeeklyReport]  = useState(true);
  const [modelDrift,    setModelDrift]    = useState(true);

  // Admin users
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>(ADMIN_USERS);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]  = useState("reviewer");

  // Model
  const [activeModel, setActiveModel] = useState("mv_004");

  // Saved banner
  const [saved, setSaved] = useState(false);
  function handleSave() { setSaved(true); setTimeout(() => setSaved(false), 2500); }

  async function handleRemoveUser(userId: string) {
    // In real implementation, call API to remove user
    setAdminUsers(prev => prev.filter(u => u.id !== userId));
    alert("User removed successfully");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-background-tertiary)" }}>
      <PageHeader
        title="Settings"
        sub="Platform configuration — thresholds, notifications, model version, admin users"
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {saved && <span style={{ fontSize: 11, color: DT_GREEN }}>✓ Saved</span>}
            <Btn variant="primary" onClick={handleSave}>Save all changes</Btn>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "1.25rem 1.5rem 2rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Scan thresholds */}
          <Card>
            <CardHead title="Scan verdict thresholds" right={
              <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>Applies to all new scans immediately</span>
            } />
            <div style={{ padding: "1rem 1.25rem" }}>
              <ThresholdRow
                label="Deepfake verdict minimum"
                sub={`Score ≥ ${deepfakeMin}% → verdict: deepfake`}
                value={deepfakeMin} onChange={setDeepfakeMin}
              />
              <ThresholdRow
                label="Review zone minimum"
                sub={`Score ≥ ${reviewMin}% and < ${reviewMax + 1}% → verdict: review`}
                value={reviewMin} onChange={setReviewMin}
              />
              <ThresholdRow
                label="Review zone maximum"
                sub={`Above this = deepfake. Below = authentic`}
                value={reviewMax} onChange={setReviewMax}
              />
              <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(0,168,204,.06)", border: "0.5px solid rgba(0,168,204,.2)", borderRadius: "var(--border-radius-md)", fontSize: 11, color: "var(--color-text-secondary)" }}>
                <strong style={{ color: DT_CYAN }}>Current logic:</strong> score ≥ {deepfakeMin}% → deepfake &nbsp;|&nbsp;
                {reviewMin}–{reviewMax}% → review &nbsp;|&nbsp; &lt;{reviewMin}% → authentic
              </div>
            </div>
          </Card>

          {/* Per-media adjustments */}
          <Card>
            <CardHead title="Per-media type threshold adjustments" right={
              <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>Applied on top of global thresholds</span>
            } />
            <div style={{ padding: "1rem 1.25rem" }}>
              <ThresholdRow
                label="Audio threshold adjustment"
                sub="Audio has higher FP rate — raise the bar by this many points"
                value={audioAdj} onChange={setAudioAdj} min={-20} max={20}
              />
              <ThresholdRow
                label="Video threshold adjustment"
                sub="0 = use global threshold with no adjustment"
                value={videoAdj} onChange={setVideoAdj} min={-20} max={20}
              />
              <div style={{ padding: "10px 0", display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {[
                  ["Image",    "0 pts", "Global only"],
                  ["Document", "0 pts", "Global only"],
                ].map(([type, adj, note]) => (
                  <div key={type} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "var(--color-text-secondary)" }}>{type}</span>
                    <span style={{ color: "var(--color-text-tertiary)" }}>{adj} — {note}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Model version */}
          <Card>
            <CardHead title="Model version" right={
              <span style={{ fontSize: 10, color: DT_AMBER }}>⚠ Switching model affects live traffic</span>
            } />
            <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: 8 }}>
              {MODEL_VERSIONS.map((mv) => (
                <div
                  key={mv.id}
                  onClick={() => setActiveModel(mv.id)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--border-radius-md)",
                    border: `0.5px solid ${activeModel === mv.id ? DT_CYAN : "var(--color-border-tertiary)"}`,
                    background: activeModel === mv.id ? "rgba(0,168,204,.07)" : "transparent",
                    cursor: mv.status !== "archived" ? "pointer" : "default",
                    opacity: mv.status === "archived" ? 0.55 : 1,
                    display: "flex", alignItems: "center", gap: 10,
                  }}
                >
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                    background: mv.status === "active" ? DT_GREEN : mv.status === "previous" ? DT_AMBER : "var(--color-text-tertiary)",
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>{mv.version}</span>
                      <span style={{ fontSize: 10, color: mv.status === "active" ? DT_GREEN : "var(--color-text-tertiary)" }}>
                        {mv.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 2 }}>
                      Released {mv.released} · Accuracy {mv.accuracy}
                    </div>
                  </div>
                  {activeModel === mv.id && (
                    <span style={{ fontSize: 10, color: DT_CYAN, fontWeight: 600 }}>SELECTED</span>
                  )}
                </div>
              ))}
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--color-text-tertiary)" }}>
                Model rollback to v4.0.8 takes ~30s. All in-flight scans complete on current version.
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Notification preferences */}
          <Card>
            <CardHead title="Notification preferences" />
            <div style={{ padding: "1rem 1.25rem" }}>
              <Toggle value={emailAlerts}  onChange={setEmailAlerts}  label="Email alerts" sub="Alert emails to all admins" />
              <Toggle value={slackAlerts}  onChange={setSlackAlerts}  label="Slack alerts" sub="Via wh_004 internal Slack webhook" />
              <Toggle value={creditWarn}   onChange={setCreditWarn}   label="Credit warnings" sub="When a client hits 80% usage" />
              <Toggle value={fpEscalation} onChange={setFpEscalation} label="FP/FN escalation alerts" sub="When auto-escalation triggers" />
              <Toggle value={weeklyReport} onChange={setWeeklyReport} label="Weekly summary report" sub="Emailed every Monday 08:00 EAT" />
              <Toggle value={modelDrift}   onChange={setModelDrift}   label="Model drift alerts" sub="When confidence drops > 3pts vs 30d avg" />

              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>Alert recipients</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {["brian@deeptrack.io", "tauil@deeptrack.io"].map((e) => (
                    <div key={e} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 10px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", fontSize: 11 }}>
                      <span style={{ color: "var(--color-text-primary)" }}>{e}</span>
                      <button style={{ fontSize: 11, color: DT_RED, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                    </div>
                  ))}
                  <Input placeholder="Add recipient email…" style={{ marginTop: 4 }} />
                </div>
              </div>
            </div>
          </Card>

          {/* Admin user management */}
          <Card>
            <CardHead title="Admin users" right={<Btn variant="primary" onClick={() => setShowInvite(true)}>+ Invite</Btn>} />
            <div style={{ padding: "0" }}>
              {adminUsers.map((u) => (
                <div key={u.id} style={{
                  padding: "12px 16px",
                  borderBottom: "0.5px solid var(--color-border-tertiary)",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: u.role === "admin" ? "rgba(0,168,204,.15)" : "rgba(217,119,6,.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 600,
                    color: u.role === "admin" ? DT_CYAN : DT_AMBER,
                  }}>
                    {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>{u.name}</span>
                      <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, fontWeight: 500,
                        background: u.role === "admin" ? "rgba(0,168,204,.12)" : "rgba(217,119,6,.1)",
                        color: u.role === "admin" ? DT_CYAN : DT_AMBER,
                      }}>
                        {u.role}
                      </span>
                      {!u.mfa && (
                        <span style={{ fontSize: 10, color: DT_RED }}>⚠ No MFA</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 2 }}>
                      {u.email} · Last login: {u.lastLogin}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Btn variant="xs" onClick={() => alert("Edit user functionality not implemented yet")}>Edit</Btn>
                    <Btn variant="red" onClick={() => handleRemoveUser(u.id)}>Remove</Btn>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Danger zone */}
          <Card style={{ border: `0.5px solid ${DT_RED}` }}>
            <CardHead title="⚠ Danger zone" />
            <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Flush Redis scan cache",   sub: "Clears all cached scan results. In-flight API calls may fail.", btn: "Flush cache" },
                { label: "Rotate platform API salt", sub: "Invalidates ALL existing API keys. All clients must re-issue keys.", btn: "Rotate salt" },
                { label: "Export full dataset",      sub: "Downloads all labelled scan data as encrypted ZIP for ML team.", btn: "Export ZIP" },
              ].map(({ label, sub, btn }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "0.5px solid rgba(220,38,38,.15)" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>{label}</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 1 }}>{sub}</div>
                  </div>
                  <Btn variant="red" onClick={() => alert(`${btn} functionality not implemented yet`)}>{btn}</Btn>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", width: 380, padding: "1.5rem" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16 }}>Invite admin user</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Email address</label>
                <Input placeholder="name@deeptrack.io" value={inviteEmail} onChange={setInviteEmail} style={{ width: "100%" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Role</label>
                <Select value={inviteRole} onChange={setInviteRole} style={{ width: "100%" }}>
                  <option value="reviewer">Reviewer — can view forensics + confirm FP/FN only</option>
                  <option value="admin">Admin — full back office access</option>
                </Select>
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", padding: "8px 10px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)" }}>
                An invite email will be sent via Clerk. The user must complete email verification and set up MFA before access is granted.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <Btn variant="primary" style={{ flex: 1 }} onClick={() => { alert("Invite sent successfully!"); setShowInvite(false); }}>Send invite</Btn>
                <Btn variant="default" onClick={() => setShowInvite(false)}>Cancel</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}