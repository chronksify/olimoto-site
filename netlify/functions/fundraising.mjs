// GET /api/fundraising -> the live total from the JustGiving page.
// Netlify caches the answer for an hour, so JustGiving is asked at most about once an hour.
// If JustGiving can't be read, it falls back to the total saved in the editor (data/site.json).
import site from "../../data/site.json" with { type: "json" };
import { parseJustGiving } from "./lib/justgiving.mjs";

export const config = { path: "/api/fundraising" };

export default async () => {
  const saved = site.fundraising;
  let body = { raised: saved.raised, target: saved.target, source: "saved", checked: saved.asOf };
  try {
    const res = await fetch(saved.url, { headers: { "user-agent": "olimoto.co.uk fundraising total" }, signal: AbortSignal.timeout(6000) });
    const live = res.ok ? parseJustGiving(await res.text()) : null;
    if (live) body = { raised: live.raised, target: live.target || saved.target, source: "justgiving", checked: new Date().toISOString() };
  } catch {
    // keep the saved total
  }
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
      "netlify-cdn-cache-control": body.source === "justgiving" ? "public, durable, s-maxage=3600, stale-while-revalidate=86400" : "public, s-maxage=300",
    },
  });
};
