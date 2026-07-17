import { existsSync, readFileSync } from "node:fs";

const NOTION_VERSION = "2022-06-28";
const STATUS_PROPERTY = "開催ステータス";
const DEADLINE_PROPERTY = "締切日";
const CHECKED_AT_PROPERTY = "最終確認日";
const CALENDAR_NOTE_PROPERTY = "カレンダー表示補足";
const ENDED_STATUS = "終了";
const ACTIVE_STATUSES = new Set(["募集中", "締切間近", "開催予定"]);

loadDotEnv();

const token = process.env.NOTION_TOKEN;
const databaseId = normalizeNotionId(process.env.NOTION_DATABASE_ID);
const dryRun = process.argv.includes("--dry-run");
const verbose = process.argv.includes("--verbose");
const today = getArgumentValue("--today") ?? getTodayJst();

if (!token || !databaseId) {
  throw new Error("NOTION_TOKEN and NOTION_DATABASE_ID are required.");
}

const pages = await queryAllPages(databaseId);
let archived = 0;
let alreadyEnded = 0;
let active = 0;
let skipped = 0;

for (const page of pages) {
  const props = page.properties ?? {};
  const title = verbose ? getTitle(props["コンテスト名"]) || getTitle(props.Name) || page.id : "";
  const deadline = getDate(props[DEADLINE_PROPERTY]);
  const status = getSelectName(props[STATUS_PROPERTY]);

  if (!deadline) {
    skipped += 1;
    continue;
  }

  if (deadline >= today) {
    active += 1;
    continue;
  }

  if (status === ENDED_STATUS) {
    alreadyEnded += 1;
    continue;
  }

  if (status && !ACTIVE_STATUSES.has(status)) {
    if (verbose) console.log(`SKIP: ${title} deadline=${deadline} status=${status}`);
    skipped += 1;
    continue;
  }

  const note = `${deadline}締切のため、${today}時点で自動アーカイブ`;
  if (dryRun) {
    if (verbose) console.log(`DRY: ${title} deadline=${deadline} status=${status || "(blank)"} -> ${ENDED_STATUS}`);
  } else {
    await request(`https://api.notion.com/v1/pages/${page.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          [STATUS_PROPERTY]: { select: { name: ENDED_STATUS } },
          [CHECKED_AT_PROPERTY]: { date: { start: today } },
          [CALENDAR_NOTE_PROPERTY]: richTextProperty(note),
        },
      }),
    });
    if (verbose) console.log(`Archived: ${title} deadline=${deadline}`);
  }

  archived += 1;
}

console.log(
  `Done. today=${today}, archived=${archived}, alreadyEnded=${alreadyEnded}, activeOrToday=${active}, skipped=${skipped}, dryRun=${dryRun}`,
);

async function queryAllPages(id) {
  const pages = [];
  let start_cursor;

  do {
    const response = await request(`https://api.notion.com/v1/databases/${id}/query`, {
      method: "POST",
      body: JSON.stringify({ page_size: 100, start_cursor }),
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
    throw new Error(`Notion API request failed (${response.status} ${response.statusText}).`);
  }

  return response.json();
}

function loadDotEnv() {
  if (!existsSync(".env")) return;

  for (const line of readFileSync(".env", "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

function normalizeNotionId(value) {
  if (!value) return undefined;
  const trimmed = value.trim();
  const uuid = trimmed.match(/[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}/);
  return uuid?.[0].replace(/-/g, "") ?? trimmed.replace(/^collection:\/\//, "");
}

function getArgumentValue(name) {
  const exact = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return exact?.slice(name.length + 1);
}

function getTodayJst() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function getTitle(property) {
  return property?.title?.map((item) => item.plain_text ?? "").join("").trim() ?? "";
}

function getDate(property) {
  return property?.date?.start?.slice(0, 10) ?? "";
}

function getSelectName(property) {
  return property?.select?.name?.trim() ?? "";
}

function richTextProperty(value) {
  return {
    rich_text: [
      {
        type: "text",
        text: { content: value },
      },
    ],
  };
}
