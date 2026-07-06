import type { Contest, ContestCategory, ContestPlaceholderType } from "@/data/contests";
import { getContestsFromNotionOrFallback } from "@/lib/notion";

export const categoryLabels: Record<ContestCategory, string> = {
  "ai-image": "AI画像",
  "ai-video": "動画",
  "ai-manga": "漫画",
  "ai-music": "音楽",
  "ai-illustration": "イラスト",
  photo: "写真",
  design: "デザイン",
  writing: "文章・アイデア",
  other: "その他",
};

export const publicCategories: ContestCategory[] = [
  "ai-image",
  "ai-video",
  "ai-illustration",
  "photo",
  "ai-manga",
  "ai-music",
  "design",
  "writing",
  "other",
];

const yuruPlaceholderImages: Record<ContestPlaceholderType, string> = {
  "ai-image": "/images/contests/yuru-thumb-ai-image.webp",
  "ai-video": "/images/contests/yuru-thumb-video.webp",
  "ai-manga": "/images/contests/yuru-thumb-illustration.webp",
  "ai-music": "/images/contests/yuru-thumb-video.webp",
  photo: "/images/contests/yuru-thumb-photo.webp",
  design: "/images/contests/yuru-thumb-illustration.webp",
  writing: "/images/contests/yuru-thumb-ai-image.webp",
  idea: "/images/contests/yuru-thumb-ai-image.webp",
  other: "/images/contests/yuru-thumb-photo.webp",
};

const unreliableImageUrls = [
  "https://www.dhw.ac.jp/p/articon/img/fb_main.png",
  "https://aaiff.ai/logo.png",
  "https://pbs.twimg.com/amplify_video_thumb/2063918534825324544/img/0uiMSoKluH1KXz4T.jpg",
];

export async function getAllContests(): Promise<Contest[]> {
  return (await getContestsFromNotionOrFallback()).map((contest) => applyRuntimeStatus(contest));
}

export async function getFeaturedContests(limit = 6): Promise<Contest[]> {
  return (await getActiveContests())
    .filter((contest) => contest.featured)
    .sort((a, b) => Number(Boolean(b.spotlight)) - Number(Boolean(a.spotlight)) || a.deadline.localeCompare(b.deadline))
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
  const placeholderImage = getContestFallbackImage(contest);
  if (contest.imageStatus === "placeholder") return placeholderImage;
  const image = contest.image || contest.thumbnail;
  return !image || image === "/brand-thumbnail.svg" || image === "/images/contest-fallback.png" || isUnreliableContestImage(image) ? placeholderImage : image;
}

export function getContestFallbackImage(contest: Contest): string {
  return yuruPlaceholderImages[getContestPlaceholderType(contest)];
}

export function isContestFallbackImage(src: string): boolean {
  return src === "/images/contest-fallback.png" || src === "/brand-thumbnail.svg" || src.startsWith("/images/contests/yuru-thumb-");
}

function isUnreliableContestImage(src: string): boolean {
  return unreliableImageUrls.includes(src);
}

export function getContestPlaceholderType(contest: Contest): ContestPlaceholderType {
  if (contest.placeholderType) return contest.placeholderType;
  if (contest.categories.includes("ai-video")) return "ai-video";
  if (contest.categories.includes("ai-manga")) return "ai-manga";
  if (contest.categories.includes("ai-music")) return "ai-music";
  if (contest.categories.includes("photo")) return "photo";
  if (contest.categories.includes("design")) return "design";
  if (contest.categories.includes("writing")) return "writing";
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
