// Builds src/pages/*.html into dist/ by wrapping each page in the shared layout.
// Each page starts with <!--meta {...} --> holding its title, description and nav slug.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";

const SRC = "src", OUT = "dist";
// Netlify sets URL to the site's main address, so share previews point at the right place before and after the domain moves.
const SITE_URL = (process.env.URL || "https://olimoto.co.uk").replace(/\/$/, "");
const layout = readFileSync(join(SRC, "partials/layout.html"), "utf8");
// Content the team edits in the CMS at /admin. Each data file is one CMS section.
const site = JSON.parse(readFileSync("data/site.json", "utf8"));
const updates = JSON.parse(readFileSync("data/updates.json", "utf8")).updates.slice().sort((a, b) => b.date.localeCompare(a.date));
const supporters = JSON.parse(readFileSync("data/supporters.json", "utf8")).supporters;
const milestones = JSON.parse(readFileSync("data/milestones.json", "utf8")).milestones.slice().sort((a, b) => a.date.localeCompare(b.date));
const funds = site.fundraising;
const gbp = (n) => "£" + Number(n).toLocaleString("en-GB");
const imgSrc = (p) => (p.startsWith("/") || p.startsWith("http") ? p : "/assets/img/social/" + p);
const img = (u, cls = "") => u.image ? `<img${cls ? ` class="${cls}"` : ""} src="${imgSrc(u.image)}" alt="${esc(u.alt || "")}" loading="lazy" decoding="async">` : "";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// "2026-11-05" shows as 5 November 2026. Ticking "month only" in the CMS shows November 2026.
const fmtDate = (d, monthOnly) => new Date(d).toLocaleDateString("en-GB", monthOnly || d.length === 7 ? { month: "long", year: "numeric" } : { day: "numeric", month: "long", year: "numeric" });
const fmtShort = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// The departure time is entered as UK time. Work out the matching UTC moment for the countdown, allowing for BST.
function ukToUtc(date, time) {
  const guess = new Date(`${date}T${time}:00Z`);
  const off = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "shortOffset" }).formatToParts(guess).find((p) => p.type === "timeZoneName").value;
  const h = Number((off.match(/[+-]\d+/) || ["0"])[0]);
  return new Date(guess.getTime() - h * 3600000).toISOString();
}
const timeLabel = (t) => {
  const [h, m] = t.split(":").map(Number);
  if (h === 12 && !m) return "12 noon";
  return (h % 12 || 12) + (m ? "." + String(m).padStart(2, "0") : "") + (h < 12 ? "am" : "pm");
};
const dep = site.departure, lon = site.londonStart;
// {{tokens}} usable in any page or the layout.
const tokens = {
  "depart-date": fmtDate(dep.date), "depart-short": fmtShort(dep.date), "depart-time": timeLabel(dep.time),
  "depart-month": new Date(dep.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
  "depart-month-long": new Date(dep.date).toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
  "depart-iso": ukToUtc(dep.date, dep.time), "depart-place": dep.place,
  "london-date": fmtDate(lon.date), "london-short": fmtShort(lon.date),
};

const blocks = {
  updates: (n) =>
    updates.slice(0, n ? +n : undefined).map((u) => `
      <article class="update${u.image ? " update--photo" : ""}">
        ${img(u)}
        <time datetime="${u.date}">${fmtDate(u.date, u.monthOnly)}</time>
        <h3>${esc(u.title)}</h3>
        <p>${esc(u.text)}</p>
      </article>`).join(""),
  patches: (n) =>
    supporters.slice(0, n ? +n : undefined).map((s, i) => `
      <a class="patch patch--${i % 3}" href="${s.url}" target="_blank" rel="noopener">
        <span class="patch__name">${esc(s.name)}</span>
        <span class="patch__line">${esc(s.line)}</span>
      </a>`).join(""),
  logbook: (n) =>
    updates.filter((u) => u.image).slice(0, n ? +n : undefined).map((u) => `
      <li class="log">
        ${img(u)}
        <time datetime="${u.date}">${fmtDate(u.date, u.monthOnly)}</time>
        <b>${esc(u.title)}</b>
      </li>`).join(""),
  raised: () => {
    const pct = Math.min(100, (funds.raised / funds.target) * 100);
    // The saved total is the fallback. On the live site motion.js swaps in the current JustGiving total from /api/fundraising.
    return `<div class="raised" role="img" aria-label="${gbp(funds.raised)} raised of a ${gbp(funds.target)} target" data-raised="${funds.raised}" data-target="${funds.target}">
        <p class="raised__sum"><b data-gbp="${funds.raised}">${gbp(funds.raised)}</b> raised of <span data-gbp-target>${gbp(funds.target)}</span></p>
        <div class="raised__bar"><span style="width:${pct.toFixed(1)}%"></span></div>
        <p class="raised__asof" data-asof>From the JustGiving page, ${fmtDate(funds.asOf)}</p>
      </div>`;
  },
  "donate-url": () => funds.url,
  latest: () => {
    const u = updates[0];
    return u ? `<p class="small"><time datetime="${u.date}">${fmtDate(u.date, u.monthOnly)}</time></p><p><b>${esc(u.title)}</b></p>` : "";
  },
  "supporter-count": () => String(supporters.length),
  "supporter-names": () =>
    supporters.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join('<span aria-hidden="true"> · </span>'),
  // Home page: the dated steps on the road to the start line, oldest first.
  milestones: () =>
    milestones.map((m) => `<li class="rb-row">
        <time datetime="${m.date}">${fmtShort(m.date)}</time>
        <div class="rb-row__notes"><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p></div>${m.image ? `
        <img class="rb-row__pic" src="${imgSrc(m.image)}" alt="${esc(m.alt || "")}" loading="lazy" decoding="async">` : ""}
      </li>`).join("\n      "),
  // Logo grid. A supporter with no logo yet shows as their name in the same tile.
  "supporter-logos": () =>
    `<ul class="logos">${supporters.map((s) => `
      <li><a class="logos__tile${s.logoBg === "dark" ? " logos__tile--dark" : ""}" href="${s.url}" target="_blank" rel="noopener" title="${esc(s.name)}${s.line ? ": " + esc(s.line) : ""}">${s.logo ? `<img src="${imgSrc(s.logo)}" alt="${esc(s.name)}" loading="lazy" decoding="async">` : `<span>${esc(s.name)}</span>`}</a></li>`).join("")}</ul>`,
  "supporter-list": () =>
    `<ul class="roster">${supporters.map((s) => `
      <li><a href="${s.url}" target="_blank" rel="noopener"><b>${esc(s.name)}</b><span>${esc(s.line)}</span></a></li>`).join("")}</ul>`,
};

const sitemap = [];
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(SRC, "assets"), join(OUT, "assets"), { recursive: true });
cpSync(join(SRC, "admin"), join(OUT, "admin"), { recursive: true }); // the CMS editor at /admin

for (const file of readdirSync(join(SRC, "pages")).filter((f) => f.endsWith(".html"))) {
  const raw = readFileSync(join(SRC, "pages", file), "utf8");
  const m = raw.match(/^<!--meta\s+([\s\S]*?)-->/);
  if (!m) throw new Error(`${file} is missing its <!--meta {...} --> header`);
  const meta = JSON.parse(m[1]);
  const content = raw.slice(m[0].length);

  let html = layout
    .replace("{{content}}", content)
    .replace(/\{\{(updates|logbook|raised|donate-url|latest|patches|milestones|supporter-count|supporter-names|supporter-logos|supporter-list)(?::(\d+))?\}\}/g, (_, k, n) => blocks[k](n))
    .replaceAll("{{title}}", esc(meta.title))
    .replaceAll("{{description}}", esc(meta.description))
    .replaceAll("{{page-url}}", SITE_URL + (file === "index.html" ? "/" : "/" + file.replace(/.html$/, "")))
    .replaceAll("{{share-image}}", SITE_URL + "/assets/img/share.jpg")
    .replace("{{head}}", meta.head || "")
    .replace("{{scripts}}", meta.scripts || "")
    .replace("{{slug}}", meta.slug);
  html = html.replace(/\{\{active:(\w+)\}\}/g, (_, s) => (s === meta.slug ? ' aria-current="page"' : ""));
  html = html.replace(/\{\{([a-z-]+)\}\}/g, (all, k) => (k in tokens ? esc(tokens[k]) : all));
  const left = html.match(/\{\{[a-z:-]+(?::\d+)?\}\}/);
  if (left) throw new Error(`${file}: unknown token ${left[0]}`);
  writeFileSync(join(OUT, file), html);
  if (file !== "404.html" && !/noindex/.test(meta.head || "")) sitemap.push(SITE_URL + (file === "index.html" ? "/" : "/" + file.replace(/\.html$/, "")));
}
// For search engines: the list of public pages, and where to find it.
writeFileSync(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.sort().map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`);
writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nDisallow: /admin/\nDisallow: /moderate\nDisallow: /studio\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
console.log("Built", readdirSync(OUT).filter((f) => f.endsWith(".html")).length, "pages into dist/");
