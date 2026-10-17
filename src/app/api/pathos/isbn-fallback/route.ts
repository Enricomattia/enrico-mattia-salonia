import { IsbnFallbackError, lookupHoepli } from "@/lib/pathos-isbn-fallback";
import { isbn13 } from "../../../../../public/pathos/book-catalogue.mjs";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
const cache = new Map<string, { expires: number; items: Awaited<ReturnType<typeof lookupHoepli>> }>();
let active = 0;

// Public metadata only, shared with Personal. No archive, authentication, keys or arbitrary URLs.
export async function POST(request: Request) {
  const origin = request.headers.get("origin"), host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || new URL(request.url).host;
  let sameOrigin = !origin;
  try { if (origin) sameOrigin = ["http:", "https:"].includes(new URL(origin).protocol) && new URL(origin).host === host; } catch {}
  if (!sameOrigin || request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ error: "Open Πathos on this site." }, { status: 403, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Send an ISBN as JSON." }, { status: 415, headers });
  if (active >= 2) return Response.json({ error: "Edition lookup is busy. Try again shortly." }, { status: 429, headers });
  active++;
  const reader = request.body?.getReader(); let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader?.cancel().catch(() => {}); }, 5000);
  try {
    if (!reader) throw new IsbnFallbackError("Enter an ISBN.", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length;
      if (size > 256) { await reader.cancel(); throw new IsbnFallbackError("The request is too large.", 413); } chunks.push(value); }
    clearTimeout(timer); if (timedOut) throw new IsbnFallbackError("The request took too long.", 408);
    let body; try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new IsbnFallbackError("Enter a valid ISBN.", 400); }
    if (!body || Object.keys(body).some(key => key !== "isbn") || typeof body.isbn !== "string" || body.isbn.length > 24) throw new IsbnFallbackError("Send only an ISBN.", 400);
    const isbn = isbn13(body.isbn); if (!isbn) throw new IsbnFallbackError("Enter a valid ISBN.", 400);
    const cached = cache.get(isbn);
    if (cached && cached.expires > Date.now()) return Response.json({ items: cached.items }, { headers });
    const items = await lookupHoepli(isbn);
    cache.delete(isbn); cache.set(isbn, { items, expires: Date.now() + (items.length ? 86400000 : 600000) });
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
    return Response.json({ items }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof IsbnFallbackError ? error.message : "Edition lookup failed. Manual entry still works." }, { status: error instanceof IsbnFallbackError ? error.status : 502, headers });
  } finally { clearTimeout(timer); reader?.releaseLock(); active--; }
}
