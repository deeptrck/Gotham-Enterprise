"use client";

export const DT_CYAN  = "#00A8CC";
export const DT_GREEN = "#059669";
export const DT_RED   = "#DC2626";
export const DT_AMBER = "#D97706";

export type Verdict = "authentic" | "deepfake" | "review" | "processing" | "error";

export const verdictColor: Record<string, string> = {
  authentic:  DT_GREEN,
  deepfake:   DT_RED,
  review:     DT_AMBER,
  processing: DT_CYAN,
  error:      DT_RED,
};

export function Pill({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "auth" | "fake" | "rev" | "proc" | "trial" | "err" | "live" | "test" | "active" | "suspended" | "growth" | "starter" | "enterprise";
}) {
  const map: Record<string, { bg: string; color: string }> = {
    auth:       { bg: "#EAF3DE", color: "#27500A" },
    fake:       { bg: "#FCEBEB", color: "#791F1F" },
    rev:        { bg: "#FAEEDA", color: "#633806" },
    proc:       { bg: "#E6F1FB", color: "#0C447C" },
    trial:      { bg: "var(--color-background-secondary)", color: "var(--color-text-tertiary)" },
    err:        { bg: "#FCEBEB", color: "#791F1F" },
    live:       { bg: "#EAF3DE", color: "#27500A" },
    test:       { bg: "#E6F1FB", color: "#0C447C" },
    active:     { bg: "#EAF3DE", color: "#27500A" },
    suspended:  { bg: "#FCEBEB", color: "#791F1F" },
    growth:     { bg: "rgba(0,168,204,.12)", color: DT_CYAN },
    starter:    { bg: "var(--color-background-secondary)", color: "var(--color-text-secondary)" },
    enterprise: { bg: "rgba(218,119,6,.12)", color: DT_AMBER },
  };
  const s = map[variant] ?? map.trial;
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

export function ConfBar({ pct, color }: { pct: number; color: string }) {
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

export function Card({
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

export function CardHead({
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
        flexWrap: "wrap",
        gap: 6,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{title}</span>
      {right && <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>{right}</div>}
    </div>
  );
}

export function Btn({
  children,
  variant = "default",
  onClick,
  style,
  disabled = false,
}: {
  children: React.ReactNode;
  variant?: "default" | "primary" | "green" | "red" | "xs" | "amber";
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
    default: { fontSize: 12, padding: "5px 12px", border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)" },
    primary: { fontSize: 12, padding: "5px 14px", background: DT_CYAN,  color: "#fff", border: `0.5px solid ${DT_CYAN}`  },
    green:   { fontSize: 11, padding: "3px 9px",  border: `0.5px solid ${DT_GREEN}`, color: DT_GREEN },
    red:     { fontSize: 11, padding: "3px 9px",  border: `0.5px solid ${DT_RED}`,   color: DT_RED   },
    xs:      { fontSize: 11, padding: "3px 9px",  border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)" },
    amber:   { fontSize: 11, padding: "3px 9px",  border: `0.5px solid ${DT_AMBER}`, color: DT_AMBER },
  };
  return (
    <button disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

export function TblHead({ cols }: { cols: string[] }) {
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

export function Tbl({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 12,
        ...style,
      }}
    >
      {children}
    </table>
  );
}

export function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td
      style={{
        padding: "8px 10px",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        color: "var(--color-text-primary)",
        verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "1.25rem 1.5rem .9rem",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      <div>
        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 2 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{sub}</div>}
      </div>
      {right && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{right}</div>}
    </div>
  );
}

export function Input({
  placeholder,
  value,
  onChange,
  style,
}: {
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  style?: React.CSSProperties;
}) {
  return (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        fontSize: 12,
        padding: "5px 10px",
        border: "0.5px solid var(--color-border-secondary)",
        borderRadius: "var(--border-radius-md)",
        background: "var(--color-background-primary)",
        color: "var(--color-text-primary)",
        outline: "none",
        fontFamily: "inherit",
        ...style,
      }}
    />
  );
}

export function Select({
  value,
  onChange,
  children,
  style,
}: {
  value?: string;
  onChange?: (v: string) => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        fontSize: 12,
        padding: "5px 10px",
        border: "0.5px solid var(--color-border-secondary)",
        borderRadius: "var(--border-radius-md)",
        background: "var(--color-background-primary)",
        color: "var(--color-text-primary)",
        outline: "none",
        fontFamily: "inherit",
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </select>
  );
}

export function StatCard({ label, value, sub, subColor, valColor }: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  valColor?: string;
}) {
  return (
    <div
      style={{
        background: "var(--color-background-secondary)",
        borderRadius: "var(--border-radius-md)",
        padding: ".75rem 1rem",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color: valColor ?? "var(--color-text-primary)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, marginTop: 2, color: subColor ?? "var(--color-text-secondary)" }}>{sub}</div>}
    </div>
  );
}

export function EmptyRow({ cols, message }: { cols: number; message: string }) {
  return (
    <tr>
      <td colSpan={cols} style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 12 }}>
        {message}
      </td>
    </tr>
  );
}