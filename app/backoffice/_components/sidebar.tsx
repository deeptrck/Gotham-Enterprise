"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { LogOut } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  badge?: string;
  badgeColor?: "amber" | "red";
};

const clientViewLinks: NavItem[] = [
  { label: "Overview", href: "/backoffice" },
  { label: "Scan log", href: "/backoffice/scan-log" },
  { label: "API usage", href: "/backoffice/api-usage" },
  { label: "Credits & billing", href: "/backoffice/credits" },
  { label: "Client accounts", href: "/backoffice/clients" },
];

const internalLinks: (fpCount: number) => NavItem[] = (fpCount) => [
  { label: "FP / FN queue", href: "/backoffice/fp-queue", badge: fpCount > 0 ? fpCount.toString() : undefined, badgeColor: "amber" },
  { label: "Model feedback", href: "/backoffice/model-feedback" },
  { label: "Scan forensics", href: "/backoffice/forensics" },
  { label: "Dataset pipeline", href: "/backoffice/pipeline" },
];

const systemLinks: (alertsCount: number) => NavItem[] = (alertsCount) => [
  { label: "API keys", href: "/backoffice/api-keys" },
  { label: "Webhooks", href: "/backoffice/webhooks" },
  { label: "Audit log", href: "/backoffice/audit-log" },
  { label: "Alerts", href: "/backoffice/alerts", badge: alertsCount > 0 ? alertsCount.toString() : undefined, badgeColor: "red" },
  { label: "Settings", href: "/backoffice/settings" },
];

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 16px",
        fontSize: 12,
        color: isActive ? "#00A8CC" : "rgba(255,255,255,.55)",
        borderLeft: isActive ? "2px solid #00A8CC" : "2px solid transparent",
        background: isActive ? "rgba(0,168,204,.12)" : "transparent",
        textDecoration: "none",
        transition: "all .15s",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)";
          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.85)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.55)";
        }
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "currentColor",
          flexShrink: 0,
        }}
      />
      {item.label}
      {item.badge && (
        <span
          style={{
            marginLeft: "auto",
            background:
              item.badgeColor === "red"
                ? "rgba(220,38,38,.2)"
                : "rgba(218,119,6,.2)",
            color: item.badgeColor === "red" ? "#F7C1C1" : "#FAC775",
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 99,
          }}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 500,
        color: "rgba(255,255,255,.3)",
        letterSpacing: ".07em",
        textTransform: "uppercase",
        padding: "12px 16px 4px",
      }}
    >
      {label}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [alertsCount, setAlertsCount] = useState(0);
  const [fpCount, setFpCount] = useState(0);

  useEffect(() => {
    async function fetchCounts() {
      if (!user) return;
      try {
        const [alertsRes, fpRes] = await Promise.all([
          fetch("/api/admin/alerts", { credentials: "include" }),
          fetch("/api/admin/fp-queue?limit=1", { credentials: "include" }),
        ]);
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          setAlertsCount(alertsData.alerts?.length || 0);
        }
        if (fpRes.ok) {
          const fpData = await fpRes.json();
          setFpCount(fpData.pagination?.total || 0);
        }
      } catch (err) {
        console.error("Error fetching counts:", err);
      }
    }
    fetchCounts();
  }, [user]);

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.firstName
    ? user.firstName.slice(0, 2).toUpperCase()
    : "AD";

  const displayName = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Admin";

  function isActive(href: string) {
    if (href === "/backoffice") return pathname === "/backoffice";
    return pathname.startsWith(href);
  }

  return (
    <div
      style={{
        width: 192,
        flexShrink: 0,
        background: "#0A0E1A",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "14px 16px 12px",
          borderBottom: "0.5px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Image
            src="/logo-dark.jpg"
            alt="Deeptrack Logo"
            width={28}
            height={28}
            className="rounded-md"
          />
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#fff", letterSpacing: "-0.3px" }}>
              Deeptrack
            </div>
            <div style={{ fontSize: 10, color: "rgba(168,216,234,.55)", letterSpacing: ".04em" }}>
              Gotham back office
            </div>
          </div>
        </div>
      </div>

      {/* Client view */}
      <SectionLabel label="Client view" />
      {clientViewLinks.map((item) => (
        <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
      ))}

      {/* Internal */}
      <SectionLabel label="Internal" />
      {internalLinks(fpCount).map((item) => (
        <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
      ))}

      {/* System */}
      <SectionLabel label="System" />
      {systemLinks(alertsCount).map((item) => (
        <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
      ))}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Exit button */}
      <div style={{ padding: "12px 16px" }}>
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 6,
            background: "rgba(255,255,255,.05)",
            color: "rgba(255,255,255,.55)",
            fontSize: 12,
            textDecoration: "none",
            transition: "all .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,.15)";
            (e.currentTarget as HTMLElement).style.color = "#FCA5A5";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.05)";
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.55)";
          }}
        >
          <LogOut size={14} />
          Exit Backoffice
        </Link>
      </div>

      {/* User */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "0.5px solid rgba(255,255,255,.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(0,168,204,.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 500,
              color: "#00A8CC",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#fff", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayName}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)" }}>Admin</div>
          </div>
        </div>
      </div>
    </div>
  );
}
