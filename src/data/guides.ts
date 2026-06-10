import { getCollection, type CollectionEntry } from "astro:content";
import type { ContestCategory } from "@/data/contests";

export type GuideCategory =
  | "はじめ方"
  | "AI動画"
  | "AI漫画"
  | "AI画像"
  | "応募前チェック"
  | "選び方"
  | "コラム";

export type GuideDifficulty = "初心者向け" | "初心者〜中級者向け" | "全員向け";
export type GuideEntry = CollectionEntry<"guides">;
export type Guide = Omit<GuideEntry["data"], "slug"> & {
  id: string;
  slug: string;
  body: string;
};

export const guideCategories: Array<"すべて" | GuideCategory> = [
  "すべて",
  "はじめ方",
  "AI動画",
  "AI漫画",
  "AI画像",
  "応募前チェック",
  "選び方",
  "コラム",
];

const guideOrder = [
  "start-ai-contest",
  "how-to-read-contest-guidelines",
  "ai-contest-work-final-check",
];

export async function getAllGuides(): Promise<Guide[]> {
  const entries = await getCollection("guides");
  return entries.map(normalizeGuide).sort((a, b) => getGuideOrder(a.slug) - getGuideOrder(b.slug));
}

export async function getGuideEntries(): Promise<GuideEntry[]> {
  return getCollection("guides");
}

export async function getFeaturedGuides(limit = 3): Promise<Guide[]> {
  return (await getAllGuides()).filter((guide) => guide.featured).slice(0, limit);
}

export async function getGuideBySlug(slug: string): Promise<Guide | undefined> {
  return (await getAllGuides()).find((guide) => guide.slug === slug);
}

export async function getGuideEntryBySlug(slug: string): Promise<GuideEntry | undefined> {
  return (await getGuideEntries()).find((entry) => entry.id.replace(/\.(md|mdx)$/, "") === slug);
}

export async function getGuidesByCategory(category: GuideCategory): Promise<Guide[]> {
  return (await getAllGuides()).filter((guide) => guide.category === category);
}

export async function getRelatedGuides(guide: Guide, limit = 3): Promise<Guide[]> {
  return (await getAllGuides())
    .filter((item) => item.slug !== guide.slug)
    .filter((item) => guide.relatedCategories.includes(item.category) || item.relatedCategories.includes(guide.category))
    .slice(0, limit);
}

export async function getGuidesForContestCategories(categories: ContestCategory[], limit = 3): Promise<Guide[]> {
  const guides = await getAllGuides();
  const scored = guides
    .map((guide) => ({
      guide,
      score: guide.relatedContestCategories.filter((category) => categories.includes(category)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const unique = new Map<string, Guide>();
  for (const item of scored) unique.set(item.guide.slug, item.guide);

  for (const guide of guides) {
    if (unique.size >= limit) break;
    unique.set(guide.slug, guide);
  }

  return Array.from(unique.values()).slice(0, limit);
}

export function normalizeGuide(entry: GuideEntry): Guide {
  return {
    id: entry.id,
    slug: entry.id.replace(/\.(md|mdx)$/, ""),
    body: entry.body ?? "",
    ...entry.data,
  };
}

function getGuideOrder(slug: string): number {
  const index = guideOrder.indexOf(slug);
  return index === -1 ? 999 : index;
}

export function formatGuideDate(date: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00+09:00`));
}
