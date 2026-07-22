import contestSnapshot from "./contests.snapshot.json";

export type ContestStatus = "open" | "closing-soon" | "upcoming" | "ended" | "needs-check";

export type ContestCategory =
  | "ai-image"
  | "ai-video"
  | "ai-manga"
  | "ai-music"
  | "ai-illustration"
  | "photo"
  | "design"
  | "writing"
  | "other";

export type ContestImageStatus = "official" | "provided" | "public-info" | "placeholder" | "checking";

export type ContestPlaceholderType =
  | "ai-image"
  | "ai-video"
  | "ai-manga"
  | "ai-music"
  | "photo"
  | "design"
  | "writing"
  | "idea"
  | "other";

export type Contest = {
  title: string;
  slug: string;
  description: string;
  catchcopy?: string;
  deadline: string;
  lastVerifiedAt?: string;
  status: ContestStatus;
  categories: ContestCategory[];
  prize: string;
  applicationMethod: string;
  difficulty: string;
  aiUsage: string;
  rightsNote: string;
  officialUrl: string;
  thumbnail: string;
  entryFlow?: string[];
  recommendedFor?: string[];
  image?: string;
  imageAlt?: string;
  imageSourceLabel?: string;
  imageSourceUrl?: string;
  imageRightsOwner?: string;
  imageStatus?: ContestImageStatus;
  imageRemovalNote?: string;
  placeholderType?: ContestPlaceholderType;
  thumbnailQuality?: string;
  thumbnailNote?: string;
  spotlight?: boolean;
  featured: boolean;
};

export const contests = contestSnapshot as Contest[];
