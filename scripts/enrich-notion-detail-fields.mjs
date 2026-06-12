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

const pages = await queryDatabase();
let updatedCount = 0;

for (const page of pages) {
  const props = page.properties ?? {};
  const title = getTitle(props["コンテスト名"]) || getTitle(props.Name);
  if (!title) continue;

  const updates = {};
  const categories = getMultiSelectNames(props["ジャンル"]).concat(getMultiSelectNames(props["対象作品形式"]));
  const description = getPlainText(props["紹介文"]) || getPlainText(props["概要"]);
  const applicationMethod = getSelectName(props["応募形式"]) || getPlainText(props["応募方法"]);
  const difficulty = getSelectName(props["参加しやすさ"]) || getPlainText(props["参加しやすさ"]);
  const aiUsage = getSelectName(props["AI使用条件"]) || getPlainText(props["AI使用条件"]);
  const officialUrl = getUrl(props["公式URL"]);
  const context = `${title} ${description} ${applicationMethod} ${officialUrl}`;

  if (!getPlainText(props["一言キャッチコピー"])) {
    updates["一言キャッチコピー"] = richTextProperty(buildCatchcopy({ title, categories, description }));
  }

  if (!getPlainText(props["応募の流れ"])) {
    updates["応募の流れ"] = richTextProperty(buildEntryFlow({ categories, applicationMethod, context }).join("\n"));
  }

  if (getMultiSelectNames(props["向いている人"]).length === 0) {
    updates["向いている人"] = {
      multi_select: buildRecommendedFor({ title, categories, difficulty, aiUsage, context }).map((name) => ({ name })),
    };
  }

  if (!getSelectName(props["サムネイル品質"])) {
    updates["サムネイル品質"] = { select: { name: inferThumbnailQuality(props) } };
  }

  if (Object.keys(updates).length === 0) continue;

  await notionFetch(`/pages/${page.id}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: updates }),
  });

  updatedCount += 1;
  console.log(`Updated: ${title}`);
}

console.log(`Done. Updated ${updatedCount} page(s). Existing values were not overwritten.`);

async function queryDatabase() {
  const pages = [];
  let cursor;

  do {
    const data = await notionFetch(`/databases/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify({ start_cursor: cursor }),
    });
    pages.push(...(data.results ?? []));
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);

  return pages;
}

function buildCatchcopy({ title, categories, description }) {
  if (/美女|オーディション/u.test(title)) return "次世代のAI美女で挑戦できるコンテスト。";
  if (/U-?18|18歳|学生|中高生/u.test(`${title} ${description}`)) return "AIで、未来のアイデアをカタチに。";
  if (hasCategory(categories, ["AI動画", "動画", "映像", "映画"])) return "AI動画作品を応募できるコンテスト。";
  if (hasCategory(categories, ["AI漫画", "漫画"])) return "AI漫画作品を応募できるコンテスト。";
  if (hasCategory(categories, ["AI画像", "画像", "AIイラスト", "イラスト"])) return "AI画像作品を応募できるコンテスト。";
  if (hasCategory(categories, ["AI音楽", "音楽"])) return "AI音楽作品を応募できるコンテスト。";
  if (description) return `${description.slice(0, 30)}。`.replace("。。", "。");
  return "AI作品を応募できるコンテスト。";
}

function buildEntryFlow({ categories, applicationMethod, context }) {
  const work = hasCategory(categories, ["AI動画", "動画", "映像", "映画"])
    ? "動画作品"
    : hasCategory(categories, ["AI漫画", "漫画"])
      ? "漫画作品"
      : hasCategory(categories, ["AI画像", "画像", "AIイラスト", "イラスト"])
        ? "画像作品"
        : "作品やアイデア";

  if (/x\.com|twitter\.com|X|SNS|#|ハッシュタグ|引用|リポスト|投稿/iu.test(context)) {
    return [
      `${work}を用意: テーマに合わせて応募作品を整える`,
      "公式条件を確認: フォロー・ハッシュタグ・投稿形式を見る",
      "Xで応募する: 指定条件に沿って投稿する",
    ];
  }

  if (/YouTube/iu.test(context)) {
    return [
      `${work}を用意: 提出条件に合わせて作品を仕上げる`,
      "YouTubeへ投稿: 限定公開など指定形式でURLを用意する",
      "公式フォームで提出: 必要事項とURLを送信する",
    ];
  }

  if (/フォーム|form/iu.test(applicationMethod)) {
    return [
      `${work}を用意: テーマに合わせて応募内容を整える`,
      "公式フォームで応募: 締切・提出形式を確認して送信する",
      "結果や案内を待つ: 公式からの連絡や発表を確認する",
    ];
  }

  return [
    `${work}を用意: テーマに合わせて応募内容を整える`,
    "公式条件を確認して応募: 締切・提出形式を確認する",
    "結果や案内を待つ: 公式からの連絡や発表を確認する",
  ];
}

function buildRecommendedFor({ title, categories, difficulty, aiUsage, context }) {
  const values = [];

  if (/U-?18|18歳|中高生/u.test(`${title} ${context}`)) values.push("中高生向け");
  if (/学生/u.test(`${title} ${context}`)) values.push("学生向け");
  if (/初心者/u.test(difficulty)) values.push("初心者向け");
  if (hasCategory(categories, ["AI画像", "画像", "AIイラスト", "イラスト"])) values.push("AI画像を出したい");
  if (hasCategory(categories, ["AI動画", "動画", "映像", "映画"])) values.push("AI動画を出したい");
  if (hasCategory(categories, ["AI漫画", "漫画"])) values.push("AI漫画を出したい");
  if (hasCategory(categories, ["AI音楽", "音楽"])) values.push("AI音楽を出したい");
  if (/アイデア|企画|プレゼン/u.test(context)) values.push("AIアイデアを形にしたい");
  if (/X|SNS|#|ハッシュタグ|x\.com|twitter\.com/iu.test(context)) values.push("X投稿で応募したい");
  values.push("オンラインで応募したい");
  if (/必須/u.test(aiUsage)) values.push("AI活用作品を出したい");

  return unique(values).slice(0, 6);
}

function inferThumbnailQuality(props) {
  const thumbnail = getUrl(props["サムネイル"]) || getPlainText(props["サムネイル"]) || readFileUrl(props["サムネイル"]);
  const image = getUrl(props["画像"]) || getPlainText(props["画像"]) || readFileUrl(props["画像"]);
  const imageStatus = getSelectName(props["画像ステータス"]);
  const source = getPlainText(props["画像出典"]) || getPlainText(props["画像出典ラベル"]);
  const url = `${thumbnail} ${image}`;

  if (/制作済み|wide|public\/images|\/images\/contests\//iu.test(url)) return "制作済み";
  if (/公式|official|公式画像/iu.test(`${imageStatus} ${source}`)) return "公式画像OK";
  if (!thumbnail && !image) return "プレースホルダー";
  if (/brand-thumbnail|contest-fallback|placeholder/iu.test(url)) return "プレースホルダー";
  return "要改善";
}

function hasCategory(categories, candidates) {
  return categories.some((category) => candidates.some((candidate) => category.includes(candidate)));
}

function richTextProperty(value) {
  return {
    rich_text: [
      {
        text: {
          content: value.slice(0, 1900),
        },
      },
    ],
  };
}

function unique(values) {
  return values.filter((value, index, array) => value && array.indexOf(value) === index);
}

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

function getTitle(property) {
  return property?.title?.map((item) => item.plain_text ?? "").join("").trim() ?? "";
}

function getPlainText(property) {
  if (!property) return "";
  if (property.type === "title") return getTitle(property);
  if (property.rich_text) return property.rich_text.map((item) => item.plain_text ?? "").join("").trim();
  if (property.select?.name) return property.select.name;
  if (property.url) return property.url;
  return "";
}

function getSelectName(property) {
  return property?.select?.name?.trim() ?? "";
}

function getMultiSelectNames(property) {
  return property?.multi_select?.map((item) => item.name).filter(Boolean) ?? [];
}

function getUrl(property) {
  return property?.url ?? "";
}

function readFileUrl(property) {
  const file = property?.files?.[0];
  if (!file) return "";
  return file.type === "external" ? file.external?.url ?? "" : file.file?.url ?? "";
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
