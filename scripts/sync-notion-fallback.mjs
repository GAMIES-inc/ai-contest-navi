import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const NOTION_VERSION = "2022-06-28";
const OUTPUT_PATH = path.resolve("src/data/contests.snapshot.json");
const FALLBACK_THUMBNAIL = "/images/contest-fallback.png";

loadDotEnv();

const token = process.env.NOTION_TOKEN;
const databaseId = normalizeNotionId(process.env.NOTION_DATABASE_ID);
if (!token || !databaseId) throw new Error("NOTION_TOKEN and NOTION_DATABASE_ID are required.");

const pages = await queryDatabase(token, databaseId);
const contests = pages.map(normalizePage).filter(Boolean).sort((a, b) => a.deadline.localeCompare(b.deadline));

writeFileSync(OUTPUT_PATH, `${JSON.stringify(contests, null, 2)}\n`, "utf8");
console.log(`Notion fallback snapshot updated: ${contests.length} contest(s).`);

async function queryDatabase(apiToken, id) {
  const pages = [];
  let cursor;
  do {
    const response = await fetch(`https://api.notion.com/v1/databases/${id}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({
        page_size: 100,
        start_cursor: cursor,
        sorts: [{ property: "締切日", direction: "ascending" }],
      }),
    });
    if (!response.ok) throw new Error(`Notion API request failed (${response.status} ${response.statusText}).`);
    const data = await response.json();
    pages.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return pages;
}

function normalizePage(page) {
  const props = page.properties ?? {};
  const title = getTitle(props["コンテスト名"]) || getTitle(props.Name);
  if (!title || !isPublishable(props)) return null;

  const spotlight = getCheckbox(props["注目表示"]);
  const explicitSlug = normalizeSlug(getPlainText(props.slug) || getPlainText(props["スラッグ"]));
  return compact({
    title,
    slug: explicitSlug || createSlug(title, page.id),
    description: getPlainText(props["紹介文"]) || getPlainText(props["概要"]) || getPlainText(props["共有用一言"]) || "",
    catchcopy: getPlainText(props["一言キャッチコピー"]) || getPlainText(props["詳細ページ一言"]),
    deadline: getDate(props["締切日"]) || "2099-12-31",
    lastVerifiedAt: getDate(props["最終確認日"]) || getDate(props["情報確認日"]),
    status: mapStatus(getSelectName(props["ステータス"]) || getSelectName(props["開催ステータス"]) || getSelectName(props["公開ステータス"])),
    categories: mapCategories(getMultiSelectNames(props["ジャンル"]).concat(getMultiSelectNames(props["対象作品形式"]))),
    prize: getPlainText(props["賞金・賞品"]) || "公式ページを参照",
    applicationMethod: getSelectName(props["応募形式"]) || getPlainText(props["応募方法"]) || "公式ページの応募方法を参照",
    difficulty: mapDifficulty(getSelectName(props["参加しやすさ"]) || getPlainText(props["参加しやすさ"])),
    aiUsage: getSelectName(props["AI使用条件"]) || getPlainText(props["AI使用条件"]) || "公式募集要項に準拠",
    rightsNote: getSelectName(props["権利注意度"]) || getPlainText(props["著作権・二次利用条件"]) || formatRulesCaution(getSelectName(props["規約注意度"])) || "公式募集要項に準拠",
    officialUrl: getUrl(props["公式URL"]) || "#",
    thumbnail: getThumbnail(props["サムネイル"], page.cover),
    entryFlow: parseList(getPlainText(props["応募の流れ"])),
    recommendedFor: unique(getMultiSelectNames(props["向いている人"]).concat(parseList(getPlainText(props["向いている人メモ"])))),
    image: getThumbnail(props["画像"], page.cover),
    imageAlt: getPlainText(props["画像Alt"]) || `${title}のキービジュアル`,
    imageSourceLabel: getPlainText(props["画像出典"]) || getPlainText(props["画像出典ラベル"]),
    imageSourceUrl: getUrl(props["画像出典URL"]) || getUrl(props["公式URL"]),
    imageRightsOwner: getPlainText(props["画像権利者"]) || getPlainText(props["主催者"]),
    imageStatus: mapImageStatus(getSelectName(props["画像ステータス"])),
    imageRemovalNote: getPlainText(props["画像補足"]),
    placeholderType: mapPlaceholderType(getSelectName(props["プレースホルダー種別"])),
    thumbnailQuality: getSelectName(props["サムネイル品質"]) || getPlainText(props["サムネイル品質"]),
    thumbnailNote: getPlainText(props["サムネイル改善メモ"]),
    spotlight,
    featured: spotlight || getSelectName(props["掲載優先度"]) === "高" || getSelectName(props["PR区分"]) === "PR強化対象",
  });
}

function isPublishable(props) {
  const publicStatus = getSelectName(props["公開ステータス"]);
  if (publicStatus && publicStatus !== "公開OK") return false;
  if (props["掲載中"]?.checkbox === false) return false;
  if (getCheckbox(props["要手動確認"])) return false;
  const status = getSelectName(props["ステータス"]) || getSelectName(props["開催ステータス"]);
  return status !== "要確認";
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}

function normalizeSlug(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
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

function getDate(property) {
  return property?.date?.start?.slice(0, 10) ?? "";
}

function getUrl(property) {
  return property?.url ?? "";
}

function getCheckbox(property) {
  return property?.checkbox ?? false;
}

function parseList(value) {
  if (!value) return [];
  return unique(value.split(/\r?\n|、|,/u).map((item) => item.replace(/^[\s\-・*]+/u, "").trim()).filter(Boolean));
}

function unique(values) {
  return values.filter((item, index, array) => item && array.indexOf(item) === index);
}

function getThumbnail(property, cover) {
  const fileUrl = property?.files?.map(readFileUrl).find(Boolean);
  const url = getUrl(property) || getPlainText(property) || fileUrl || readFileUrl(cover);
  return url.startsWith("http://") ? `https://${url.slice(7)}` : url || FALLBACK_THUMBNAIL;
}

function readFileUrl(file) {
  if (!file) return "";
  return file.type === "external" ? file.external?.url ?? "" : file.file?.url ?? "";
}

function mapStatus(value) {
  if (value === "締切間近") return "closing-soon";
  if (value === "募集中" || value === "公開OK") return "open";
  if (value === "開催予定") return "upcoming";
  if (value === "終了") return "ended";
  return "needs-check";
}

function mapDifficulty(value) {
  if (value === "高") return "初心者向け";
  if (value === "中") return "標準";
  if (value === "低") return "作品力必要";
  return value || "標準";
}

function formatRulesCaution(value) {
  if (value === "高") return "権利・提出条件の確認項目が多め";
  if (value === "中") return "一般的な応募規約の確認が必要";
  if (value === "低") return "基本的な応募規約の確認で進めやすい";
  return "";
}

function mapCategories(values) {
  const categories = new Set();
  for (const value of values) {
    if (["AI画像", "画像"].includes(value)) categories.add("ai-image");
    if (["AI動画", "動画", "映像", "ショート動画", "映画", "国際映画祭"].includes(value)) categories.add("ai-video");
    if (["AI漫画", "漫画"].includes(value)) categories.add("ai-manga");
    if (["AI音楽", "音楽", "音楽/音声"].includes(value)) categories.add("ai-music");
    if (["AIイラスト", "イラスト", "塗り絵", "線画"].includes(value)) categories.add("ai-illustration");
    if (["写真", "フォト", "フォトコンテスト"].includes(value)) categories.add("photo");
    if (value === "デザイン") categories.add("design");
    if (["文章", "小説", "エッセイ", "作文", "企画", "アイデア"].includes(value)) categories.add("writing");
  }
  if (categories.size === 0) categories.add("other");
  return [...categories];
}

function mapImageStatus(value) {
  return { "公式画像": "official", "提供素材": "provided", "公開情報": "public-info", "プレースホルダー": "placeholder", "確認中": "checking" }[value];
}

function mapPlaceholderType(value) {
  return { "AI画像": "ai-image", "AI動画": "ai-video", "AI漫画": "ai-manga", "AI音楽": "ai-music", "写真": "photo", "デザイン": "design", "文章": "writing", "企画・アイデア": "idea", "その他": "other" }[value];
}

function createSlug(title, pageId) {
  const ascii = title.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  return ascii.length >= 8 ? ascii : `contest-${hash(`${title}-${pageId}`)}`;
}

function hash(value) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) >>> 0;
  return result.toString(36);
}

function loadDotEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function normalizeNotionId(value) {
  if (!value) return "";
  return value.trim().replaceAll("-", "").match(/[0-9a-fA-F]{32}/u)?.[0] ?? value.trim();
}
