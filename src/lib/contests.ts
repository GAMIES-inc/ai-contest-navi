import type { Contest, ContestCategory, ContestPlaceholderType } from "@/data/contests";
import { getContestsFromNotionOrFallback } from "@/lib/notion";

export const categoryLabels: Record<ContestCategory, string> = {
  "ai-image": "AI画像",
  "ai-video": "AI動画",
  "ai-manga": "AI漫画",
  "ai-music": "AI音楽",
  "ai-illustration": "AIイラスト",
  design: "デザイン",
  other: "その他",
};

export const publicCategories: ContestCategory[] = [
  "ai-image",
  "ai-video",
  "ai-manga",
  "ai-music",
  "other",
];

export async function getAllContests(): Promise<Contest[]> {
  return (await getContestsFromNotionOrFallback()).map((contest) => applyRuntimeStatus(contest));
}

export async function getFeaturedContests(limit = 6): Promise<Contest[]> {
  return (await getActiveContests())
    .filter((contest) => contest.featured)
    .slice(0, limit);
}

export async function getClosingSoonContests(limit = 6): Promise<Contest[]> {
  return (await getActiveContests())
    .filter((contest) => contest.status === "closing-soon")
    .slice(0, limit);
}

export async function getActiveContests(): Promise<Contest[]> {
  return (await getAllContests()).filter((contest) => contest.status === "open" || contest.status === "closing-soon");
}

export async function getEndedContests(): Promise<Contest[]> {
  return (await getAllContests()).filter((contest) => contest.status === "ended").reverse();
}

export async function getContestBySlug(slug: string): Promise<Contest | undefined> {
  return (await getAllContests()).find((contest) => contest.slug === slug);
}

export async function getContestsByCategory(category: ContestCategory): Promise<Contest[]> {
  return (await getActiveContests()).filter((contest) => contest.categories.includes(category));
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00+09:00`));
}

export function getDaysUntilDeadline(date: string, now = new Date()): number {
  const deadline = new Date(`${date}T23:59:59+09:00`);
  const diff = deadline.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getContestImage(contest: Contest): string {
  if (contest.imageStatus === "placeholder") return "/images/contest-fallback.png";
  const image = contest.image || contest.thumbnail;
  return !image || image === "/brand-thumbnail.svg" ? "/images/contest-fallback.png" : image;
}

export function isContestFallbackImage(src: string): boolean {
  return src === "/images/contest-fallback.png" || src === "/brand-thumbnail.svg";
}

export function getContestPlaceholderType(contest: Contest): ContestPlaceholderType {
  if (contest.placeholderType) return contest.placeholderType;
  if (contest.categories.includes("ai-video")) return "ai-video";
  if (contest.categories.includes("ai-manga")) return "ai-manga";
  if (contest.categories.includes("ai-music")) return "ai-music";
  if (contest.categories.includes("design")) return "design";
  if (contest.categories.includes("ai-image") || contest.categories.includes("ai-illustration")) return "ai-image";
  return "other";
}

function applyRuntimeStatus(contest: Contest, now = new Date()): Contest {
  const daysUntilDeadline = getDaysUntilDeadline(contest.deadline, now);

  if (daysUntilDeadline < 0) {
    return { ...contest, status: "ended" };
  }

  if (contest.status === "open" && daysUntilDeadline <= 14) {
    return { ...contest, status: "closing-soon" };
  }

  return contest;
}

export function getCanonicalPath(path = ""): string {
  const base = import.meta.env.SITE_URL || "https://ai-contest-navi.pages.dev";
  return new URL(path, base).toString();
}
