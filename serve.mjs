// Local preview of dist/ only. The /api routes need Netlify, so here they answer 503.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT) || 4321;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".webmanifest": "application/manifest+json" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    res.writeHead(503, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "local-preview" }));
  }
  if (req.method === "POST") { res.writeHead(503); return res.end(); }
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  if (!p || p.endsWith("/") || p.endsWith("\\")) p += "index.html";
  if (!extname(p)) p += ".html";
  try {
    const body = await readFile(join("dist", p));
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/html" });
    res.end(await readFile("dist/404.html").catch(() => "Not found"));
  }
}).listen(PORT, () => console.log(`Preview on http://localhost:${PORT}`));
