"use client";
import { useState } from "react";
import { papers, Paper } from "@/lib/papers";
import { COLORS, SERIF, MONO } from "@/lib/tokens";
import { clarityEvent, setClarityTag } from "@/lib/clarity";
import TeX from "@/components/TeX";

const stop = (e: React.MouseEvent) => e.stopPropagation();

const chipStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 12,
  letterSpacing: "0.04em",
  color: COLORS.accent,
  whiteSpace: "nowrap",
};

function Card({ paper, open, onToggle }: { paper: Paper; open: boolean; onToggle: () => void }) {
  return (
    <article style={{ borderBottom: `1px solid ${COLORS.hairline}` }}>
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 18,
          padding: "24px 14px",
          margin: "0 -14px",
          cursor: "pointer",
          borderRadius: 6,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.rowHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ flex: 1 }}>
          <div>
            <h2
              style={{
                fontFamily: SERIF,
                fontWeight: 500,
                fontSize: 23,
                lineHeight: 1.28,
                color: COLORS.ink,
                display: "inline",
              }}
            >
              {paper.title}
            </h2>
            {paper.ssrn && (
              <a
                href={paper.ssrn}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  stop(e);
                  setClarityTag("paper_id", paper.id);
                  clarityEvent("paper_ssrn_click");
                }}
                style={{ ...chipStyle, marginLeft: 12 }}
              >
                [ SSRN ↗ ]
              </a>
            )}
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: COLORS.ultraFaint,
              marginTop: 8,
            }}
          >
            {paper.status}
            {paper.coauthor && (
              <>
                {" · with "}
                <a
                  href={paper.coauthor.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={stop}
                  style={{ color: COLORS.accent, borderBottom: `1px solid ${COLORS.linkUnderline}` }}
                >
                  {paper.coauthor.name}
                </a>
              </>
            )}
          </div>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 22, lineHeight: 1, color: COLORS.indicator }}>
          {open ? "–" : "+"}
        </span>
      </div>

      {open && (
        <div style={{ padding: "0 0 34px" }}>
          <p style={{ fontFamily: SERIF, fontSize: 16.5, lineHeight: 1.72, color: COLORS.body }}>
            {paper.abstract}
          </p>
          <TeX tex={paper.tex} />
          {(paper.extraLinks || paper.draftOnRequest) && (
            <div
              style={{
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: "0.04em",
                color: paper.draftOnRequest ? COLORS.ultraFaint : COLORS.accent,
                marginTop: 14,
                display: "flex",
                gap: 18,
                flexWrap: "wrap",
              }}
            >
              {paper.extraLinks?.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    setClarityTag("paper_id", paper.id);
                    clarityEvent("paper_extra_link_click");
                  }}
                >
                  {l.label}
                </a>
              ))}
              {paper.draftOnRequest && <span>Draft available upon request</span>}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function Research() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const allOpen = papers.every((p) => expanded[p.id]);

  const toggle = (paper: Paper) => {
    const willOpen = !expanded[paper.id];
    setExpanded((s) => ({ ...s, [paper.id]: !s[paper.id] }));
    setClarityTag("paper_id", paper.id);
    clarityEvent(willOpen ? "paper_expand" : "paper_collapse");
  };
  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    papers.forEach((p) => (next[p.id] = !allOpen));
    setExpanded(next);
    clarityEvent(allOpen ? "papers_collapse_all" : "papers_expand_all");
  };

  return (
    <main className="site-main">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
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
          Working papers
        </h1>
        <button
          onClick={toggleAll}
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: COLORS.ultraFaint,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {papers.map((p) => (
        <Card key={p.id} paper={p} open={!!expanded[p.id]} onToggle={() => toggle(p)} />
      ))}
    </main>
  );
}
