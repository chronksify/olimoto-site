// GET  /api/messages  -> approved messages, newest first
// POST /api/messages  -> checks a new message and holds it for Joe to approve
import { getStore } from "@netlify/blobs";
import { createHash, randomUUID } from "node:crypto";
import { checkMessage } from "./lib/filter.mjs";

export const config = { path: "/api/messages" };

const PER_HOUR = 3;
const SHOW = 60;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req, context) => {
  const store = getStore({ name: "messages", consistency: "strong" });

  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix: "approved/" });
    const keys = blobs.map((b) => b.key).sort().reverse().slice(0, SHOW);
    const items = (await Promise.all(keys.map((k) => store.get(k, { type: "json" })))).filter(Boolean);
    return json(200, {
      messages: items.map(({ id, name, place, message, createdAt }) => ({ id, name, place, message, createdAt })),
    });
  }

  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  let input;
  try {
    input = await req.json();
  } catch {
    return json(400, { error: "Something went wrong sending that. Try again." });
  }

  // Hidden field only bots fill in. Pretend it worked so they move on.
  if (input?.company) return json(202, { status: "pending" });

  const result = checkMessage(input);
  if (!result.ok) return json(422, { field: result.field, error: result.error });

  // Rate limit by a salted hash of the IP, so no raw IPs are stored.
  const salt = Netlify.env.get("MESSAGE_SALT") || "olimoto";
  const who = createHash("sha256").update(salt + (context.ip || "unknown")).digest("hex").slice(0, 32);
  const rateKey = `rate/${who}`;
  const now = Date.now();
  const rate = (await store.get(rateKey, { type: "json" })) || { times: [] };
  const recent = rate.times.filter((t) => now - t < 3600_000);
  if (recent.length >= PER_HOUR) {
    return json(429, { error: "You've sent a few messages already. Try again in an hour." });
  }
  await store.setJSON(rateKey, { times: [...recent, now] });

  const id = randomUUID();
  const createdAt = new Date(now).toISOString();
  // Keys sort by time. No colons, so local testing on Windows works too.
  const stamp = createdAt.replace(/[:.]/g, "-");
  await store.setJSON(`pending/${stamp}_${id}`, { id, ...result.clean, createdAt });

  return json(202, { status: "pending" });
};
