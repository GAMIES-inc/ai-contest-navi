const routes = [
  "/",
  "/contests",
  "/archive",
  "/guides",
  "/guides/start-ai-contest",
  "/guides/how-to-read-contest-guidelines",
  "/guides/how-to-make-ai-video",
  "/guides/how-to-make-ai-manga",
  "/guides/ai-contest-checklist",
  "/guides/how-to-choose-beginner-contest",
  "/contests/first-ai-manga-contest",
  "/contests/dhu-u18-artist-contest-2026-ai",
  "/contests/aaiff-2026",
  "/contests/26sec-carnival-9",
  "/contests/ai-creativity-awards-2026",
  "/categories/ai-image",
  "/categories/ai-video",
  "/categories/ai-manga",
  "/categories/ai-music",
  "/categories/other",
  "/calendar",
  "/submit",
  "/404.html",
];

const assetRoutes = [
  "/robots.txt",
  "/sitemap-index.xml",
  "/sitemap-0.xml",
  "/og-home.svg",
  "/og-default.svg",
  "/og-contest.svg",
  "/brand-thumbnail.svg",
];

const baseUrl = normalizeBaseUrl(
  process.argv.find((arg) => arg.startsWith("--base="))?.slice("--base=".length) || process.env.SITE_URL,
);

if (!baseUrl) {
  throw new Error("Set SITE_URL or pass --base=https://example.pages.dev");
}

const failures = [];
const checkedOgImages = new Set();

console.log(`QA target: ${baseUrl}`);

for (const route of routes) {
  const url = new URL(route, baseUrl).toString();
  const response = await fetch(url, { redirect: "follow" });
  const html = await response.text();

  assert(response.status === 200, `${route} returned ${response.status}`);
  assert(match(html, /<title>.+?<\/title>/is), `${route} missing title`);
  assert(match(html, /<meta\s+name=["']description["'][^>]+>/i), `${route} missing description`);

  const canonical = attr(html, /<link\s+rel=["']canonical["'][^>]*>/i, "href");
  assert(Boolean(canonical), `${route} missing canonical`);
  if (canonical) {
    assert(canonical.startsWith(baseUrl), `${route} canonical is not SITE_URL based: ${canonical}`);
  }

  const ogUrl = attr(html, /<meta\s+property=["']og:url["'][^>]*>/i, "content");
  assert(Boolean(ogUrl), `${route} missing og:url`);
  if (ogUrl) {
    assert(ogUrl.startsWith(baseUrl), `${route} og:url is not SITE_URL based: ${ogUrl}`);
  }

  const ogImage = attr(html, /<meta\s+property=["']og:image["'][^>]*>/i, "content");
  assert(Boolean(ogImage), `${route} missing og:image`);
  if (ogImage && !checkedOgImages.has(ogImage)) {
    checkedOgImages.add(ogImage);
    const imageResponse = await fetch(ogImage, { redirect: "follow" });
    assert(imageResponse.ok, `${route} og:image failed: ${ogImage} ${imageResponse.status}`);
  }

  console.log(`OK ${route}`);
}

for (const route of assetRoutes) {
  const url = new URL(route, baseUrl).toString();
  const response = await fetch(url, { redirect: "follow" });
  assert(response.status === 200, `${route} returned ${response.status}`);
  console.log(`OK ${route}`);
}

const robots = await text("/robots.txt");
assert(robots.includes(`${baseUrl}/sitemap-index.xml`), "robots.txt does not point to sitemap-index.xml");

const sitemapIndex = await text("/sitemap-index.xml");
assert(sitemapIndex.includes(`${baseUrl}/sitemap-0.xml`), "sitemap-index.xml does not point to sitemap-0.xml");

const sitemap = await text("/sitemap-0.xml");
for (const route of routes.filter((route) => route !== "/404.html")) {
  const expected = new URL(route, baseUrl).toString().replace(/\/?$/, "/");
  assert(sitemap.includes(expected), `sitemap missing ${expected}`);
}

if (failures.length > 0) {
  console.error("\nQA failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nQA passed.");

async function text(route) {
  const response = await fetch(new URL(route, baseUrl));
  return response.text();
}

function normalizeBaseUrl(value) {
  if (!value) return "";
  return value.trim().replace(/\/+$/, "");
}

function match(text, pattern) {
  return pattern.test(text);
}

function attr(html, tagPattern, name) {
  const tag = html.match(tagPattern)?.[0] ?? "";
  const pattern = new RegExp(`${name}=["']([^"']+)["']`, "i");
  return tag.match(pattern)?.[1] ?? "";
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
