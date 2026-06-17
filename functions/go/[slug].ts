import {
  classifyPage,
  clamp,
  getCountry,
  getDomain,
  getReferrerHost,
  getReferrerUrl,
  getUtmFromUrl,
  isBot,
  isValidHttpUrl,
  normalizePath,
  shouldSkipTracking,
  type AnalyticsEnv,
} from "../_lib/analytics";
import { findContestBySlug } from "../_lib/contests";

type PagesContext = {
  request: Request;
  env: AnalyticsEnv;
  params: {
    slug?: string | string[];
  };
};

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  const slugParam = Array.isArray(context.params.slug) ? context.params.slug[0] : context.params.slug;
  const slug = clamp(slugParam, 120).toLowerCase();
  const contest = await findContestBySlug(context.env, slug);

  if (!contest || !isValidHttpUrl(contest.officialUrl)) {
    return Response.redirect(new URL("/contests", context.request.url).toString(), 302);
  }

  const requestUrl = new URL(context.request.url);
  const referrerUrl = getReferrerUrl(context.request);
  const requestSourcePath = requestUrl.searchParams.get("source_path");
  const sourcePath = referrerUrl ? normalizePath(referrerUrl.pathname) : requestSourcePath ? normalizePath(requestSourcePath) : "";
  const sourceClassification = sourcePath ? classifyPage(sourcePath) : { pageType: "other" as const };
  const referrerUtm = getUtmFromUrl(referrerUrl);
  const requestUtm = getUtmFromUrl(requestUrl);
  const clickUtm = {
    utm_source: referrerUtm.utm_source || requestUtm.utm_source,
    utm_medium: referrerUtm.utm_medium || requestUtm.utm_medium,
    utm_campaign: referrerUtm.utm_campaign || requestUtm.utm_campaign,
    utm_content: referrerUtm.utm_content || requestUtm.utm_content,
    utm_term: referrerUtm.utm_term || requestUtm.utm_term,
  };
  const referrerHost = getReferrerHost(context.request);
  const clickBot = isBot(context.request);

  if (!shouldSkipTracking(context.request, referrerUrl)) {
    try {
      await context.env.ANALYTICS_DB?.prepare(
        `INSERT INTO outbound_clicks (
          id, created_at, contest_slug, contest_title, link_key,
          destination_url, destination_domain, source_path, source_page_type,
          source_page_id, referrer_host, utm_source, utm_medium, utm_campaign,
          utm_content, utm_term, country, is_bot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          crypto.randomUUID(),
          new Date().toISOString(),
          contest.slug,
          contest.title,
          clamp(requestUrl.searchParams.get("link") || "official", 80) || "official",
          contest.officialUrl,
          getDomain(contest.officialUrl) || null,
          sourcePath || null,
          sourceClassification.pageType,
          sourceClassification.pageId ?? null,
          referrerHost,
          clickUtm.utm_source || null,
          clickUtm.utm_medium || null,
          clickUtm.utm_campaign || null,
          clickUtm.utm_content || null,
          clickUtm.utm_term || null,
          getCountry(context.request) || null,
          clickBot
        )
        .run();
    } catch (error) {
      console.warn("analytics outbound click failed", error);
    }
  }

  return Response.redirect(contest.officialUrl, 302);
}
