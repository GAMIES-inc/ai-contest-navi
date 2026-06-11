import { contests as fallbackContests } from "../../src/data/contests";

type Env = {
  NOTION_TOKEN?: string;
  NOTION_DATABASE_ID?: string;
};

type NotionRichText = {
  plain_text?: string;
};

type NotionSelect = {
  name?: string;
};

type NotionProperty = {
  type?: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  url?: string | null;
  select?: NotionSelect | null;
};

type NotionPage = {
  id: string;
  properties: Record<string, NotionProperty | undefined>;
};

type NotionQueryResponse = {
  results?: NotionPage[];
  has_more?: boolean;
  next_cursor?: string | null;
};

export type AnalyticsContest = {
  slug: string;
  title: string;
  officialUrl: string;
};

const NOTION_VERSION = "2022-06-28";

export async function findContestBySlug(env: Env, slug: string): Promise<AnalyticsContest | null> {
  const safeSlug = slug.trim().toLowerCase();
  if (!safeSlug) return null;

  const notionContest = await findNotionContest(env, safeSlug);
  if (notionContest) return notionContest;

  const fallback = fallbackContests.find((contest) => contest.slug === safeSlug);
  if (!fallback) return null;

  return {
    slug: fallback.slug,
    title: fallback.title,
    officialUrl: fallback.officialUrl,
  };
}

async function findNotionContest(env: Env, slug: string): Promise<AnalyticsContest | null> {
  const token = env.NOTION_TOKEN;
  const databaseId = normalizeNotionId(env.NOTION_DATABASE_ID);
  if (!token || !databaseId) return null;

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
        page_size: 100,
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as NotionQueryResponse;
    for (const page of data.results ?? []) {
      const contest = normalizePage(page);
      if (contest?.slug === slug) return contest;
    }

    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);

  return null;
}

function normalizePage(page: NotionPage): AnalyticsContest | null {
  const props = page.properties;
  const title = getTitle(props["コンテスト名"]) || getTitle(props.Name);
  if (!title) return null;

  const explicitSlug = normalizeSlug(getPlainText(props.slug) || getPlainText(props["スラッグ"]));
  const officialUrl = getUrl(props["公式URL"]);
  if (!officialUrl) return null;

  return {
    slug: explicitSlug || createSlug(title, page.id),
    title,
    officialUrl,
  };
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

function getUrl(property: NotionProperty | undefined): string {
  return property?.url ?? getPlainText(property);
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
