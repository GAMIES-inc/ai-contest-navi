import { appendFileSync, existsSync, readFileSync } from "node:fs";

const NOTION_VERSION = "2022-06-28";
const ACTIVE = new Set(["募集中", "締切間近", "開催予定"]);
loadDotEnv();
const token = process.env.NOTION_TOKEN;
const databaseId = normalizeNotionId(process.env.NOTION_DATABASE_ID);
if (!token || !databaseId) throw new Error("NOTION_TOKEN and NOTION_DATABASE_ID are required.");

const today = dateInJst(new Date());
const reviewLimit = new Date(`${today}T00:00:00+09:00`);
reviewLimit.setDate(reviewLimit.getDate() + 7);
const staleLimit = new Date(`${today}T00:00:00+09:00`);
staleLimit.setDate(staleLimit.getDate() - 30);

const pages = await queryAllPages(databaseId);
const due = [];
const stale = [];

for (const page of pages) {
  const props = page.properties ?? {};
  const status = props["開催ステータス"]?.select?.name ?? "";
  if (!ACTIVE.has(status)) continue;
  const title = text(props["コンテスト名"]) || text(props.Name) || page.id;
  const deadline = props["締切日"]?.date?.start?.slice(0, 10) ?? "";
  const verified = props["最終確認日"]?.date?.start?.slice(0, 10) ?? "";
  if (deadline && deadline >= today && deadline <= dateInJst(reviewLimit)) due.push({ title, deadline });
  if (!verified || verified < dateInJst(staleLimit)) stale.push({ title, verified: verified || "未確認" });
}

const lines = [
  "## コンテスト再確認リマインダー",
  "",
  `- 7日以内に締切: ${due.length}件`,
  `- 最終確認が30日超または未入力: ${stale.length}件`,
  "",
  ...due.map((item) => `- 締切 ${item.deadline}: ${item.title}`),
  ...stale.map((item) => `- 確認日 ${item.verified}: ${item.title}`),
];
const output = `${lines.join("\n")}\n`;
console.log(output);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, output, "utf8");
if (due.length || stale.length) process.exitCode = 1;

async function queryAllPages(id) { const rows = []; let start_cursor; do { const data = await request(`/databases/${id}/query`, { method: "POST", body: JSON.stringify({ page_size: 100, start_cursor }) }); rows.push(...(data.results ?? [])); start_cursor = data.has_more ? data.next_cursor : undefined; } while (start_cursor); return rows; }
async function request(endpoint, init = {}) { const response = await fetch(`https://api.notion.com/v1${endpoint}`, { method: "GET", ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Notion-Version": NOTION_VERSION } }); if (!response.ok) throw new Error(`Notion API ${response.status}: ${await response.text()}`); return response.json(); }
function text(property) { return property?.title?.map((item) => item.plain_text ?? "").join("").trim() ?? ""; }
function dateInJst(date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function loadDotEnv() { if (!existsSync(".env")) return; for (const line of readFileSync(".env", "utf8").split(/\r?\n/u)) { const i = line.indexOf("="); if (i < 1 || line.trim().startsWith("#")) continue; const key = line.slice(0, i).trim(); const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, ""); if (!process.env[key]) process.env[key] = value; } }
function normalizeNotionId(value) { if (!value) return ""; return value.trim().replaceAll("-", "").match(/[0-9a-fA-F]{32}/)?.[0] ?? value.trim(); }
