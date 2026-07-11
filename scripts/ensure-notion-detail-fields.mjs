import fs from "node:fs";
import path from "node:path";

const NOTION_VERSION = "2022-06-28";

loadDotEnv();

const token = process.env.NOTION_TOKEN;
const databaseId = normalizeNotionId(process.env.NOTION_DATABASE_ID);

if (!token || !databaseId) {
  console.error("NOTION_TOKEN or NOTION_DATABASE_ID is missing.");
  process.exit(1);
}

const desiredProperties = {
  "最終確認日": { date: {} },
  "URL疎通確認日": { date: {} },
  "運用ステータス": {
    select: {
      options: [
        { name: "候補", color: "gray" },
        { name: "確認中", color: "yellow" },
        { name: "公開", color: "green" },
        { name: "終了", color: "default" },
        { name: "非公開", color: "red" },
        { name: "修正待ち", color: "orange" },
      ],
    },
  },
  "一言キャッチコピー": { rich_text: {} },
  "応募の流れ": { rich_text: {} },
  "向いている人": {
    multi_select: {
      options: [
        { name: "初心者向け", color: "blue" },
        { name: "中高生向け", color: "green" },
        { name: "学生向け", color: "green" },
        { name: "AI画像を出したい", color: "blue" },
        { name: "AI動画を出したい", color: "blue" },
        { name: "AI漫画を出したい", color: "purple" },
        { name: "AI音楽を出したい", color: "pink" },
        { name: "AIアイデアを形にしたい", color: "yellow" },
        { name: "X投稿で応募したい", color: "gray" },
        { name: "オンラインで応募したい", color: "gray" },
        { name: "作品力を試したい", color: "orange" },
        { name: "プレゼン経験を積みたい", color: "red" },
      ],
    },
  },
  "サムネイル品質": {
    select: {
      options: [
        { name: "公式画像OK", color: "green" },
        { name: "制作済み", color: "blue" },
        { name: "要改善", color: "yellow" },
        { name: "プレースホルダー", color: "gray" },
        { name: "権利確認中", color: "red" },
      ],
    },
  },
  "サムネイル改善メモ": { rich_text: {} },
};

const database = await notionFetch(`/databases/${databaseId}`, { method: "GET" });
const currentProperties = database.properties ?? {};
const missingEntries = Object.entries(desiredProperties).filter(([name]) => !currentProperties[name]);

if (missingEntries.length === 0) {
  console.log("Notion detail fields are already present.");
  process.exit(0);
}

const properties = Object.fromEntries(missingEntries);
await notionFetch(`/databases/${databaseId}`, {
  method: "PATCH",
  body: JSON.stringify({ properties }),
});

console.log(`Added Notion detail fields: ${missingEntries.map(([name]) => name).join(", ")}`);

async function notionFetch(endpoint, init) {
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
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
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function normalizeNotionId(value) {
  if (!value) return "";
  const trimmed = value.trim();
  const uuid = trimmed.match(/[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}/u);
  return uuid?.[0].replace(/-/g, "") ?? trimmed.replace(/^collection:\/\//u, "");
}
