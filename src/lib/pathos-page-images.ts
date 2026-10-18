import { lookup } from "node:dns/promises";
import { request as httpRequest, type ClientRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { Parser } from "htmlparser2";

export class PageImageError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type PageImage = { url: string; source: string };
type Address = { address: string; family: number };
type Dependencies = {
  resolve?: (hostname: string) => Promise<Address[]>;
  request?: (url: URL, options: RequestOptions, callback: (res: IncomingMessage) => void) => ClientRequest;
  timeoutMs?: number;
  maxBytes?: number;
};

export function isPublicAddress(address: string) {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === "unicast";
  } catch { return false; }
}

export function pageUrl(raw: string, base?: string) {
  if (raw.length > 2048) throw new PageImageError("That link is too long.");
  let url: URL;
  try { url = new URL(raw, base); } catch { throw new PageImageError("Enter a valid public webpage link."); }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port
      || !host.includes(".") && !isIP(host) || /(?:^|\.)(?:localhost|local|internal|test|invalid|home|lan)$/.test(host)
      || isIP(host) && !isPublicAddress(host)) {
    throw new PageImageError("Use a public http or https webpage without credentials or custom ports.");
  }
  url.hash = "";
  return url;
}

function aborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new PageImageError("The page took too long to respond.", 504));
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new PageImageError("The page took too long to respond.", 504));
    signal.addEventListener("abort", cancel, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", cancel));
  });
}

async function publicAddresses(url: URL, resolve: NonNullable<Dependencies["resolve"]>, signal: AbortSignal) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await aborted(resolve(host), signal);
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) {
    throw new PageImageError("That link does not point to a public website.");
  }
  return addresses;
}

// No cookies, credentials, browser scripts or automatic redirects. Each redirect
// is checked again, and DNS is pinned to an already validated public address.
async function readPage(url: URL, address: Address, signal: AbortSignal, dependencies: Dependencies, storeImage = false) {
  const transport = dependencies.request || ((target, options, callback) =>
    (target.protocol === "https:" ? httpsRequest : httpRequest)(target, options, callback));
  const limit = dependencies.maxBytes ?? (storeImage ? 8 : 2) * 1024 * 1024;
  return new Promise<{ location?: string; html?: string; image?: boolean; bytes?: Buffer; type?: string }>((resolve, reject) => {
    const req = transport(url, {
      agent: false, signal, family: address.family,
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Pathos/1.0; official-page image lookup)",
        "Accept": storeImage ? "image/png,image/jpeg,image/webp,image/gif,image/avif" : "text/html,application/xhtml+xml,image/*;q=0.8",
        "Accept-Encoding": "identity",
      },
    }, response => {
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location;
        response.destroy();
        if (!location) reject(new PageImageError("The page redirected without a destination.", 502));
        else resolve({ location });
        return;
      }
      if (status < 200 || status >= 300) {
        response.destroy(); reject(new PageImageError("The website would not let Πathos read that page. You can still paste an image URL.", 502)); return;
      }
      const type = String(response.headers["content-type"] || "").toLowerCase().split(";")[0].trim();
      if (!storeImage && type.startsWith("image/")) { response.destroy(); resolve({ image: true }); return; }
      if (storeImage ? !/^image\/(?:png|jpeg|webp|gif|avif)$/.test(type) : !/^(?:text\/html|application\/xhtml\+xml)$/.test(type)) {
        response.destroy(); reject(new PageImageError("That link did not return a webpage or image.", 422)); return;
      }
      if (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") {
        response.destroy(); reject(new PageImageError("The website returned an unsupported compressed response.", 502)); return;
      }
      if (Number(response.headers["content-length"]) > limit) {
        response.destroy(); reject(new PageImageError("That page is too large to inspect.", 413)); return;
      }
      const chunks: Buffer[] = []; let length = 0;
      response.on("data", (chunk: Buffer) => {
        length += chunk.length;
        if (length > limit) {
          reject(new PageImageError("That page is too large to inspect.", 413)); response.destroy(); req.destroy();
        } else chunks.push(chunk);
      });
      response.on("end", () => {
        const bytes = Buffer.concat(chunks);
        if (storeImage) {
          // Never accept HTML/SVG disguised as raster artwork.
          const valid = type === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
            : type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : type === "image/gif" ? /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString())
            : type === "image/webp" ? bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP"
            : bytes.subarray(4, 8).toString() === "ftyp" && /avif|avis/.test(bytes.subarray(8, 32).toString());
          if (!valid) reject(new PageImageError("That link did not return a supported image.", 422));
          else resolve({ bytes, type });
        } else resolve({ html: bytes.toString("utf8") });
      });
      response.on("aborted", () => reject(new PageImageError("The website interrupted the page download.", 502)));
      response.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

// Copy selected public artwork into the archive, using the same pinned DNS,
// redirect checks, byte/time limits and credential-free requests as discovery.
export async function downloadPageImage(raw: string, dependencies: Dependencies = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? 8000);
  const resolve = dependencies.resolve || (hostname => lookup(hostname, { all: true, verbatim: true }));
  try {
    let url = pageUrl(raw);
    for (let redirects = 0; redirects <= 3; redirects++) {
      const addresses = await publicAddresses(url, resolve, controller.signal);
      const result = await readPage(url, addresses.find(item => item.family === 4) || addresses[0], controller.signal, dependencies, true);
      if (result.location) {
        if (redirects === 3) throw new PageImageError("The website redirected too many times.", 502);
        url = pageUrl(result.location, url.href);
      } else if (result.bytes && result.type) {
        return { dataUrl: `data:${result.type};base64,${result.bytes.toString("base64")}` };
      } else throw new PageImageError("Could not store that image.", 502);
    }
    throw new PageImageError("Could not store that image.", 502);
  } catch (error) {
    if (controller.signal.aborted) throw new PageImageError("The image took too long to respond.", 504);
    if (error instanceof PageImageError) throw error;
    throw new PageImageError("Could not store that image. Upload your own image or try another link.", 502);
  } finally { clearTimeout(timer); }
}

export function extractPageImages(html: string, finalUrl: string) {
  let base = finalUrl, title = "", inTitle = false, ld = "", inLd = false, visited = 0;
  const found = new Map<string, PageImage & { score: number }>();
  const add = (raw: string, source: string, score: number) => {
    if (!raw?.trim() || found.size >= 80) return;
    try {
      const candidate = pageUrl(raw.trim(), base), url = candidate.href;
      if (url === finalUrl || candidate.pathname === "/" && !candidate.search
          || /logo|favicon|spinner|tracking|\/pixel\b|\/(?:icons?|avatars?|sponsors?)\//i.test(url)) return;
      if (!found.has(url) || found.get(url)!.score < score) found.set(url, { url, source, score });
    } catch { /* Non-web and local image references are not candidates. */ }
  };
  const structured = (value: unknown, depth = 0, image = false) => {
    if (depth > 8 || ++visited > 300) return;
    if (typeof value === "string") { if (image) add(value, "Page image", 80); return; }
    if (Array.isArray(value)) { value.slice(0, 30).forEach(item => structured(item, depth + 1, image)); return; }
    if (value && typeof value === "object" && String((value as Record<string, unknown>)["@type"]).includes("Organization")) return;
    if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) {
      if (["logo", "publisher", "author"].includes(key)) continue;
      const imageObject = image || String((value as Record<string, unknown>)["@type"]).includes("ImageObject");
      structured(item, depth + 1, key === "image" || key === "thumbnailUrl" || imageObject && ["url", "contentUrl"].includes(key));
    }
  };
  const parser = new Parser({
    onopentag(name, attributes) {
      if (name === "title") inTitle = true;
      if (name === "base" && attributes.href) { try { base = pageUrl(attributes.href, finalUrl).href; } catch {} }
      if (name === "meta") {
        const key = (attributes.property || attributes.name || "").toLowerCase();
        if (["og:image", "og:image:url", "og:image:secure_url"].includes(key)) add(attributes.content, "Open Graph", 100);
        else if (["twitter:image", "twitter:image:src"].includes(key)) add(attributes.content, "Twitter image", 90);
      }
      if (name === "link" && attributes.rel?.split(/\s+/).includes("image_src")) add(attributes.href, "Page image", 85);
      if (name === "script" && attributes.type?.toLowerCase() === "application/ld+json") { inLd = true; ld = ""; }
      if (name === "img") {
        if (/logo|avatar|icon|sponsor|badge/i.test(attributes.alt || "")) return;
        if ([attributes.width, attributes.height].some(size => Number(size) > 0 && Number(size) < 100)) return;
        add(attributes["data-src"] || attributes["data-lazy-src"] || attributes.src, "Page image", 50);
      }
    },
    ontext(text) { if (inTitle) title += text; if (inLd && ld.length < 262144) ld += text; },
    onclosetag(name) {
      if (name === "title") inTitle = false;
      if (name === "script" && inLd) { inLd = false; try { structured(JSON.parse(ld)); } catch {} }
    },
  }, { decodeEntities: true });
  parser.end(html);
  return { title: title.trim().replace(/\s+/g, " ").slice(0, 200), images: [...found.values()].sort((a, b) => b.score - a.score).slice(0, 12) };
}

export async function discoverPageImages(raw: string, dependencies: Dependencies = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? 8000);
  const resolve = dependencies.resolve || (hostname => lookup(hostname, { all: true, verbatim: true }));
  const { signal } = controller;
  try {
    let url = pageUrl(raw), result;
    for (let redirects = 0; redirects <= 3; redirects++) {
      const addresses = await publicAddresses(url, resolve, signal);
      result = await readPage(url, addresses.find(address => address.family === 4) || addresses[0], signal, dependencies);
      if (!result.location) break;
      if (redirects === 3) throw new PageImageError("The website redirected too many times.", 502);
      url = pageUrl(result.location, url.href);
    }
    if (result?.image) return { pageUrl: url.href, title: "", images: [{ url: url.href, source: "Image link" }] };
    const extracted = extractPageImages(result?.html || "", url.href);
    const hosts = new Map<string, Promise<Address[]>>();
    const checked = await Promise.all(extracted.images.map(async image => {
      const candidate = pageUrl(image.url);
      try {
        if (!hosts.has(candidate.hostname)) hosts.set(candidate.hostname, publicAddresses(candidate, resolve, signal));
        await hosts.get(candidate.hostname);
        return { url: image.url, source: image.source };
      } catch { return null; }
    }));
    if (signal.aborted) throw new PageImageError("The page took too long to respond.", 504);
    return { pageUrl: url.href, title: extracted.title, images: checked.filter((image): image is PageImage => image !== null).slice(0, 6) };
  } catch (error) {
    if (signal.aborted) throw new PageImageError("The page took too long to respond.", 504);
    if (error instanceof PageImageError) throw error;
    throw new PageImageError("Could not read that page. You can still paste an image URL or try another official link.", 502);
  } finally { clearTimeout(timer); }
}
