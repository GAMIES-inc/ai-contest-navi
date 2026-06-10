import { existsSync, readFileSync } from "node:fs";

const NOTION_VERSION = "2022-06-28";
const THUMBNAIL_PROPERTY = "サムネイル";

loadDotEnv();

const token = process.env.NOTION_TOKEN;
const databaseId = normalizeNotionId(process.env.NOTION_DATABASE_ID);

if (!token || !databaseId) {
  throw new Error("NOTION_TOKEN and NOTION_DATABASE_ID are required.");
}

const pages = await queryAllPages(databaseId);
const rows = pages.map(readThumbnailState);
const missing = rows.filter((row) => !row.thumbnail);
const needsReview = rows.filter((row) => row.reasons.length > 0);

console.log(`Notion thumbnail audit: total=${rows.length}, missing=${missing.length}, needsReview=${needsReview.length}`);

for (const row of needsReview) {
  console.log(`- ${row.title}: ${row.reasons.join(", ")}`);
  if (row.thumbnail) console.log(`  ${row.thumbnail}`);
}

if (needsReview.length === 0) {
  console.log("All thumbnails look usable.");
}

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

function readThumbnailState(page) {
  const title = getTitle(page.properties?.["コンテスト名"]) || getTitle(page.properties?.Name) || page.id;
  const thumbnail = getThumbnail(page.properties?.[THUMBNAIL_PROPERTY], page.cover);
  const reasons = [];

  if (!thumbnail) {
    reasons.push("missing");
  } else {
    const lower = thumbnail.toLowerCase();
    if (!lower.startsWith("https://")) reasons.push("not-https");
    if (/(favicon|apple-touch-icon|\/icon|logo|mark|symbol)/i.test(thumbnail)) reasons.push("logo-or-icon-like");
    if (thumbnail.includes("s3.us-west-2.amazonaws.com/secure.notion-static.com")) reasons.push("temporary-notion-file-url");
    if (thumbnail === "/brand-thumbnail.svg" || thumbnail.includes("contest-fallback")) reasons.push("fallback-image");
  }

  return { title, thumbnail, reasons };
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

function getUrl(property) {
  return property?.url?.trim() ?? "";
}

function getPlainText(property) {
  if (!property) return "";
  if (property.rich_text) return property.rich_text.map((item) => item.plain_text ?? "").join("").trim();
  if (property.url) return property.url;
  return "";
}

function getThumbnail(property, cover) {
  const fileUrl = property?.files?.map(readFileUrl).find(Boolean);
  return getUrl(property) || getPlainText(property) || fileUrl || readFileUrl(cover) || "";
}

function readFileUrl(file) {
  if (!file) return "";
  return file.type === "external" ? file.external?.url ?? "" : file.file?.url ?? "";
}
