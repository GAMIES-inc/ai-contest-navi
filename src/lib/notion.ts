import { contests as fallbackContests, type Contest, type ContestCategory, type ContestStatus } from "@/data/contests";

const NOTION_VERSION = "2022-06-28";
const FALLBACK_THUMBNAIL = "/images/contest-fallback.png";

type NotionRichText = {
  plain_text?: string;
};

type NotionSelect = {
  name?: string;
};

type NotionFile = {
  type: "external" | "file";
  external?: { url?: string };
  file?: { url?: string };
};

type NotionCover = NotionFile | null;

type NotionProperty = {
  type?: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  select?: NotionSelect | null;
  multi_select?: NotionSelect[];
  date?: { start?: string | null } | null;
  url?: string | null;
  checkbox?: boolean;
  files?: NotionFile[];
};

type NotionPage = {
  id: string;
  cover?: NotionCover;
  properties: Record<string, NotionProperty | undefined>;
};

type NotionQueryResponse = {
  results?: NotionPage[];
  has_more?: boolean;
  next_cursor?: string | null;
};

let cachedContests: Promise<Contest[]> | null = null;

export async function getContestsFromNotionOrFallback(): Promise<Contest[]> {
  if (!cachedContests) {
    cachedContests = loadContests().catch((error: unknown) => {
      console.warn("[notion] Failed to load contests. Falling back to local data.", error);
      return normalizeAndSort(fallbackContests);
    });
  }

  return cachedContests;
}

async function loadContests(): Promise<Contest[]> {
  const token = readEnv("NOTION_TOKEN");
  const databaseId = normalizeNotionId(readEnv("NOTION_DATABASE_ID"));

  if (!token || !databaseId) {
    console.warn("[notion] NOTION_TOKEN or NOTION_DATABASE_ID is missing. Using local fallback data.");
    return normalizeAndSort(fallbackContests);
  }

  const pages = await queryDatabase(token, databaseId);
  const normalized = pages.map(normalizeNotionPage).filter((contest): contest is Contest => Boolean(contest));

  if (normalized.length === 0) {
    console.warn("[notion] No valid contest pages found. Using local fallback data.");
    return normalizeAndSort(fallbackContests);
  }

  return normalizeAndSort(normalized);
}

async function queryDatabase(token: string, databaseId: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({
        start_cursor: cursor,
        sorts: [
          {
            property: "締切日",
            direction: "ascending",
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Notion API ${response.status}: ${body}`);
    }

    const data = (await response.json()) as NotionQueryResponse;
    pages.push(...(data.results ?? []));
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);

  return pages;
}

function normalizeNotionPage(page: NotionPage): Contest | null {
  const props = page.properties;
  const title = getTitle(props["コンテスト名"]) || getTitle(props.Name);
  const explicitSlug = normalizeSlug(getPlainText(props.slug) || getPlainText(props["スラッグ"]));

  if (!title) {
    return null;
  }

  if (!isPublishable(props)) {
    return null;
  }

  if (!explicitSlug) {
    console.warn(`[notion] Missing slug for "${title}". Using generated fallback slug.`);
  }

  const spotlight = getCheckbox(props["注目表示"]);

  return {
    title,
    slug: explicitSlug || createSlug(title, page.id),
    description: getPlainText(props["紹介文"]) || getPlainText(props["概要"]) || getPlainText(props["共有用一言"]) || "",
    catchcopy: getPlainText(props["一言キャッチコピー"]) || getPlainText(props["詳細ページ一言"]),
    deadline: getDate(props["締切日"]) || "2099-12-31",
    status: mapStatus(getSelectName(props["ステータス"]) || getSelectName(props["開催ステータス"]) || getSelectName(props["公開ステータス"])),
    categories: mapCategories(getMultiSelectNames(props["ジャンル"]).concat(getMultiSelectNames(props["対象作品形式"]))),
    prize: getPlainText(props["賞金・賞品"]) || "公式ページを参照",
    applicationMethod: getSelectName(props["応募形式"]) || getPlainText(props["応募方法"]) || "公式ページの応募方法を参照",
    difficulty: mapDifficulty(getSelectName(props["参加しやすさ"]) || getPlainText(props["参加しやすさ"])),
    aiUsage: getSelectName(props["AI使用条件"]) || getPlainText(props["AI使用条件"]) || "公式募集要項に準拠",
    rightsNote:
      getSelectName(props["権利注意度"]) ||
      getPlainText(props["著作権・二次利用条件"]) ||
      formatRulesCaution(getSelectName(props["規約注意度"])) ||
      "公式募集要項に準拠",
    officialUrl: getUrl(props["公式URL"]) || "#",
    thumbnail: getThumbnail(props["サムネイル"], page.cover),
    entryFlow: parseList(getPlainText(props["応募の流れ"])),
    recommendedFor: uniqueStrings(getMultiSelectNames(props["向いている人"]).concat(parseList(getPlainText(props["向いている人メモ"])))),
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
  };
}

function isPublishable(props: Record<string, NotionProperty | undefined>): boolean {
  const explicitPublicStatus = getSelectName(props["公開ステータス"]);
  if (explicitPublicStatus && explicitPublicStatus !== "公開OK") return false;

  const listed = props["掲載中"];
  if (listed && listed.checkbox === false) return false;

  if (getCheckbox(props["要手動確認"])) return false;

  const status = getSelectName(props["ステータス"]) || getSelectName(props["開催ステータス"]);
  if (status === "要確認") return false;

  return true;
}

function normalizeAndSort(items: Contest[]): Contest[] {
  return [...items].sort((a, b) => a.deadline.localeCompare(b.deadline));
}

function readEnv(key: string): string | undefined {
  return import.meta.env[key] || process.env[key];
}

function normalizeNotionId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const uuid = trimmed.match(/[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}/);
  return uuid?.[0].replace(/-/g, "") ?? trimmed.replace(/^collection:\/\//, "");
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function getTitle(property: NotionProperty | undefined): string {
  return property?.title?.map((item) => item.plain_text ?? "").join("").trim() ?? "";
}

function getPlainText(property: NotionProperty | undefined): string {
  if (!property) return "";
  if (property.type === "title") return getTitle(property);
  if (property.rich_text) return property.rich_text.map((item) => item.plain_text ?? "").join("").trim();
  if (property.select?.name) return property.select.name;
  if (property.url) return property.url;
  return "";
}

function getSelectName(property: NotionProperty | undefined): string {
  return property?.select?.name?.trim() ?? "";
}

function getMultiSelectNames(property: NotionProperty | undefined): string[] {
  return property?.multi_select?.map((item) => item.name).filter((name): name is string => Boolean(name)) ?? [];
}

function getDate(property: NotionProperty | undefined): string {
  return property?.date?.start?.slice(0, 10) ?? "";
}

function getUrl(property: NotionProperty | undefined): string {
  return property?.url ?? "";
}

function getCheckbox(property: NotionProperty | undefined): boolean {
  return property?.checkbox ?? false;
}

function parseList(value: string): string[] {
  if (!value) return [];
  return uniqueStrings(
    value
      .split(/\r?\n|、|,/u)
      .map((item) => item.replace(/^[\s\-・*]+/u, "").trim())
      .filter(Boolean),
  );
}

function uniqueStrings(values: string[]): string[] {
  return values.filter((item, index, array) => item && array.indexOf(item) === index);
}

function getThumbnail(property: NotionProperty | undefined, cover?: NotionCover): string {
  const fileUrl = property?.files?.map(readFileUrl).find(Boolean);
  const url = getUrl(property) || getPlainText(property) || fileUrl || readFileUrl(cover ?? undefined);
  return preferHttps(url) || FALLBACK_THUMBNAIL;
}

function readFileUrl(file: NotionFile | undefined): string {
  if (!file) return "";
  return file.type === "external" ? file.external?.url ?? "" : file.file?.url ?? "";
}

function preferHttps(url: string): string {
  return url.startsWith("http://") ? `https://${url.slice("http://".length)}` : url;
}

function mapStatus(value: string): ContestStatus {
  if (value === "締切間近") return "closing-soon";
  if (value === "募集中" || value === "公開OK") return "open";
  if (value === "開催予定") return "upcoming";
  if (value === "終了") return "ended";
  return "needs-check";
}

function mapDifficulty(value: string): string {
  if (value === "高") return "初心者向け";
  if (value === "中") return "標準";
  if (value === "低") return "作品力必要";
  return value || "標準";
}

function formatRulesCaution(value: string): string {
  if (value === "高") return "権利・提出条件の確認項目が多め";
  if (value === "中") return "一般的な応募規約の確認が必要";
  if (value === "低") return "基本的な応募規約の確認で進めやすい";
  return "";
}

function mapCategories(values: string[]): ContestCategory[] {
  const categories = new Set<ContestCategory>();

  for (const value of values) {
    if (["AI画像", "画像"].includes(value)) categories.add("ai-image");
    if (["AI動画", "動画", "映像", "ショート動画", "映画", "国際映画祭"].includes(value)) categories.add("ai-video");
    if (["AI漫画", "漫画"].includes(value)) categories.add("ai-manga");
    if (["AI音楽", "音楽", "音楽/音声"].includes(value)) categories.add("ai-music");
    if (["AIイラスト", "イラスト", "塗り絵", "線画"].includes(value)) categories.add("ai-illustration");
    if (["写真", "フォト", "フォトコンテスト"].includes(value)) categories.add("photo");
    if (["デザイン"].includes(value)) categories.add("design");
    if (["文章", "小説", "エッセイ", "作文", "企画", "アイデア"].includes(value)) categories.add("writing");
  }

  if (categories.size === 0) categories.add("other");
  return [...categories];
}

function mapImageStatus(value: string): Contest["imageStatus"] | undefined {
  if (value === "公式画像") return "official";
  if (value === "提供素材") return "provided";
  if (value === "公開情報") return "public-info";
  if (value === "プレースホルダー") return "placeholder";
  if (value === "確認中") return "checking";
  return undefined;
}

function mapPlaceholderType(value: string): Contest["placeholderType"] | undefined {
  if (value === "AI画像") return "ai-image";
  if (value === "AI動画") return "ai-video";
  if (value === "AI漫画") return "ai-manga";
  if (value === "AI音楽") return "ai-music";
  if (value === "写真") return "photo";
  if (value === "デザイン") return "design";
  if (value === "企画・アイデア") return "idea";
  if (value === "その他") return "other";
  return undefined;
}

function createSlug(title: string, pageId: string): string {
  const ascii = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  if (ascii.length >= 8) return ascii;
  return `contest-${hash(`${title}-${pageId}`)}`;
}

function hash(value: string): string {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result.toString(36);
}
