import Sidebar from "./_components/sidebar";

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex overflow-hidden"
      style={{
        background: "var(--color-background-tertiary)",
        // Define backoffice theme variables
        "--color-background-primary": "#ffffff",
        "--color-background-secondary": "#f8f9fa",
        "--color-background-tertiary": "#f1f3f4",
        "--color-text-primary": "#1a1a1a",
        "--color-text-secondary": "#666666",
        "--color-text-tertiary": "#999999",
        "--color-border-primary": "#e0e0e0",
        "--color-border-secondary": "#cccccc",
        "--color-border-tertiary": "#f0f0f0",
        "--border-radius-md": "6px",
        "--border-radius-lg": "8px",
        "--font-mono": "ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace",
      } as React.CSSProperties}
    >
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  );
}