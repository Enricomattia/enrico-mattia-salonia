"use client";

import { usePathname } from "next/navigation";
import { COLORS, MONO } from "@/lib/tokens";
import TrackedLink from "@/components/TrackedLink";

export default function SiteFooter() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  if (pathname === "/pathos" || pathname.startsWith("/pathos/") || pathname === "/pathos-personal" || pathname.startsWith("/pathos-personal/")) return null;
  return (
    <footer
      style={{
        borderTop: `1px solid ${COLORS.hairline}`,
        background: isHome ? "rgba(250,250,248,0.55)" : undefined,
        backdropFilter: isHome ? "blur(2px)" : undefined,
        WebkitBackdropFilter: isHome ? "blur(2px)" : undefined,
        padding: "26px clamp(24px,6vw,72px)",
        fontFamily: MONO,
        fontSize: 11.5,
        letterSpacing: "0.04em",
        color: COLORS.ultraFaint,
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
      }}
    >
      {/* NOTE: intentionally no link to /quotes — it is an unlinked page. */}
      <TrackedLink
        href="mailto:mattia.salonia1@gmail.com"
        eventName="mailto_click"
        tags={{ link_type: "footer_email" }}
        style={{ color: isHome ? COLORS.body : COLORS.faint }}
      >
        mattia.salonia1@gmail.com
      </TrackedLink>
    </footer>
  );
}
