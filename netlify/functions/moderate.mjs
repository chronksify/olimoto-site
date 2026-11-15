// Joe's moderation queue. Needs the MODERATION_KEY environment variable set in Netlify.
// GET  /api/moderate                    -> pending and approved messages
// POST /api/moderate {key, action}      -> action is "approve", "reject" or "remove"
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

export const config = { path: "/api/moderate" };

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const digest = (s) => createHash("sha256").update(String(s)).digest();

function authorised(req) {
  const expected = Netlify.env.get("MODERATION_KEY");
  if (!expected) return null;
  const given = req.headers.get("x-moderation-key") || "";
  return timingSafeEqual(digest(given), digest(expected));
}

async function readAll(store, prefix) {
  const { blobs } = await store.list({ prefix });
  const keys = blobs.map((b) => b.key).sort().reverse();
  const items = await Promise.all(keys.map(async (key) => ({ key, ...(await store.get(key, { type: "json" })) })));
  return items.filter((i) => i.id);
}

export default async (req) => {
  const ok = authorised(req);
  if (ok === null) return json(503, { error: "Moderation isn't set up yet. Add MODERATION_KEY in Netlify." });
  if (!ok) return json(401, { error: "That key isn't right." });

  const store = getStore({ name: "messages", consistency: "strong" });

  if (req.method === "GET") {
    return json(200, {
      pending: await readAll(store, "pending/"),
      approved: (await readAll(store, "approved/")).slice(0, 100),
    });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });

  const { key, action } = await req.json().catch(() => ({}));
  if (typeof key !== "string" || !/^(pending|approved)\/[\w:.\-]+$/.test(key)) {
    return json(400, { error: "Unknown message." });
  }
  const item = await store.get(key, { type: "json" });
  if (!item) return json(404, { error: "That message has already been dealt with." });

  if (action === "approve" && key.startsWith("pending/")) {
    await store.setJSON(key.replace(/^pending\//, "approved/"), { ...item, approvedAt: new Date().toISOString() });
    await store.delete(key);
    return json(200, { done: "approved" });
  }
  if ((action === "reject" && key.startsWith("pending/")) || (action === "remove" && key.startsWith("approved/"))) {
    await store.delete(key);
    return json(200, { done: action });
  }
  return json(400, { error: "Unknown action." });
};
