"use client";

import { useState, useEffect } from "react";
import {
  Card, CardHead, Btn, PageHeader, ConfBar,
  StatCard, Select, Input, Pill, DT_CYAN, DT_GREEN, DT_RED, DT_AMBER,
} from "../_components/ui";

interface ScanDetail {
  id: string;
  client: string;
  file: string;
  type: string;
  verdict: string;
  confidence: number;
  rdScore: number;
  dtScore: number;
  ensemble: number;
  fileSize: string;
  duration?: string;
  codec?: string;
  fps?: number;
  heatmap?: boolean;
  frames?: number;
  sampleRate?: number;
  spectrogram?: boolean;
  resolution?: string;
  pages?: number;
}

function useScansData() {
  const [scans, setScans] = useState<ScanDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/scans?limit=100", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const transformed = (data.scans || []).map((s: Record<string, unknown>) => ({
            id: s.id as string || "",
            client: s.client as string || "Unknown",
            file: s.id as string || "",
            type: (s.type as string || "image").replace(/^(video|audio|image)$/i, (m) => 
              m.charAt(0).toUpperCase() + m.slice(1).toLowerCase()
            ),
            verdict: (s.verdict as string) || "review",
            confidence: s.confidence as number || 0,
            rdScore: s.confidence as number || 0,
            dtScore: s.confidence as number || 0,
            ensemble: s.confidence as number || 0,
            fileSize: "",
            heatmap: true,
          }));
          setScans(transformed);
        }
      } catch (err) {
        console.error("Error fetching scans:", err);
        setError("Failed to load scans");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { scans, loading, error };
}

const verdictColor = (v: string) => v === "deepfake" ? DT_RED : v === "review" ? DT_AMBER : DT_GREEN;
const verdictVariant = (v: string) => v === "deepfake" ? "fake" : v === "review" ? "rev" : "auth";

const RD_SUBSCORES = [
  { label: "Face consistency",     score: 91.4 },
  { label: "Temporal coherence",   score: 96.8 },
  { label: "GAN artifact detect.", score: 93.2 },
  { label: "Lip sync accuracy",    score: 88.5 },
  { label: "Texture analysis",     score: 95.1 },
];

const FRAME_ANALYSIS = [
  { frame: "00:00:04", anomaly: 92.1, note: "Lip sync mismatch" },
  { frame: "00:00:18", anomaly: 97.4, note: "Face boundary artifact" },
  { frame: "00:00:41", anomaly: 88.3, note: "Temporal flicker" },
  { frame: "00:01:12", anomaly: 95.6, note: "Eye blink inconsistency" },
  { frame: "00:01:58", anomaly: 91.0, note: "Skin texture anomaly" },
];

export default function ForensicsPage() {
  const { scans, loading, error } = useScansData();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ScanDetail | null>(null);
  const [overlayMessage, setOverlayMessage] = useState<string>("");

  const results = query
    ? scans.filter((s) =>
        s.id.includes(query) || s.file.toLowerCase().includes(query.toLowerCase()) || s.client.toLowerCase().includes(query.toLowerCase())
      )
    : scans;

  useEffect(() => {
    if (scans.length > 0 && !selected) {
      setSelected(scans[0]);
    }
  }, [scans, selected]);

  function downloadReport() {
    if (!selected) return;
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.id}_forensics_report.json`;
    a.click();
  }

  function downloadOverlay() {
    if (!selected) return;
    const blob = new Blob([`Overlay for ${selected.id}\nType: ${selected.type}\nConfidence: ${selected.confidence}%`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.id}_overlay.txt`;
    a.click();
    setOverlayMessage("Overlay downloaded");
  }

  function openInQueue() {
    if (!selected) return;
    window.open(`/backoffice/fp-queue?scanId=${selected.id}`, "_blank");
  }

  function handleJumpTo(frame: string) {
    window.alert(`Jumping to ${frame} in the scan preview`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-background-tertiary)" }}>
      <PageHeader
        title="Scan forensics"
        sub="Deep-dive into individual scan results — model scores, heatmap, frame analysis"
      />

      <div style={{ flex: 1, overflow: "hidden", display: "flex", gap: 0, padding: "1rem 1.5rem 1.5rem" }}>

        {/* Left: scan selector */}
        <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, marginRight: 12 }}>
          <Input placeholder="Search scan ID or filename…" value={query} onChange={setQuery} style={{ width: "100%" }} />
          {loading ? (
            <div>Loading scans...</div>
          ) : error ? (
            <div>Error: {error}</div>
          ) : (
            results.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelected(s)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--border-radius-lg)",
                  border: `0.5px solid ${selected?.id === s.id ? DT_CYAN : "var(--color-border-tertiary)"}`,
                  background: selected?.id === s.id ? "rgba(0,168,204,.07)" : "var(--color-background-primary)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.file}</div>
                <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 2 }}>{s.client} · {s.type}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Pill variant={verdictVariant(s.verdict) as any}>{s.verdict}</Pill>
                  <ConfBar pct={s.confidence} color={verdictColor(s.verdict)} />
                </div>
                <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--color-text-tertiary)", marginTop: 3 }}>{s.id}</div>
              </div>
            ))
          )}
        </div>

        {/* Right: forensics detail */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {selected ? (
            <>
              {/* Header card */}
              <Card>
                <div style={{ padding: "1rem", display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 10, fontFamily: "monospace", color: DT_CYAN, marginBottom: 4 }}>{selected.id}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", wordBreak: "break-all", marginBottom: 4 }}>{selected.file}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Pill variant={verdictVariant(selected.verdict) as any}>{selected.verdict}</Pill>
                      <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{selected.client} · {selected.type} · {selected.fileSize}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn variant="primary" onClick={openInQueue}>Open in FP/FN queue</Btn>
                    <Btn variant="default" onClick={downloadReport}>↓ Download report</Btn>
                  </div>
                </div>
              </Card>

          {/* Score breakdown + RD sub-scores */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Card>
              <CardHead title="Model score breakdown" />
              <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { label: "Reality Defender",  val: selected.rdScore,   note: "External — weighted 40%" },
                  { label: "Deeptrack model",   val: selected.dtScore,   note: "Internal — weighted 60%" },
                  { label: "Ensemble (final)",  val: selected.ensemble,  note: "Combined verdict" },
                ].map(({ label, val, note }) => (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: verdictColor(selected.verdict) }}>{val}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "var(--color-border-tertiary)", overflow: "hidden", marginBottom: 3 }}>
                      <div style={{ height: "100%", width: `${val}%`, background: verdictColor(selected.verdict), borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{note}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHead title="Reality Defender sub-scores" />
              <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 10 }}>
                {RD_SUBSCORES.map(({ label, score }) => (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{label}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: score > 85 ? DT_RED : DT_AMBER }}>{score}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "var(--color-border-tertiary)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${score}%`, background: score > 85 ? DT_RED : DT_AMBER, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Heatmap / spectrogram */}
          <Card>
            <CardHead
              title={selected.type === "Audio" ? "Spectrogram analysis" : "Manipulation heatmap"}
              right={selected.heatmap || selected.type === "Audio" ? <Btn variant="xs">Download overlay</Btn> : null}
            />
            <div style={{ padding: "1rem" }}>
              {selected.heatmap || selected.type === "Audio" ? (
                <div
                  style={{
                    height: 160, borderRadius: "var(--border-radius-md)",
                    background: "linear-gradient(135deg, var(--color-background-secondary) 0%, rgba(220,38,38,.08) 40%, rgba(220,38,38,.22) 70%, rgba(220,38,38,.06) 100%)",
                    border: "0.5px solid var(--color-border-tertiary)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexDirection: "column", gap: 8,
                  }}
                >
                  <span style={{ fontSize: 28 }}>{selected.type === "Audio" ? "🌊" : "🔥"}</span>
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                    {selected.type === "Audio" ? "Spectrogram with anomaly markers" : "Heatmap overlay — red regions show manipulation probability"}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>Signed URL expires in 58 min — click Download to save</span>
                </div>
              ) : (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 12 }}>
                  Heatmap not available for this media type
                </div>
              )}
            </div>
          </Card>

          {/* Frame-level analysis (video only) */}
          {(selected.type === "Video" || selected.type === "Audio") && (
            <Card>
              <CardHead title={selected.type === "Video" ? "Frame-level anomaly detection" : "Audio segment analysis"} />
              <div style={{ padding: "0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {[selected.type === "Video" ? "Timestamp" : "Segment", "Anomaly score", "Note", ""].map((h) => (
                        <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", padding: "7px 12px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FRAME_ANALYSIS.map((f) => (
                      <tr key={f.frame}>
                        <td style={{ padding: "8px 12px", fontFamily: "monospace", color: DT_CYAN, fontSize: 11 }}>{f.frame}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 60, height: 5, borderRadius: 3, background: "var(--color-border-tertiary)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${f.anomaly}%`, background: f.anomaly > 90 ? DT_RED : DT_AMBER, borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, color: f.anomaly > 90 ? DT_RED : DT_AMBER }}>{f.anomaly}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--color-text-secondary)", fontSize: 11 }}>{f.note}</td>
                        <td style={{ padding: "8px 12px" }}><Btn variant="xs" onClick={() => handleJumpTo(f.frame)}>Jump to</Btn></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "10px 12px", borderTop: "0.5px solid var(--color-border-tertiary)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
                {selected.frames ? `${selected.frames.toLocaleString()} frames analysed · ` : ""}{FRAME_ANALYSIS.length} anomalous segments flagged
              </div>
            </Card>
          )}

          {/* Raw metadata */}
          <Card>
            <CardHead title="Raw metadata" />
            <div style={{ padding: "1rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                ["File size",      selected.fileSize],
                ["Media type",     selected.type],
                ...(selected.duration   ? [["Duration",      selected.duration]]               : []),
                ...(selected.codec      ? [["Codec",         selected.codec]]                  : []),
                ...(selected.fps        ? [["Frame rate",    `${selected.fps} fps`]]           : []),
                ...(selected.sampleRate ? [["Sample rate",   `${selected.sampleRate} Hz`]]     : []),
                ...(selected.resolution ? [["Resolution",    selected.resolution]]              : []),
                ...(selected.pages      ? [["Pages",         String(selected.pages)]]           : []),
                ["Client",         selected.client],
                ["Processing",     "3,840 ms"],
                ["Credits used",   "1"],
                ["Submitted",      "2026-04-18 14:32"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>{k}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
          ) : (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-tertiary)" }}>
              Select a scan to view forensics details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}