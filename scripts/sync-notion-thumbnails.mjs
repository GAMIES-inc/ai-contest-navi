import { existsSync, readFileSync } from "node:fs";

const NOTION_VERSION = "2022-06-28";
const THUMBNAIL_PROPERTY = "サムネイル";

loadDotEnv();

const token = process.env.NOTION_TOKEN;
const databaseId = normalizeNotionId(process.env.NOTION_DATABASE_ID);
const force = process.argv.includes("--force");

if (!token || !databaseId) {
  throw new Error("NOTION_TOKEN and NOTION_DATABASE_ID are required.");
}

const database = await request(`https://api.notion.com/v1/databases/${databaseId}`);
const thumbnailProperty = database.properties?.[THUMBNAIL_PROPERTY];

if (!thumbnailProperty) {
  await request(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: {
        [THUMBNAIL_PROPERTY]: {
          url: {},
        },
      },
    }),
  });
  console.log(`Created Notion property: ${THUMBNAIL_PROPERTY}`);
}

const refreshedDatabase = thumbnailProperty
  ? database
  : await request(`https://api.notion.com/v1/databases/${databaseId}`);
const thumbnailType = refreshedDatabase.properties?.[THUMBNAIL_PROPERTY]?.type ?? "url";
const pages = await queryAllPages(databaseId);

let updated = 0;
let skipped = 0;
let failed = 0;

for (const page of pages) {
  const title = getTitle(page.properties?.["コンテスト名"]) || getTitle(page.properties?.Name) || page.id;
  const officialUrl = getUrl(page.properties?.["公式URL"]);
  const existingThumbnail = getThumbnail(page.properties?.[THUMBNAIL_PROPERTY], page.cover);

  if (!force && existingThumbnail) {
    console.log(`OK: ${title} already has thumbnail`);
    skipped += 1;
    continue;
  }

  if (!officialUrl || officialUrl === "#") {
    console.log(`SKIP: ${title} has no official URL`);
    skipped += 1;
    continue;
  }

  try {
    const imageUrl = await findOgImage(officialUrl);
    if (!imageUrl) {
      console.log(`SKIP: ${title} has no OGP image`);
      skipped += 1;
      continue;
    }

    await updatePageThumbnail(page.id, imageUrl, thumbnailType);
    console.log(`Updated: ${title} -> ${imageUrl}`);
    updated += 1;
  } catch (error) {
    console.log(`FAIL: ${title} ${error.message}`);
    failed += 1;
  }
}

console.log(`Done. updated=${updated}, skipped=${skipped}, failed=${failed}, thumbnailType=${thumbnailType}`);

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

async function updatePageThumbnail(pageId, imageUrl, type) {
  const properties = {};

  if (type === "url") {
    properties[THUMBNAIL_PROPERTY] = { url: imageUrl };
  } else if (type === "rich_text") {
    properties[THUMBNAIL_PROPERTY] = {
      rich_text: [{ type: "text", text: { content: imageUrl } }],
    };
  } else if (type === "files") {
    properties[THUMBNAIL_PROPERTY] = {
      files: [{ name: "thumbnail", type: "external", external: { url: imageUrl } }],
    };
  }

  await request(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      cover: {
        type: "external",
        external: { url: imageUrl },
      },
      ...(Object.keys(properties).length ? { properties } : {}),
    }),
  });
}

async function findOgImage(pageUrl) {
  const response = await fetch(pageUrl, {
    headers: {
      "User-Agent": "YuruContestNaviBot/1.0 (+https://ai-contest-navi.pages.dev)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`fetch ${response.status}`);
  }

  const html = await response.text();
  const patterns = [
    /<meta\s+[^>]*(?:property|name)=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image["'][^>]*>/i,
    /<meta\s+[^>]*(?:property|name)=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']twitter:image["'][^>]*>/i,
  ];

  const raw = patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean);
  if (!raw || raw.startsWith("data:")) return "";

  return preferHttps(new URL(raw.replace(/&amp;/g, "&"), response.url).toString());
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

function preferHttps(url) {
  return url.startsWith("http://") ? `https://${url.slice("http://".length)}` : url;
}
