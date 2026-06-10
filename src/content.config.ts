import { defineCollection, z } from "astro:content";

const guideCategories = ["はじめ方", "AI動画", "AI漫画", "AI画像", "応募前チェック", "選び方", "コラム"] as const;
const contestCategories = ["ai-image", "ai-video", "ai-manga", "ai-music", "ai-illustration", "design", "other"] as const;

const guides = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(guideCategories),
    readTime: z.string(),
    difficulty: z.enum(["初心者向け", "初心者〜中級者向け", "全員向け"]),
    icon: z.string().default("start"),
    coverImage: z.string().optional(),
    coverAlt: z.string().optional(),
    relatedCategories: z.array(z.enum(guideCategories)).default([]),
    relatedContestCategories: z.array(z.enum(contestCategories)).default([]),
    publishedAt: z.string(),
    updatedAt: z.string(),
    featured: z.boolean().default(false),
    seoTitle: z.string(),
    seoDescription: z.string(),
    learnings: z.array(z.string()).default([]),
    checklist: z.array(z.string()).default([]),
  }),
});

export const collections = { guides };
