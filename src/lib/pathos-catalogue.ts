// Public catalogue metadata only. Private archive records never enter this API.
export type CatalogueItem = {
  provider: "openlibrary" | "tmdb"; id: string; type: "Book" | "Film";
  title: string; creator: string; year: string; cover: string;
  description: string; genres: string[]; sourceUrl: string;
};
export class CatalogueError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
type Fetch = typeof fetch;
const SUPABASE_URL = "https://ezuixryztraqvamqauvu.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_NYSDXGnPiNLEMGHj6xC0yg_fp3ojiKS";
const OWNER_ID = "cd30e74f-50ab-4c88-857a-581b94b2eb9a";
// These are public identifiers, matching public/pathos/config.js, not credentials.
const text = (value: unknown, limit = 500) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const strings = (value: unknown, limit = 12): string[] => Array.isArray(value) ? value.map(x => text(x, 100)).filter(Boolean).slice(0, limit) : [];

export async function boundedJson(stream: ReadableStream<Uint8Array> | null, limit = 4096, malformedStatus = 502) {
  if (!stream) throw new CatalogueError("The request is empty.");
  const reader = stream.getReader(); let size = 0;
  const chunks: Uint8Array[] = [];
  const timer = setTimeout(() => { void reader.cancel().catch(() => {}); }, 8000);
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new CatalogueError("The request is too large.", 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof CatalogueError) throw error;
    throw new CatalogueError("Could not read that response. Please try again.", malformedStatus);
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

export async function requireOwner(request: Request, network: Fetch = fetch) {
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new CatalogueError("Open Πathos on this site.", 403);
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || new URL(request.url).host;
  if (origin) {
    try { if (!["http:", "https:"].includes(new URL(origin).protocol) || new URL(origin).host !== host) throw new Error(); }
    catch { throw new CatalogueError("Open Πathos on this site.", 403); }
  }
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(authorization)) throw new CatalogueError("Sign in as the archive owner.", 401);
  let response: Response;
  try {
    response = await network(SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: PUBLISHABLE_KEY, Authorization: authorization },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
  } catch { throw new CatalogueError("Could not verify your session. Please try again.", 503); }
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status >= 500 || response.status === 429) throw new CatalogueError("Could not verify your session. Please try again.", 503);
    throw new CatalogueError("Your session expired. Sign in again.", 401);
  }
  const user = await boundedJson(response.body, 65536);
  if (user.id !== OWNER_ID) throw new CatalogueError("Only the archive owner can use this feature.", 403);
}

async function publicJson(url: string, token: string, network: Fetch) {
  try {
    const response = await network(url, {
      headers: { Accept: "application/json", "User-Agent": "Pathos/1.0 (https://enricomattiasalonia.com/pathos)", ...(token ? { Authorization: "Bearer " + token } : {}) },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new CatalogueError(response.status === 401 ? "The TMDB token was rejected. Update it under Metadata & covers." : "The catalogue is unavailable. Please try again.", 502);
    }
    return await boundedJson(response.body, 2 * 1024 * 1024);
  } catch (error) {
    if (error instanceof CatalogueError) throw error;
    throw new CatalogueError("The catalogue did not respond. Please try again.", 502);
  }
}

function movie(data: Record<string, any>): CatalogueItem {
  const id = String(data.id);
  return { provider: "tmdb", id, type: "Film", title: text(data.title), year: text(data.release_date).slice(0, 4),
    creator: text(data.credits?.crew?.find((x: Record<string, unknown>) => x.job === "Director")?.name),
    cover: /^\/[A-Za-z0-9._-]+$/.test(data.poster_path || "") ? "https://image.tmdb.org/t/p/w500" + data.poster_path : "",
    description: text(data.overview, 8000), genres: strings(data.genres?.map((x: Record<string, unknown>) => x.name)),
    sourceUrl: "https://www.themoviedb.org/movie/" + id };
}

export async function catalogue(body: Record<string, unknown>, tmdbToken = "", network: Fetch = fetch) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new CatalogueError("Enter a title to search.");
  if (body.action === "check") return { ok: true };
  if (!["search", "detail"].includes(String(body.action)) || !["Book", "Film"].includes(String(body.type))) throw new CatalogueError("Choose Books or Films.");
  const film = body.type === "Film";
  if (film && !/^[A-Za-z0-9._-]{20,2048}$/.test(tmdbToken)) throw new CatalogueError("Add your free TMDB read token under Metadata & covers to search films.", 428);
  if (body.action === "search") {
    const q = text(body.query, 120);
    if (q.length < 2 || typeof body.query !== "string" || body.query.length > 120) throw new CatalogueError("Enter 2–120 characters.");
    if (film) {
      const data = await publicJson("https://api.themoviedb.org/3/search/movie?" + new URLSearchParams({ query: q, include_adult: "false", language: "en-US" }), tmdbToken, network);
      return { items: (Array.isArray(data.results) ? data.results : []).filter((d: any) => Number.isInteger(d.id) && d.id > 0).slice(0, 8).map(movie) };
    }
    const data = await publicJson("https://openlibrary.org/search.json?" + new URLSearchParams({ q, limit: "8", fields: "key,title,author_name,first_publish_year,cover_i,subject" }), "", network);
    return { items: (Array.isArray(data.docs) ? data.docs : []).filter((d: any) => /^\/works\/OL\d+W$/.test(d.key)).slice(0, 8).map((d: any): CatalogueItem => ({
      provider: "openlibrary", id: d.key, type: "Book", title: text(d.title), creator: strings(d.author_name, 2).join(", "),
      year: /^\d{4}$/.test(String(d.first_publish_year)) ? String(d.first_publish_year) : "",
      cover: Number.isInteger(d.cover_i) && d.cover_i > 0 ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : "",
      description: "", genres: strings(d.subject), sourceUrl: "https://openlibrary.org" + d.key,
    })) };
  }
  if (film) {
    if (!/^[1-9]\d{0,9}$/.test(String(body.id))) throw new CatalogueError("Choose a film from the results.");
    return { item: movie(await publicJson(`https://api.themoviedb.org/3/movie/${body.id}?append_to_response=credits&language=en-US`, tmdbToken, network)) };
  }
  if (typeof body.id !== "string" || !/^\/works\/OL\d+W$/.test(body.id)) throw new CatalogueError("Choose a book from the results.");
  const data = await publicJson("https://openlibrary.org" + body.id + ".json", "", network);
  const authors = await Promise.all((Array.isArray(data.authors) ? data.authors : []).slice(0, 2).map(async (a: any) => {
    const key = a.author?.key;
    if (!/^\/authors\/OL\d+A$/.test(key || "")) return "";
    try { return text((await publicJson("https://openlibrary.org" + key + ".json", "", network)).name); } catch { return ""; }
  }));
  const cover = Array.isArray(data.covers) ? data.covers.find((n: unknown) => Number.isInteger(n) && Number(n) > 0) : undefined;
  return { item: { provider: "openlibrary", id: body.id, type: "Book", title: text(data.title), creator: authors.filter(Boolean).join(", "),
    year: text(data.first_publish_date).match(/\b\d{4}\b/)?.[0] || "",
    cover: cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : "",
    description: text(typeof data.description === "string" ? data.description : data.description?.value, 8000),
    genres: strings(data.subjects), sourceUrl: "https://openlibrary.org" + body.id } satisfies CatalogueItem };
}
