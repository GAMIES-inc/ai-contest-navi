import { existsSync, readFileSync } from "node:fs";

const NOTION_VERSION = "2022-06-28";

const slugByTitle = new Map([
  ["第1回 アイマンガコンテスト", "first-ai-manga-contest"],
  ["U-18アーティストコンテスト2026 AI作品部門", "dhu-u18-artist-contest-2026-ai"],
  ["AAIFF 2026 - Astana AI Film Festival", "aaiff-2026"],
  ["26秒のカーニバル 第九回", "26sec-carnival-9"],
  ["2026 AI Creativity Awards", "ai-creativity-awards-2026"],
]);

loadDotEnv();

const token = process.env.NOTION_TOKEN;
const databaseId = normalizeNotionId(process.env.NOTION_DATABASE_ID);

if (!token || !databaseId) {
  throw new Error("NOTION_TOKEN and NOTION_DATABASE_ID are required.");
}

const database = await request(`https://api.notion.com/v1/databases/${databaseId}`);
const slugPropertyName = database.properties?.slug ? "slug" : database.properties?.["スラッグ"] ? "スラッグ" : "slug";

if (!database.properties?.[slugPropertyName]) {
  await request(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: {
        [slugPropertyName]: {
          rich_text: {},
        },
      },
    }),
  });
  console.log(`Created Notion property: ${slugPropertyName}`);
}

const pages = await queryAllPages(databaseId);
let updated = 0;
let skipped = 0;

for (const page of pages) {
  const title = getTitle(page.properties?.["コンテスト名"]) || getTitle(page.properties?.Name);
  const slug = slugByTitle.get(title);

  if (!slug) {
    skipped += 1;
    continue;
  }

  const current = getPlainText(page.properties?.[slugPropertyName]);
  if (current === slug) {
    console.log(`OK: ${title} -> ${slug}`);
    skipped += 1;
    continue;
  }

  await request(`https://api.notion.com/v1/pages/${page.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: {
        [slugPropertyName]: {
          rich_text: [
            {
              type: "text",
              text: { content: slug },
            },
          ],
        },
      },
    }),
  });

  console.log(`Updated: ${title} -> ${slug}`);
  updated += 1;
}

console.log(`Done. updated=${updated}, skipped=${skipped}, slugProperty=${slugPropertyName}`);

async function queryAllPages(id) {
  const pages = [];
  let start_cursor;

  do {
    const response = await request(`https://api.notion.com/v1/databases/${id}/query`, {
      method: "POST",
      body: JSON.stringify({ start_cursor }),
    });

    pages.push(...(response.results ?? []));
    start_cursor = response.has_more ? response.next_cursor : undefined;
  } while (start_cursor);

  return pages;
}

async function request(url, init = {}) {
  const response = await fetch(url, {
    method: "GET",
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Notion API ${response.status}: ${body}`);
  }

  return response.json();
}

function loadDotEnv() {
  if (!existsSync(".env")) return;

  const lines = readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

function normalizeNotionId(value) {
  if (!value) return undefined;
  const trimmed = value.trim();
  const uuid = trimmed.match(/[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}/);
  return uuid?.[0].replace(/-/g, "") ?? trimmed.replace(/^collection:\/\//, "");
}

function getTitle(property) {
  return property?.title?.map((item) => item.plain_text ?? "").join("").trim() ?? "";
}

function getPlainText(property) {
  return property?.rich_text?.map((item) => item.plain_text ?? "").join("").trim() ?? "";
}
