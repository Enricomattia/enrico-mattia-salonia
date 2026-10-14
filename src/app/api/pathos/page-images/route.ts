import { discoverPageImages, PageImageError } from "@/lib/pathos-page-images";

export const runtime = "nodejs";
let active = 0;
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  // Next's internal request URL can use localhost behind a reverse proxy.
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim()
    || request.headers.get("host") || new URL(request.url).host;
  let sameOrigin = !origin;
  try { if (origin) sameOrigin = ["http:", "https:"].includes(new URL(origin).protocol) && new URL(origin).host === host; } catch {}
  if (request.headers.get("sec-fetch-site") === "cross-site"
      || !sameOrigin) {
    return Response.json({ error: "Open Πathos on this site to look up an image." }, { status: 403, headers });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "Send a webpage link as JSON." }, { status: 415, headers });
  }
  if (active >= 4) return Response.json({ error: "Image lookup is busy. Try again shortly." }, { status: 429, headers: { ...headers, "Retry-After": "5" } });
  active++;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; void reader?.cancel().catch(() => {}); }, 5000);
  try {
    reader = request.body?.getReader();
    if (!reader) throw new PageImageError("Enter a webpage link.");
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 4096) { await reader.cancel(); throw new PageImageError("That request is too large.", 413); }
      chunks.push(value);
    }
    clearTimeout(timeout);
    if (timedOut) throw new PageImageError("The request took too long.", 408);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (typeof body?.url !== "string" || !body.url.trim()) throw new PageImageError("Enter a webpage link.");
    return Response.json(await discoverPageImages(body.url.trim()), { headers });
  } catch (error) {
    const status = error instanceof PageImageError ? error.status : 400;
    const message = error instanceof PageImageError ? error.message : "Enter a valid webpage link.";
    return Response.json({ error: message }, { status, headers });
  } finally { clearTimeout(timeout); reader?.releaseLock(); active--; }
}
