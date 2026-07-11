import { existsSync, readFileSync, writeFileSync } from "node:fs";

const NOTION_VERSION = "2022-06-28";
const ACTIVE_STATUSES = new Set(["募集中", "締切間近", "開催予定"]);
const REQUIRED = ["主催者", "公式URL", "締切日", "応募方法", "賞金・賞品", "著作権・二次利用条件"];

loadDotEnv();
const token = process.env.NOTION_TOKEN;
const databaseId = normalizeNotionId(process.env.NOTION_DATABASE_ID);
const checkUrls = process.argv.includes("--check-urls");
const updateUrlChecked = process.argv.includes("--update-url-checked");
const reportPath = argumentValue("--report");

if (!token || !databaseId) throw new Error("NOTION_TOKEN and NOTION_DATABASE_ID are required.");

const pages = await queryAllPages(databaseId);
const today = todayJst();
const results = [];

for (const page of pages) {
  const props = page.properties ?? {};
  const title = titleValue(props["コンテスト名"]) || titleValue(props.Name) || page.id;
  const status = selectValue(props["開催ステータス"]);
  const publicStatus = selectValue(props["公開ステータス"]);
  if (!ACTIVE_STATUSES.has(status) || (publicStatus && publicStatus !== "公開OK")) continue;

  const missing = REQUIRED.filter((name) => !propertyValue(props[name]));
  const url = propertyValue(props["公式URL"]);
  let urlState = "not-checked";
  let urlStatus = null;

  if (checkUrls && url) {
    const checked = await checkUrl(url);
    urlState = checked.ok ? "reachable" : "failed";
    urlStatus = checked.status;
    if (checked.ok && updateUrlChecked && props["URL疎通確認日"]) {
      await notion(`/pages/${page.id}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: { "URL疎通確認日": { date: { start: today } } } }),
      });
    }
  }

  results.push({ title, status, deadline: propertyValue(props["締切日"]), missing, officialUrl: url, urlState, urlStatus });
}

const summary = {
  checkedAt: today,
  activePublished: results.length,
  missingRequired: results.filter((item) => item.missing.length > 0).length,
  brokenUrls: results.filter((item) => item.urlState === "failed").length,
  rows: results,
};

console.log(`Quality audit: active=${summary.activePublished}, missing=${summary.missingRequired}, brokenUrls=${summary.brokenUrls}`);
for (const item of results.filter((row) => row.missing.length || row.urlState === "failed")) {
  console.log(`- ${item.title}: ${item.missing.length ? `missing=${item.missing.join(",")}` : ""}${item.urlState === "failed" ? ` url=${item.urlStatus ?? "error"}` : ""}`);
}
if (reportPath) writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

async function checkUrl(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0 YuruContestNaviQualityCheck/1.0" },
    });
    return { ok: response.ok || [401, 403, 405, 429].includes(response.status), status: response.status };
  } catch {
    return { ok: false, status: null };
  }
}

async function queryAllPages(id) {
  const rows = [];
  let start_cursor;
  do {
    const data = await notion(`/databases/${id}/query`, { method: "POST", body: JSON.stringify({ page_size: 100, start_cursor }) });
    rows.push(...(data.results ?? []));
    start_cursor = data.has_more ? data.next_cursor : undefined;
  } while (start_cursor);
  return rows;
}

async function notion(endpoint, init = {}) {
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    method: "GET", ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Notion-Version": NOTION_VERSION, ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Notion API ${response.status}: ${await response.text()}`);
  return response.json();
}

function propertyValue(property) {
  if (!property) return "";
  if (property.type === "title" || property.title) return titleValue(property);
  if (property.rich_text) return property.rich_text.map((item) => item.plain_text ?? "").join("").trim();
  if (property.url) return property.url.trim();
  if (property.date?.start) return property.date.start.slice(0, 10);
  if (property.select?.name) return property.select.name.trim();
  if (property.multi_select) return property.multi_select.map((item) => item.name).join(",");
  if (property.files?.length) return "file";
  return "";
}
function titleValue(property) { return property?.title?.map((item) => item.plain_text ?? "").join("").trim() ?? ""; }
function selectValue(property) { return property?.select?.name?.trim() ?? ""; }
function argumentValue(name) { return process.argv.find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1); }
function todayJst() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function loadDotEnv() { if (!existsSync(".env")) return; for (const line of readFileSync(".env", "utf8").split(/\r?\n/u)) { const i = line.indexOf("="); if (i < 1 || line.trim().startsWith("#")) continue; const key = line.slice(0, i).trim(); const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, ""); if (!process.env[key]) process.env[key] = value; } }
function normalizeNotionId(value) { if (!value) return ""; return value.trim().replaceAll("-", "").match(/[0-9a-fA-F]{32}/)?.[0] ?? value.trim(); }
