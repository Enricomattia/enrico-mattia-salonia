"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COLORS, SERIF, MONO } from "@/lib/tokens";
import { clarityEvent, setClarityTag } from "@/lib/clarity";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/research", label: "Research" },
  { href: "/teaching", label: "Teaching" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 20,
        flexWrap: "wrap",
        padding: "26px clamp(24px,6vw,72px)",
        borderBottom: `1px solid ${COLORS.hairline}`,
        position: "sticky",
        top: 0,
        background: "rgba(250,250,248,0.9)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 10,
      }}
    >
      <Link
        href="/"
        onClick={() => {
          setClarityTag("nav_target", "Home");
          clarityEvent("nav_click");
        }}
        style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, color: COLORS.ink, letterSpacing: "0.01em" }}
      >
        Enrico Mattia Salonia
      </Link>
      <nav style={{ display: "flex", gap: 26 }}>
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                setClarityTag("nav_target", item.label);
                clarityEvent("nav_click");
              }}
              style={{
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: active ? COLORS.accent : COLORS.faint,
                borderBottom: `1px solid ${active ? COLORS.accent : "transparent"}`,
                paddingBottom: 3,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
