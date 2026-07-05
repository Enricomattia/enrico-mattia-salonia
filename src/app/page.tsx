import { COLORS, SERIF, MONO } from "@/lib/tokens";

export default function Home() {
  return (
    <main className="site-main">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 48, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <p style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1.7, color: "#3a4650", maxWidth: 480 }}>
            I am an assistant professor in the Department of Economics at the{" "}
            <a
              href="https://economia.uniroma2.it/def"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: COLORS.accent, borderBottom: `1px solid ${COLORS.linkUnderline}` }}
            >
              University of Tor Vergata
            </a>
            , in Rome.
          </p>
          <p
            style={{
              fontFamily: SERIF,
              fontSize: 22,
              lineHeight: 1.7,
              color: "#3a4650",
              maxWidth: 480,
              marginTop: 22,
            }}
          >
            I am a microeconomic theorist with various interests.
          </p>
          <div style={{ fontFamily: MONO, fontSize: 12.5, lineHeight: 2.1, color: COLORS.faint, marginTop: 30 }}>
            <div>
              <a href="mailto:mattia.salonia1@gmail.com" style={{ color: COLORS.accent }}>
                mattia.salonia1@gmail.com
              </a>
            </div>
            <div>
              <a href="/cv/index.html" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.accent }}>
                curriculum vitae
              </a>
            </div>
          </div>
        </div>
        <figure
          style={{ border: `1px solid ${COLORS.photoFrame}`, background: "#fff", padding: 8, width: 270, maxWidth: "100%" }}
        >
          {/* Using a plain img keeps static-export simple; swap for next/image if desired. */}
          <img src="/img/parrott.webp" alt="Enrico Mattia Salonia" style={{ width: "100%", display: "block" }} />
        </figure>
      </div>
    </main>
  );
}
