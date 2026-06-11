import {
  classifyPage,
  clamp,
  getCountry,
  getReferrerHost,
  getUtmFromRecord,
  isBot,
  noContent,
  normalizePath,
  readJsonBody,
  shouldSkipTracking,
  type AnalyticsEnv,
} from "../../_lib/analytics";

type PagesContext = {
  request: Request;
  env: AnalyticsEnv;
};

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  if (shouldSkipTracking(context.request)) return noContent();

  const body = await readJsonBody(context.request);
  const path = normalizePath(body.path);
  if (!path.startsWith("/")) return noContent();

  const classification = classifyPage(path);
  const utm = getUtmFromRecord(body);

  try {
    await context.env.ANALYTICS_DB?.prepare(
      `INSERT INTO page_views (
        id, created_at, path, page_type, page_id, title, referrer_host,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        country, is_bot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        new Date().toISOString(),
        path,
        classification.pageType,
        classification.pageId ?? null,
        clamp(body.title, 240),
        getReferrerHost(context.request),
        utm.utm_source || null,
        utm.utm_medium || null,
        utm.utm_campaign || null,
        utm.utm_content || null,
        utm.utm_term || null,
        getCountry(context.request) || null,
        isBot(context.request)
      )
      .run();
  } catch (error) {
    console.warn("analytics pageview failed", error);
  }

  return noContent();
}
