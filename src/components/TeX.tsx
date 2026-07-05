"use client";
import { useEffect, useRef } from "react";
import katex from "katex";

/**
 * Renders a LaTeX string as display math with KaTeX, on the client.
 * Requires `katex` installed and `katex/dist/katex.min.css` imported once
 * (see app/layout.tsx).
 */
export default function TeX({ tex, fontSize = 17 }: { tex: string; fontSize?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    katex.render(tex, ref.current, { displayMode: true, throwOnError: false });
  }, [tex]);

  return (
    <div style={{ textAlign: "center", margin: "30px 0 4px", overflowX: "auto" }}>
      <span ref={ref} style={{ fontSize, color: "#14202a" }} />
    </div>
  );
}
