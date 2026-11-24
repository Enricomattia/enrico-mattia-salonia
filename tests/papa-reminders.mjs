import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import webPush from "web-push";
import { manageReminders, sendDueReminders } from "../netlify/lib/papa-reminders.mjs";

const url = "https://enricomattiasalonia.com/api/papa/reminders";
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/example",
  keys: { p256dh: webPush.generateVAPIDKeys().publicKey, auth: randomBytes(16).toString("base64url") }
};

function fixture() {
  const data = new Map();
  let writes = 0;
  const store = {
    getWithMetadata: async (key) => structuredClone(data.get(key)),
    get: async (key) => structuredClone(data.get(key)?.data),
    async setJSON(key, value, { onlyIfNew, onlyIfMatch } = {}) {
      if ((onlyIfNew && data.has(key)) || (onlyIfMatch && data.get(key)?.etag !== onlyIfMatch)) {
        return { modified: false };
      }
      const etag = String(++writes);
      data.set(key, { data: structuredClone(value), etag });
      return { modified: true, etag };
    },
    async list({ prefix }) {
      return { blobs: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) };
    }
  };
  const token = randomBytes(32).toString("hex");
  async function request(method, body, origin = new URL(url).origin) {
    return manageReminders(new Request(url, {
      method,
      headers: { origin, authorization: `Bearer ${token}` },
      body: body && JSON.stringify(body)
    }), store);
  }
  const deliveries = [];
  async function dispatch(at, send = (_subscription, id) => deliveries.push(id)) {
    await sendDueReminders(store, Date.parse(at), send);
  }
  return { data, request, dispatch, deliveries };
}

function settings(revision, plans, device = subscription) {
  return { revision, subscription: device, schedule: { timeZone: "Europe/Rome", plans } };
}

test("the public key remains stable and only delivery details and times are saved", async () => {
  const { data, request } = fixture();
  const responses = await Promise.all([request("GET"), request("GET")]);
  const keys = await Promise.all(responses.map((response) => response.json()));
  assert.deepEqual(keys[0], keys[1]);
  assert.deepEqual(Object.keys(keys[0]), ["publicKey"]);

  const plans = [{ start: "2026-11-24", times: ["09:00", "09:00"], name: "Private dosage name" }];
  const body = { ...settings(1, plans), marks: { today: true } };
  assert.equal((await request("PUT", body, "https://another.example")).status, 403);
  for (const endpoint of [
    "https://localhost/fcm/send/example", "https://fcm.googleapis.com:8888/fcm/send/example",
    "https://private@fcm.googleapis.com/fcm/send/example", "https://fcm.googleapis.com/fcm/send/example?redirect=1"
  ]) {
    assert.equal((await request("PUT", { ...body, subscription: { ...subscription, endpoint } })).status, 400);
  }
  assert.equal((await request("PUT", body)).status, 204);
  const [, entry] = [...data.values()];
  assert.deepEqual(entry.data.schedule.plans, [{ start: "2026-11-24", times: ["09:00"] }]);
  assert.equal(JSON.stringify(entry).includes("marks"), false);
  assert.equal(JSON.stringify(entry).includes("Private dosage name"), false);
});

test("the current local plan runs once per hour slot through retries and plan changes", async () => {
  const { request, dispatch, deliveries } = fixture();
  await request("GET");
  const today = { start: "2090-01-20", times: ["08:55", "09:00", "09:00"] };
  const tomorrow = { start: "2090-01-21", times: ["20:00"] };
  assert.equal((await request("PUT", settings(1, [today, tomorrow]))).status, 204);
  await dispatch("2090-01-20T07:59:39Z");
  assert.deepEqual(deliveries, []);
  await Promise.all([dispatch("2090-01-20T08:00:12Z"), dispatch("2090-01-20T08:00:12Z")]);
  await dispatch("2090-01-20T08:01:09Z");
  await dispatch("2090-01-21T08:00:01Z");
  await dispatch("2090-01-21T19:00:00Z", () => { throw Object.assign(new Error(), { statusCode: 503 }); });
  await dispatch("2090-01-21T19:01:04Z");
  assert.deepEqual(deliveries, ["2090-01-20T09:00", "2090-01-21T20:00"]);

  assert.equal((await request("DELETE", { revision: 3 })).status, 204);
  assert.equal((await request("PUT", settings(2, [today, tomorrow]))).status, 409);
  await dispatch("2090-01-22T19:00:00Z");
  assert.equal(deliveries.length, 2);
});

test("repeated local times at the autumn clock change do not alert twice", async () => {
  const { request, dispatch, deliveries } = fixture();
  await request("GET");
  await request("PUT", settings(1, [{ start: "2090-01-01", times: ["02:30"] }]));
  await dispatch("2090-10-29T00:30:05Z");
  await dispatch("2090-10-29T01:30:05Z");
  assert.deepEqual(deliveries, ["2090-10-29T02:30"]);
});

test("an expired endpoint is retired and a replacement can resume the same plan", async () => {
  const { request, dispatch, deliveries } = fixture();
  const plans = [{ start: "2090-01-01", times: ["09:00"] }];
  await request("GET");
  await request("PUT", settings(1, plans));
  await dispatch("2090-01-20T08:00:00Z", () => { throw Object.assign(new Error(), { statusCode: 410 }); });
  assert.equal((await request("PUT", settings(2, plans))).status, 410);
  const replacement = { ...subscription, endpoint: "https://fcm.googleapis.com/fcm/send/replacement" };
  assert.equal((await request("PUT", settings(3, plans, replacement))).status, 204);
  await dispatch("2090-01-21T08:00:00Z");
  assert.deepEqual(deliveries, ["2090-01-21T09:00"]);
});
