import { createHash, ECDH } from "node:crypto";
import { getDeployStore, getStore } from "@netlify/blobs";
import webPush from "web-push";

const storeName = "saggezza-reminders";
const vapidKey = "vapid";
const devicePrefix = "devices/";
const minute = 60_000;
const maxBody = 32_768;
const json = { type: "json" };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const tokenPattern = /^Bearer ([\da-f]{64})$/;

export function reminderStore(context) {
  const options = { name: storeName, consistency: "strong" };
  return context.deploy.context === "production" && context.deploy.published
    ? getStore(options)
    : getDeployStore(options);
}

async function vapidKeys(store) {
  const existing = await store.get(vapidKey, json);
  if (existing) return existing;
  const keys = webPush.generateVAPIDKeys();
  const result = await store.setJSON(vapidKey, keys, { onlyIfNew: true });
  return result.modified ? keys : store.get(vapidKey, json);
}

function readKey(value, size) {
  if (typeof value !== "string" || !/^[\w-]+$/.test(value)) throw new Error("Invalid key");
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== size || bytes.toString("base64url") !== value) throw new Error("Invalid key");
  return bytes;
}

function validateSubscription(value) {
  if (typeof value?.endpoint !== "string" || value.endpoint.length > 2048) throw new Error("Invalid endpoint");
  const url = new URL(value.endpoint);
  // Saggezza's Android installation uses Chrome's Firebase Web Push service.
  if (url.origin !== "https://fcm.googleapis.com" || url.href !== url.origin + url.pathname ||
    !/^\/fcm\/send\/[\w:-]+$/.test(url.pathname)) throw new Error("Unsupported endpoint");
  const { p256dh, auth } = value.keys;
  ECDH.convertKey(readKey(p256dh, 65), "prime256v1");
  readKey(auth, 16);
  return { endpoint: url.href, keys: { p256dh, auth } };
}

function timeFormatter(timeZone) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  });
}

function validateSchedule(value) {
  if (typeof value?.timeZone !== "string" || !/^[\w+/-]{1,80}$/.test(value.timeZone) ||
    !Array.isArray(value.plans) || value.plans.length > 8) throw new Error("Invalid schedule");
  const timeZone = timeFormatter(value.timeZone).resolvedOptions().timeZone;
  const plans = value.plans.map(({ start, times }, index) => {
    if (typeof start !== "string" || !datePattern.test(start) ||
      new Date(start).toISOString().slice(0, 10) !== start ||
      (index > 0 && start <= value.plans[index - 1].start) ||
      !Array.isArray(times) || times.length > 1440 ||
      times.some((time) => typeof time !== "string" || !timePattern.test(time))) {
      throw new Error("Invalid plan");
    }
    return { start, times: [...new Set(times)].sort() };
  });
  return { timeZone, plans };
}

function response(status, body) {
  const headers = { "Cache-Control": "no-store" };
  return body
    ? Response.json(body, { status, headers })
    : new Response(null, { status, headers });
}

async function readBody(request) {
  if (!request.body || Number(request.headers.get("content-length")) > maxBody) throw new Error("Invalid body");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return JSON.parse(body + decoder.decode());
    size += value.byteLength;
    if (size > maxBody) {
      await reader.cancel();
      throw new Error("Invalid body");
    }
    body += decoder.decode(value, { stream: true });
  }
}

export async function manageReminders(request, store) {
  if (request.method === "GET") {
    return response(200, { publicKey: (await vapidKeys(store)).publicKey });
  }
  if (!["PUT", "DELETE"].includes(request.method)) return response(405);
  if (request.headers.get("origin") !== new URL(request.url).origin) return response(403);
  const token = tokenPattern.exec(request.headers.get("authorization"));
  if (!token) return response(401);

  let revision;
  let settings;
  try {
    const body = await readBody(request);
    revision = body.revision;
    if (!Number.isSafeInteger(revision) || revision < 1) return response(400);
    if (request.method === "PUT") {
      settings = { subscription: validateSubscription(body.subscription), schedule: validateSchedule(body.schedule) };
    }
  } catch {
    return response(400);
  }

  const key = devicePrefix + createHash("sha256").update(token[1]).digest("hex");
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await store.getWithMetadata(key, json);
    const previous = current?.data;
    if (revision <= previous?.revision) return response(revision === previous.revision ? 204 : 409);
    if (settings && previous?.expired === subscriptionHash(settings.subscription)) return response(410);
    const sameSchedule = settings && JSON.stringify(previous?.schedule) === JSON.stringify(settings.schedule);
    const next = settings ? {
      ...settings,
      revision,
      activeSince: sameSchedule ? previous.activeSince : Date.now(),
      sent: previous?.sent ?? []
    } : { revision };
    const result = await store.setJSON(key, next, current ? { onlyIfMatch: current.etag } : { onlyIfNew: true });
    if (result.modified) return response(204);
  }
  return response(503);
}

function clockAt(formatter, instant) {
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function subscriptionHash(subscription) {
  return createHash("sha256").update(subscription.endpoint).digest("hex");
}

async function sendPush(subscription, id, keys) {
  await webPush.sendNotification(subscription, id, {
    vapidDetails: { ...keys, subject: "https://enricomattiasalonia.com/papa/" },
    TTL: 300,
    urgency: "high",
    timeout: 5_000
  });
}

async function notifyDevice(store, key, instants, keys, send) {
  const entry = await store.getWithMetadata(key, json);
  const device = entry?.data;
  if (!device?.subscription) return;
  const clock = timeFormatter(device.schedule.timeZone);
  const slots = instants.map((instant) => ({ instant, ...clockAt(clock, instant) }));
  const recentDays = new Set(slots.map(({ day }) => day));
  let sent = device.sent.filter((id) => recentDays.has(id.slice(0, 10)));
  let etag = entry.etag;
  for (const { instant, day, time } of slots) {
    const id = day + "T" + time;
    if (sent.includes(id) || instant < Math.floor(device.activeSince / minute) * minute) continue;
    const plan = device.schedule.plans.findLast(({ start }) => start <= day);
    if (!plan?.times.includes(time)) continue;

    const claim = await store.setJSON(key, { ...device, sent: [...sent, id] }, { onlyIfMatch: etag });
    if (!claim.modified) return;
    etag = claim.etag;
    try {
      await send(device.subscription, id, keys);
    } catch (error) {
      if ([404, 410].includes(error.statusCode)) {
        await store.setJSON(key, { revision: device.revision, expired: subscriptionHash(device.subscription) }, { onlyIfMatch: etag });
        return;
      }
      if (error.statusCode === 429 || error.statusCode >= 500) {
        // The provider rejected this attempt. The next tick can retry the same slot.
        const release = await store.setJSON(key, { ...device, sent }, { onlyIfMatch: etag });
        if (!release.modified) return;
        etag = release.etag;
        continue;
      }
      // A timeout can mean an accepted message with a lost response.
      console.warn("Saggezza: push delivery could not be confirmed.");
    }
    sent = [...sent, id];
  }
}

export async function sendDueReminders(store, now = Date.now(), send = sendPush) {
  const currentMinute = Math.floor(now / minute) * minute;
  const instants = [currentMinute - minute, currentMinute];
  const { blobs } = await store.list({ prefix: devicePrefix });
  if (!blobs.length) return;
  const keys = await store.get(vapidKey, json);
  if (!keys) return;
  // Limit parallel provider connections while leaving room within the cron time limit.
  for (let index = 0; index < blobs.length; index += 15) {
    const batch = blobs.slice(index, index + 15);
    const results = await Promise.allSettled(batch.map(({ key }) => notifyDevice(store, key, instants, keys, send)));
    if (results.some(({ status }) => status === "rejected")) console.warn("Saggezza: a reminder could not be processed.");
  }
}
