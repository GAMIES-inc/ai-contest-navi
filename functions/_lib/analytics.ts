export type AnalyticsEnv = {
  ANALYTICS_DB?: D1DatabaseLike;
  ANALYTICS_ADMIN_TOKEN?: string;
  NOTION_TOKEN?: string;
  NOTION_DATABASE_ID?: string;
};

export type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatementLike;
};

export type D1PreparedStatementLike = {
  bind: (...values: unknown[]) => D1PreparedStatementLike;
  run: () => Promise<unknown>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
};

export type PageType = "home" | "contest" | "guide" | "submit" | "policy" | "other";

export type PageClassification = {
  pageType: PageType;
  pageId?: string;
};

export type UtmParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

export type ClickTrust = "trusted" | "review" | "suspicious";
export type ClickSourceKind = "onsite" | "external" | "direct" | "unknown";

export type ClickTrustInput = {
  sourcePath?: string;
  referrerHost?: string;
  utm?: UtmParams;
  isBot?: number;
};

export type ClickTrustResult = {
  trust: ClickTrust;
  sourceKind: ClickSourceKind;
  reasons: string[];
};

const BOT_PATTERN = /bot|crawler|spider|preview|facebookexternalhit|slackbot|discordbot|twitterbot/i;
const SAME_SITE_HOST_PATTERN = /(^|\.)ai-contest-navi\.pages\.dev$|^localhost$|^127\.0\.0\.1$|^\[::1\]$/i;
const TRUSTED_SOURCE_PATH_PATTERN =
  /^\/($|contests(?:\/|$)|calendar(?:\/|$)|categories(?:\/|$)|guides(?:\/|$)|archive(?:\/|$)|submit(?:\/|$))/;

export function classifyPage(path: string): PageClassification {
  const normalized = normalizePath(path);
  const parts = normalized.split("/").filter(Boolean);

  if (normalized === "/") return { pageType: "home" };
  if (parts[0] === "contests" && parts[1]) return { pageType: "contest", pageId: parts[1] };
  if (parts[0] === "guides" && parts[1]) return { pageType: "guide", pageId: parts[1] };
  if (parts[0] === "submit") return { pageType: "submit" };
  if (parts[0] === "policy") return { pageType: "policy" };
  return { pageType: "other" };
}

export function normalizePath(value: unknown): string {
  const raw = typeof value === "string" ? value : "/";
  const withoutHash = raw.split("#")[0] || "/";
  const withoutQuery = withoutHash.split("?")[0] || "/";
  if (!withoutQuery.startsWith("/")) return "/";
  return clamp(withoutQuery, 500) || "/";
}

export function clamp(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function getCountry(request: Request): string {
  return clamp((request as Request & { cf?: { country?: string } }).cf?.country, 2);
}

export function isBot(request: Request): number {
  return BOT_PATTERN.test(request.headers.get("user-agent") || "") ? 1 : 0;
}

export function getReferrerUrl(request: Request): URL | null {
  const referrer = request.headers.get("referer") || request.headers.get("referrer") || "";
  try {
    return referrer ? new URL(referrer) : null;
  } catch {
    return null;
  }
}

export function getReferrerHost(request: Request): string {
  return clamp(getReferrerUrl(request)?.hostname || "", 120);
}

export function getDomain(value: string): string {
  try {
    return clamp(new URL(value).hostname, 120);
  } catch {
    return "";
  }
}

export function getUtmFromUrl(url: URL | null): UtmParams {
  if (!url) return {};
  return {
    utm_source: clamp(url.searchParams.get("utm_source") || "", 120),
    utm_medium: clamp(url.searchParams.get("utm_medium") || "", 120),
    utm_campaign: clamp(url.searchParams.get("utm_campaign") || "", 160),
    utm_content: clamp(url.searchParams.get("utm_content") || "", 160),
    utm_term: clamp(url.searchParams.get("utm_term") || "", 160),
  };
}

export function getUtmFromRecord(record: Record<string, unknown>): UtmParams {
  return {
    utm_source: clamp(record.utm_source, 120),
    utm_medium: clamp(record.utm_medium, 120),
    utm_campaign: clamp(record.utm_campaign, 160),
    utm_content: clamp(record.utm_content, 160),
    utm_term: clamp(record.utm_term, 160),
  };
}

export function classifyOutboundClickTrust(input: ClickTrustInput): ClickTrustResult {
  const sourcePath = input.sourcePath ? normalizePath(input.sourcePath) : "";
  const referrerHost = clamp(input.referrerHost, 120).toLowerCase();
  const hasSourcePath = Boolean(sourcePath);
  const hasReferrerHost = Boolean(referrerHost);
  const sameSiteReferrer = hasReferrerHost && SAME_SITE_HOST_PATTERN.test(referrerHost);
  const trustedSourcePath = hasSourcePath && TRUSTED_SOURCE_PATH_PATTERN.test(sourcePath);
  const hasUtm = hasAnyUtm(input.utm);

  if (input.isBot) {
    return { trust: "suspicious", sourceKind: "unknown", reasons: ["bot_user_agent"] };
  }

  if (trustedSourcePath && (!hasReferrerHost || sameSiteReferrer)) {
    return {
      trust: "trusted",
      sourceKind: "onsite",
      reasons: hasUtm ? ["onsite_source_path", "utm_present"] : ["onsite_source_path"],
    };
  }

  if (trustedSourcePath && hasReferrerHost) {
    return { trust: "review", sourceKind: "external", reasons: ["onsite_path_external_referrer"] };
  }

  if (sameSiteReferrer) {
    return { trust: "review", sourceKind: "onsite", reasons: ["same_site_referrer_without_path"] };
  }

  if (!hasSourcePath && !hasReferrerHost) {
    return hasUtm
      ? { trust: "review", sourceKind: "direct", reasons: ["utm_without_page_context"] }
      : { trust: "suspicious", sourceKind: "direct", reasons: ["direct_go_request"] };
  }

  if (hasUtm) {
    return { trust: "review", sourceKind: hasReferrerHost ? "external" : "unknown", reasons: ["utm_without_onsite_context"] };
  }

  if (hasReferrerHost) {
    return { trust: "review", sourceKind: "external", reasons: ["external_or_unknown_referrer"] };
  }

  return { trust: "suspicious", sourceKind: "unknown", reasons: ["unknown_source"] };
}

function hasAnyUtm(utm: UtmParams | undefined): boolean {
  return Boolean(utm?.utm_source || utm?.utm_medium || utm?.utm_campaign || utm?.utm_content || utm?.utm_term);
}

export function shouldSkipTracking(request: Request, extraUrl?: URL | null): boolean {
  const requestUrl = new URL(request.url);
  if (requestUrl.searchParams.get("no_track") === "1") return true;
  if (extraUrl?.searchParams.get("no_track") === "1") return true;
  return false;
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (!text) return {};
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function noContent(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(init.headers || {}),
    },
  });
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function toDateInput(value: string | null, fallback: Date): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback.toISOString().slice(0, 10);
  return value;
}
