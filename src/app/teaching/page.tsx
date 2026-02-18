import Link from "@/components/atoms/Link/Link";
import PageSection from "@/components/atoms/PageSection/PageSection";
import SectionTitle from "@/components/atoms/SectionTitle/SectionTitle";

const classes = [
  {
    title: "Game Theory",
    meta: "(Spring 2026), Second year bachelor, Tor Vergata",
    syllabusHref: "/docs/game_syl.pdf",
  },
  {
    title: "Microeconomics I",
    meta: "(Fall 2025), First year PhD, Tor Vergata",
    notesHref: "/docs/notes_micro.pdf",
    solutionsHref: "/docs/solutions_micro.pdf",
    syllabusHref: "/docs/micro_syl.pdf",
  },
  {
    title: "Topics in Macro I",
    meta: "(Fall 2020-2023), Third year bachelor, Toulouse",
    notesHref: "/docs/notes_macro.pdf",
    syllabusHref: "/docs/macro_syl.pdf",
    solowSwanHref: "https://mybinder.org/v2/gh/Enricomattia/TopicsInMacro1TD/HEAD?filepath=solow-swan.ipynb",
  },
];

export default function Teaching() {
  return (
    <main className="main col">
      <PageSection>
        <SectionTitle text="Classes" />

        <ul className="list-disc pl-8 flex flex-col gap-y-10">
          {classes.map((c) => {
            const resources = [
              ...(c.notesHref ? [{ href: c.notesHref, text: "Notes" }] : []),
              ...(c.solutionsHref ? [{ href: c.solutionsHref, text: "Solutions" }] : []),
              ...(c.syllabusHref ? [{ href: c.syllabusHref, text: "Syllabus" }] : []),
              ...(c.solowSwanHref ? [{ href: c.solowSwanHref, text: "Solow-Swan" }] : []),
            ];

            return (
              <li key={c.title} className="flex flex-col gap-y-4">
                <div className="text-l">
                  <strong>{c.title}</strong> <span>{c.meta}</span>
                </div>

                <br />

                <div className="flex flex-wrap items-center pl-1">
                  {resources.map((r, idx) => (
                    <span key={r.href} className="flex items-center">
                      {idx > 0 && (
                        <>
                          <span style={{ display: "inline-block", width: 14 }} />
                          <span className="opacity-60">•</span>
                          <span style={{ display: "inline-block", width: 14 }} />
                        </>
                      )}
                      <Link href={r.href} text={r.text} size="text-m" target="_blank" />
                    </span>
                  ))}
                </div>

                <br />
              </li>
            );
          })}
        </ul>
      </PageSection>
    </main>
  );
}
