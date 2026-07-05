import { COLORS, SERIF, MONO } from "@/lib/tokens";

interface Course {
  title: string;
  meta: string;
  materials: { label: string; href: string }[];
}

const courses: Course[] = [
  {
    title: "Game Theory",
    meta: "Spring 2026 · Second-year bachelor · Tor Vergata",
    materials: [
      { label: "Study guide", href: "/docs/game_guide.pdf" },
      { label: "Syllabus", href: "/docs/game_syl.pdf" },
      { label: "Ultimatum game", href: "/docs/note-ultimatum.pdf" },
      { label: "Trust game", href: "/docs/note-trust.pdf" },
      { label: "Public good game", href: "/docs/public-good.pdf" },
      { label: "Guilt aversion", href: "/docs/guilt-aversion.pdf" },
      { label: "Exam April", href: "/docs/solutions_April.pdf" },
      { label: "Exam 8 June", href: "/docs/solutions-8-June.pdf" },
      { label: "Mock exam", href: "/docs/mock_exam-game.pdf" },
    ],
  },
  {
    title: "Microeconomics I",
    meta: "Fall 2025 · First-year PhD · Tor Vergata",
    materials: [
      { label: "Notes", href: "/docs/notes_micro.pdf" },
      { label: "Syllabus", href: "/docs/micro_syl.pdf" },
    ],
  },
  {
    title: "Topics in Macro I",
    meta: "Fall 2020–2023 · Third-year bachelor · Toulouse",
    materials: [
      { label: "Notes", href: "/docs/notes_macro.pdf" },
      { label: "Syllabus", href: "/docs/macro_syl.pdf" },
      {
        label: "Solow–Swan notebook",
        href: "https://mybinder.org/v2/gh/Enricomattia/TopicsInMacro1TD/HEAD?filepath=solow-swan.ipynb",
      },
    ],
  },
];

export default function Teaching() {
  return (
    <main className="site-main">
      <h1
        style={{
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: COLORS.accent,
          fontWeight: 500,
        }}
      >
        Classes
      </h1>

      {courses.map((c, i) => (
        <section
          key={c.title}
          style={{ padding: "34px 0", borderBottom: i < courses.length - 1 ? `1px solid ${COLORS.hairline}` : "none" }}
        >
          <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 24, color: COLORS.ink }}>{c.title}</h2>
          <div style={{ fontFamily: SERIF, fontSize: 15.5, color: COLORS.faint, marginTop: 4 }}>{c.meta}</div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px 18px",
              marginTop: 18,
              fontFamily: MONO,
              fontSize: 12,
              color: COLORS.accent,
              alignItems: "center",
            }}
          >
            {c.materials.map((m, idx) => (
              <span key={m.href} style={{ display: "flex", alignItems: "center", gap: 18 }}>
                {idx > 0 && <span style={{ color: "#c9d0d5" }}>/</span>}
                <a href={m.href} target="_blank" rel="noopener noreferrer">
                  {m.label}
                </a>
              </span>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
