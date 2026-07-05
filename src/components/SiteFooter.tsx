import { COLORS, MONO } from "@/lib/tokens";
import TrackedLink from "@/components/TrackedLink";

export default function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: `1px solid ${COLORS.hairline}`,
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
      <span>Enrico Mattia Salonia</span>
      {/* NOTE: intentionally no link to /quotes — it is an unlinked page. */}
      <TrackedLink
        href="mailto:mattia.salonia1@gmail.com"
        eventName="mailto_click"
        tags={{ link_type: "footer_email" }}
        style={{ color: COLORS.faint }}
      >
        mattia.salonia1@gmail.com
      </TrackedLink>
    </footer>
  );
}
