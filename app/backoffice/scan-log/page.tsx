"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Card, CardHead, Btn, TblHead, Tbl, Td, PageHeader,
  Input, Select, Pill, ConfBar, StatCard,
  DT_CYAN, DT_GREEN, DT_RED, DT_AMBER, verdictColor,
} from "../_components/ui";

import { formatDateHuman } from "@/lib/utils";
import { MediaType, Scan } from "@/app/backoffice/scan-log/scan";
import { useScanData } from "@/app/backoffice/scan-log/useScanData";

const verdictToVariant = (v: string) => {
  if (v === "authentic") return "auth";
  if (v === "deepfake") return "fake";
  if (v === "review") return "rev";
  return "proc";
};

const reviewBadge: Record<string, { label: string; color: string }> = {
  pending:      { label: "Pending",     color: DT_AMBER },
  confirmed:    { label: "Resolved ✓",  color: "var(--color-text-tertiary)" },
  dismissed:    { label: "Dismissed",   color: "var(--color-text-tertiary)" },
};

const mediaIcon: Record<MediaType, string> = {
  Video: "🎬", Audio: "🎙", Image: "🖼", Document: "📄",
};

export default function ScanLogPage() {
    const { scans, loading, error, total, summary, refetch } = useScanData();
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [filterVerdict, setFilterVerdict] = useState("All");
  const [filterReview, setFilterReview] = useState("All");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Scan | null>(null);
  const PER_PAGE = 8;

  const filtered = useMemo(() => {
    return scans.filter((s) => {
      if (filterClient !== "All" && s.client !== filterClient) return false;
      if (filterType !== "All" && s.type !== filterType.toLowerCase()) return false;
      if (filterVerdict !== "All" && s.verdict !== filterVerdict) return false;
      if (filterReview !== "All") {
        const filterVal = filterReview === "null" ? null : filterReview;
        if (s.reviewStatus !== filterVal) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!s.id.includes(q) && !s.client.toLowerCase().includes(q) && !s.file.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [scans,search, filterClient, filterType, filterVerdict, filterReview]);

  const pages = Math.ceil(filtered.length / PER_PAGE);
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const clients = ["All", ...Array.from(new Set(scans.map((s) => s.client)))];

  function exportCSV() {
    const header = "ID,Client,File,Type,Verdict,Confidence,Credits,Processing ms,Date\n";
    const body = filtered.map((s) =>
      `${s.id},${s.client},${s.file},${s.type},${s.verdict},${s.confidence},${s.credits},${s.processingMs},${s.date}`
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "scan_log.csv"; a.click();
  }

  async function handleRefresh() {
    await refetch();
  }

  async function handleReviewAction(scanId: string, action: "confirm_fp" | "confirm_fn") {
    try {
      const reviewStatus = action === "confirm_fp" ? "confirmed" : "confirmed";
      const feedbackType = action === "confirm_fp" ? "fp" : "fn";

      const res = await fetch("/api/admin/fp-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scanId, reviewStatus, feedbackType }),
      });

      if (res.ok) {
        await refetch(); // Refresh data
      }
    } catch (error) {
      console.error("Error updating review:", error);
    }
  }

  function handleCopyScanId(scanId: string) {
    navigator.clipboard.writeText(scanId).catch(() => {});
  }

  const totalScans = total;
  const deepfakes = summary.total_deepfakes;
  const pendingReview = summary.total_pending_review;
  const avgConfidence = summary.avg_confidence;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-background-tertiary)" }}>
      <PageHeader
        title="Scan log"
        sub="All scan submissions across all clients — real-time"
        right={
          <>
            <Btn variant="default" onClick={exportCSV}>↓ Export CSV</Btn>
            <Btn variant="primary" onClick={handleRefresh}>↻ Refresh</Btn>
          </>
        }
      />

      {/* Stats row */}
      <div style={{ padding: "1rem 1.5rem .75rem", display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
        <StatCard label="Total scans" value={totalScans.toLocaleString()} />
        <StatCard label="Deepfakes" value={deepfakes.toString()} />
        <StatCard label="Pending review" value={pendingReview.toString()} valColor={pendingReview > 0 ? DT_AMBER : undefined} />
        <StatCard label="Avg confidence" value={`${avgConfidence}%`} />
      </div>

      {/* Filters */}
      <div style={{ padding: "0 1.5rem .75rem", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Input placeholder="Search ID, client, filename…" value={search} onChange={(v) => { setSearch(v); setPage(1); }} style={{ width: 220 }} />
        <Select value={filterClient} onChange={(v) => { setFilterClient(v); setPage(1); }}>
          {clients.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select value={filterType} onChange={(v) => { setFilterType(v); setPage(1); }}>
          {["All", "Video", "Audio", "Image", "Document"].map((t) => <option key={t}>{t}</option>)}
        </Select>
        <Select value={filterVerdict} onChange={(v) => { setFilterVerdict(v); setPage(1); }}>
          {["All", "authentic", "deepfake", "review", "processing"].map((v) => <option key={v}>{v}</option>)}
        </Select>
        <Select value={filterReview} onChange={(v) => { setFilterReview(v); setPage(1); }}>
          {[
            ["All", "All"],
            ["null", "No review"],
            ["pending", "Pending"],
            ["confirmed", "Resolved"],
            ["dismissed", "Dismissed"],
          ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginLeft: 4 }}>
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Main content: table + optional drawer */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", gap: 0, padding: "0 1.5rem 1.5rem" }}>
        {/* Table */}
        <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
          <Card style={{ overflow: "visible" }}>
            <Tbl>
              <TblHead cols={["Scan ID", "Client",  "Type", "Verdict", "Confidence", "Review", "Time", "actions"]} />
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 12 }}>No scans match filters</td></tr>
                ) : rows.map((s) => (
                  <tr
                    key={s.id}
                    style={{ cursor: "pointer", background: selected?.id === s.id ? "rgba(0,168,204,.05)" : "transparent" }}
                    onClick={() => setSelected(selected?.id === s.id ? null : s)}
                  >
                    <Td style={{ fontFamily: "monospace", fontSize: 11, color: DT_CYAN }}>{s.id}</Td>
                    <Td style={{ fontWeight: 500 }}>{s.client}</Td>
                    {/* <Td style={{ color: "var(--color-text-secondary)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.file}</Td> */}
                    <Td style={{ color: "var(--color-text-secondary)" }}>{s.type}</Td>
                    <Td><Pill variant={verdictToVariant(s.verdict) as any}>{s.verdict}</Pill></Td>
                    <Td><ConfBar pct={s.confidence} color={verdictColor[s.verdict]} /></Td>
                    <Td>
                      <span style={{ fontSize: 11, color: reviewBadge[s.reviewStatus ?? ""]?.color ?? "var(--color-text-tertiary)" }}>
                        {reviewBadge[s.reviewStatus ?? ""]?.label ?? "—"}
                      </span>
                    </Td>
                    <Td style={{ color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>
                      {formatDateHuman(s.time)}
                      </Td>
                    <Td><Btn variant="xs" onClick={() => setSelected(s)}>View</Btn></Td>
                  </tr>
                ))}
              </tbody>
            </Tbl>

            {/* Pagination */}
            <div style={{ padding: "8px 12px", borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
              <Btn variant="xs" onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ opacity: page === 1 ? 0.4 : 1 }}>← Prev</Btn>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    width: 24, height: 24, borderRadius: "var(--border-radius-md)", fontSize: 11,
                    border: p === page ? `0.5px solid ${DT_CYAN}` : "0.5px solid var(--color-border-secondary)",
                    background: p === page ? `rgba(0,168,204,.12)` : "transparent",
                    color: p === page ? DT_CYAN : "var(--color-text-secondary)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {p}
                </button>
              ))}
              <Btn variant="xs" onClick={() => setPage((p) => Math.min(pages, p + 1))} style={{ opacity: page === pages ? 0.4 : 1 }}>Next →</Btn>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-text-tertiary)" }}>
                Page {page} of {pages} · {filtered.length} scans
              </span>
            </div>
          </Card>
        </div>

        {/* Detail drawer */}
        {selected && (
          <div
            style={{
              width: 320, flexShrink: 0, marginLeft: 12,
              background: "var(--color-background-primary)",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-lg)",
              overflow: "auto",
              display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ padding: ".65rem 1rem", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Scan detail</span>
              <button onClick={() => setSelected(null)} style={{ fontSize: 14, background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", fontFamily: "inherit" }}>✕</button>
            </div>

            <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Header */}
              <div>
                <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginBottom: 2, fontFamily: "monospace" }}>{selected.id}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)", wordBreak: "break-all" }}>{selected.file}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 3 }}>{selected.client} · {selected.date} {selected.time}</div>
              </div>

              {/* Verdict */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Pill variant={verdictToVariant(selected.verdict) as any}>{selected.verdict}</Pill>
                <ConfBar pct={selected.confidence} color={verdictColor[selected.verdict]} />
              </div>

              {/* Model scores */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 8 }}>Model scores</div>
                {[
                  { label: "Deeptrack Scan", val: selected.rdScore },
                  { label: "Deeptrack model",  val: selected.dtScore },
                  { label: "Ensemble",          val: selected.ensemble },
                ].map(({ label, val }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{label}</span>
                    <ConfBar pct={val} color={verdictColor[selected.verdict]} />
                  </div>
                ))}
              </div>

              {/* Meta */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 3 }}>Metadata</div>
                {[
                  ["Type", selected.type],
                  ["File size", selected.fileSize],
                  ...(selected.duration ? [["Duration", selected.duration]] : []),
                  ...(selected.codec ? [["Codec", selected.codec]] : []),
                  ["Credits used", String(selected.credits)],
                  ["Processing", `${selected.processingMs.toLocaleString()} ms`],
                  ["API key", selected.apiKey],
                  ["Review status", reviewBadge[selected.reviewStatus ?? ""]?.label ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "var(--color-text-tertiary)" }}>{k}</span>
                    <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Btn variant="primary" style={{ width: "100%", textAlign: "center" }} onClick={() => window.open(`/backoffice/forensics?scanId=${selected.id}`, '_blank')}>Open forensics</Btn>
                {(!selected.reviewStatus || selected.reviewStatus === "pending") && (
                  <>
                    <Btn variant="green" style={{ width: "100%", textAlign: "center" }} onClick={() => handleReviewAction(selected.id, "confirm_fp")}>Confirm FP</Btn>
                    <Btn variant="red" style={{ width: "100%", textAlign: "center" }} onClick={() => handleReviewAction(selected.id, "confirm_fn")}>Confirm FN</Btn>
                  </>
                )}
                <Btn variant="xs" style={{ width: "100%", textAlign: "center" }} onClick={() => handleCopyScanId(selected.id)}>Copy scan ID</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}