// src/app/notes/[file]/route.ts
import type { NextRequest } from "next/server";

const OWNER = "Enricomattia";
const REPO = "micro_notes";
const BRANCH = "main";
const PDF_DIR = ""; // folder inside the notes repo where the PDFs live

// Tell Next this route is always dynamic (no static optimization)
export const dynamic = "force-dynamic";
// Extra safety: no ISR revalidation, always run on request
export const revalidate = 0;

export async function GET(
  _req: NextRequest,
  { params }: { params: { file: string } }
) {
  const file = params.file;

  // Basic safety: only allow PDFs
  if (!file.endsWith(".pdf")) {
    return new Response("Invalid file", { status: 400 });
  }

  const githubRawUrl =
    PDF_DIR === ""
      ? `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${file}`
      : `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${PDF_DIR}/${file}`;

  // Critical: disable fetch caching on the server
  const res = await fetch(githubRawUrl, {
    cache: "no-store",
  });

  if (!res.ok) {
    return new Response("Not found", { status: 404 });
  }

  const buffer = await res.arrayBuffer();

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file}"`,
      // Tell browsers not to cache either
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
