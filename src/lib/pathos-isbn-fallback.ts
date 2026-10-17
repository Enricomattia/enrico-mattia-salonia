import { parseDocument, DomUtils } from "htmlparser2";
import { isbn13 } from "../../public/pathos/book-catalogue.mjs";

export class IsbnFallbackError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
const origin = "https://www.hoepli.it";
const clean = (value: unknown, limit = 500): string => typeof value === "string" || typeof value === "number"
  ? String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, limit) : "";
const name = (value: any): string => clean(typeof value === "object" && value ? value.name : value);

// ISBN-only input; even redirects and links must stay on this fixed catalogue.
export function hoepliUrl(raw: string, isbn: string, base = origin) {
  let url: URL;
  try { url = new URL(raw, base); } catch { throw new IsbnFallbackError("Invalid catalogue link."); }
  const search = url.pathname === "/cerca/libri.aspx" && url.searchParams.size === 1 && url.searchParams.get("query") === isbn;
  const book = new RegExp("^/libro/[a-z0-9%-]+/" + isbn + "\\.html$", "i").test(url.pathname) && !url.search;
  if (url.origin !== origin || url.username || url.password || url.hash || (!search && !book)) throw new IsbnFallbackError("The catalogue returned an unexpected link.");
  return url;
}

export function extractHoepliEdition(html: string, finalUrl: string, requested: string) {
  const isbn = isbn13(requested); if (!isbn) throw new IsbnFallbackError("Enter a valid ISBN.", 400);
  const url = hoepliUrl(finalUrl, isbn), document = parseDocument(html);
  const fields = new Map<string, string>();
  for (const node of DomUtils.findAll(node => (node.attribs.class || "").split(/\s+/).includes("altreInfo"), document.children)) {
    const line = clean(DomUtils.textContent(node), 800), colon = line.indexOf(":");
    if (colon > 0) fields.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  const books: any[] = [];
  function visit(value: any, depth = 0) {
    if (!value || typeof value !== "object" || depth > 12) return;
    if (Array.isArray(value)) { value.slice(0, 100).forEach(item => visit(item, depth + 1)); return; }
    if ([value["@type"]].flat().includes("Book") && isbn13(value.isbn) === isbn) books.push(value);
    for (const key of ["@graph", "mainEntity", "itemListElement", "item"]) visit(value[key], depth + 1);
  }
  for (const script of DomUtils.findAll(node => node.name === "script" && node.attribs.type?.toLowerCase() === "application/ld+json", document.children).slice(0, 16)) {
    const json = DomUtils.textContent(script); if (json.length > 256 * 1024) continue;
    try { visit(JSON.parse(json)); } catch { /* A broken schema block is not evidence of an edition. */ }
  }
  const book = books[0];
  if (!book || !clean(book.name)) return null;
  // The reported ISBN is mandatory. A matching URL or an unrelated recommendation is insufficient.
  const roman = fields.get("pagine romane") || "", arabic = fields.get("pagine arabe") || clean(book.numberOfPages);
  const date = fields.get("pubblicazione") || clean(book.datePublished);
  let cover = "";
  try {
    const image = new URL(typeof book.image === "object" ? book.image.url : book.image, url);
    if (image.protocol === "https:" && ["copertine.hoepli.it", "www.hoepli.it"].includes(image.hostname) && !image.username && !image.password && !image.port) cover = image.href;
  } catch { /* Missing artwork is valid. */ }
  const language = clean(book.inLanguage);
  return {
    isbn, title: clean(book.name), creator: [book.author].flat().map(name).filter(Boolean).join(", "),
    publisher: name(book.publisher), publishYear: date.match(/\b(?:1\d{3}|20\d{2})\b/)?.[0] || "",
    language: ({ Italiano: "Italian", Inglese: "English", Francese: "French", Tedesco: "German", Spagnolo: "Spanish" } as Record<string, string>)[language] || language,
    format: fields.get("formato") || clean(book.bookFormat), pages: [roman, arabic].filter(Boolean).join(" + "),
    series: fields.get("collana") || "", printing: fields.get("edizione") || "", contributors: [book.translator].flat().map(name).filter(Boolean).join(", "),
    cover, source: "Hoepli", sourceUrl: url.href,
  };
}

export async function lookupHoepli(raw: string, network: typeof fetch = fetch, timeoutMs = 8000) {
  const isbn = isbn13(raw); if (!isbn) throw new IsbnFallbackError("Enter a valid ISBN.", 400);
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  let requests = 0;
  async function read(rawUrl: string): Promise<{ html: string; url: URL }> {
    const url = hoepliUrl(rawUrl, isbn);
    if (++requests > 4) throw new IsbnFallbackError("Too many catalogue redirects.");
    const response = await network(url.href, { redirect: "manual", cache: "no-store", credentials: "omit", signal: controller.signal,
      headers: { Accept: "text/html", "User-Agent": "Pathos/1.0 (https://enricomattiasalonia.com/pathos)" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location"); await response.body?.cancel();
      if (!location) throw new IsbnFallbackError("The catalogue redirected without a destination.");
      return read(hoepliUrl(location, isbn, url.href).href);
    }
    if (response.status === 404) { await response.body?.cancel(); return { html: "", url }; }
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) { await response.body?.cancel(); throw new IsbnFallbackError("The edition catalogue is unavailable. Manual entry still works."); }
    const reader = response.body?.getReader(); if (!reader) throw new IsbnFallbackError("The catalogue returned an empty response.");
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length;
        if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new IsbnFallbackError("The catalogue response is too large."); } chunks.push(value); }
      return { html: Buffer.concat(chunks).toString("utf8"), url };
    } finally { reader.releaseLock(); }
  }
  try {
    const first = await read(origin + "/cerca/libri.aspx?query=" + isbn);
    const edition = extractHoepliEdition(first.html, first.url.href, isbn); if (edition) return [edition];
    if (first.url.pathname !== "/cerca/libri.aspx") return [];
    const document = parseDocument(first.html);
    for (const link of DomUtils.findAll(node => node.name === "a" && Boolean(node.attribs.href), document.children)) {
      let target: URL; try { target = hoepliUrl(link.attribs.href, isbn, first.url.href); } catch { continue; }
      if (!target.pathname.startsWith("/libro/")) continue;
      const detail = await read(target.href), match = extractHoepliEdition(detail.html, detail.url.href, isbn);
      return match ? [match] : [];
    }
    return [];
  } catch (error) {
    if (error instanceof IsbnFallbackError) throw error;
    throw new IsbnFallbackError("The edition catalogue did not respond. Manual entry still works.");
  } finally { clearTimeout(timer); }
}
