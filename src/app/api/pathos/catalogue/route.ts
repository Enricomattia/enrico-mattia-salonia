import { boundedJson, catalogue, CatalogueError, requireOwner } from "@/lib/pathos-catalogue";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", Vary: "Authorization" };
let active = 0;

export async function POST(request: Request) {
  try {
    await requireOwner(request);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new CatalogueError("Send a catalogue query as JSON.", 415);
    if (active >= 2) throw new CatalogueError("Wait for the current lookup to finish.", 429);
    active++;
    try { return Response.json(await catalogue(await boundedJson(request.body, 4096, 400), request.headers.get("x-pathos-tmdb") || process.env.PATHOS_TMDB_TOKEN || ""), { headers }); }
    finally { active--; }
  } catch (error) {
    return Response.json({ error: error instanceof CatalogueError ? error.message : "Could not look up that work. Please try again." }, { status: error instanceof CatalogueError ? error.status : 502, headers });
  }
}
