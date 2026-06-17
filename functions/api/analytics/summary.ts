import { addDays, jsonResponse, toDateInput, type AnalyticsEnv } from "../../_lib/analytics";

type PagesContext = {
  request: Request;
  env: AnalyticsEnv;
};

type CountRow = { count: number };
type PageRow = { path: string; page_type: string; page_views: number };
type ContestPvRow = { slug: string; title: string | null; detail_page_views: number };
type ContestClickRow = {
  slug: string;
  title: string | null;
  official_clicks: number;
  trusted_official_clicks: number;
  review_official_clicks: number;
  suspicious_official_clicks: number;
};
type CampaignRow = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  count: number;
  trusted_count?: number;
  review_count?: number;
  suspicious_count?: number;
};
type DailyRow = { date: string; count: number };
type DailyClickRow = DailyRow & { trusted_count: number; review_count: number; suspicious_count: number };
type ClickTrustRow = { trust: string; count: number };

const REPORT_TIMEZONE = "Asia/Tokyo";
const JST_OFFSET_HOURS = 9;
const HAS_UTM_SQL = `(COALESCE(utm_source, '') != '' OR COALESCE(utm_medium, '') != '' OR COALESCE(utm_campaign, '') != '' OR COALESCE(utm_content, '') != '' OR COALESCE(utm_term, '') != '')`;
const SAME_SITE_REFERRER_SQL = `(LOWER(COALESCE(referrer_host, '')) = 'ai-contest-navi.pages.dev' OR LOWER(COALESCE(referrer_host, '')) LIKE '%.ai-contest-navi.pages.dev' OR LOWER(COALESCE(referrer_host, '')) IN ('localhost', '127.0.0.1', '[::1]'))`;
const TRUSTED_SOURCE_PATH_SQL = `(COALESCE(source_path, '') IN ('/', '/contests', '/calendar', '/categories', '/guides', '/archive', '/submit') OR COALESCE(source_path, '') LIKE '/contests/%' OR COALESCE(source_path, '') LIKE '/calendar/%' OR COALESCE(source_path, '') LIKE '/categories/%' OR COALESCE(source_path, '') LIKE '/guides/%' OR COALESCE(source_path, '') LIKE '/archive/%' OR COALESCE(source_path, '') LIKE '/submit/%')`;
const CLICK_TRUST_SQL = `CASE
  WHEN COALESCE(is_bot, 0) != 0 THEN 'suspicious'
  WHEN ${TRUSTED_SOURCE_PATH_SQL} AND (COALESCE(referrer_host, '') = '' OR ${SAME_SITE_REFERRER_SQL}) THEN 'trusted'
  WHEN ${TRUSTED_SOURCE_PATH_SQL} THEN 'review'
  WHEN ${SAME_SITE_REFERRER_SQL} THEN 'review'
  WHEN COALESCE(source_path, '') = '' AND COALESCE(referrer_host, '') = '' AND ${HAS_UTM_SQL} THEN 'review'
  WHEN COALESCE(source_path, '') = '' AND COALESCE(referrer_host, '') = '' THEN 'suspicious'
  WHEN ${HAS_UTM_SQL} THEN 'review'
  WHEN COALESCE(referrer_host, '') != '' THEN 'review'
  ELSE 'suspicious'
END`;

export async function onRequest(context: PagesContext): Promise<Response> {
  const token = context.env.ANALYTICS_ADMIN_TOKEN;
  if (!token) return jsonResponse({ error: "ANALYTICS_ADMIN_TOKEN is not configured" }, { status: 501 });

  const requestUrl = new URL(context.request.url);
  const authHeader = context.request.headers.get("authorization") || "";
  const bearerToken = authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (bearerToken !== token) return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  if (!context.env.ANALYTICS_DB) return jsonResponse({ error: "ANALYTICS_DB is not configured" }, { status: 501 });

  const now = new Date();
  const from = toDateInput(requestUrl.searchParams.get("from"), addDaysForJstDate(now, -30));
  const to = toDateInput(requestUrl.searchParams.get("to"), addDaysForJstDate(now, 0));
  const contest = requestUrl.searchParams.get("contest")?.trim() || "";
  const format = requestUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  const { start, end } = getUtcRangeFromJstDates(from, to);

  const pageFilter = contest ? " AND page_type = 'contest' AND page_id = ?" : "";
  const clickFilter = contest ? " AND contest_slug = ?" : "";
  const pageArgs = contest ? [start, end, contest] : [start, end];
  const clickArgs = contest ? [start, end, contest] : [start, end];

  const [pageViews, outboundClicks, pages, contestPvs, contestClicks, pageCampaigns, clickCampaigns, dailyPvs, dailyClicks, clickTrustRows] =
    await Promise.all([
      firstCount(context.env, `SELECT COUNT(*) AS count FROM page_views WHERE is_bot = 0 AND created_at BETWEEN ? AND ?${pageFilter}`, pageArgs),
      firstCount(context.env, `SELECT COUNT(*) AS count FROM outbound_clicks WHERE is_bot = 0 AND created_at BETWEEN ? AND ?${clickFilter}`, clickArgs),
      all<PageRow>(
        context.env,
        `SELECT path, page_type, COUNT(*) AS page_views
         FROM page_views
         WHERE is_bot = 0 AND created_at BETWEEN ? AND ?${pageFilter}
         GROUP BY path, page_type
         ORDER BY page_views DESC
         LIMIT 200`,
        pageArgs
      ),
      all<ContestPvRow>(
        context.env,
        `SELECT page_id AS slug, MAX(title) AS title, COUNT(*) AS detail_page_views
         FROM page_views
         WHERE is_bot = 0 AND page_type = 'contest' AND created_at BETWEEN ? AND ?${contest ? " AND page_id = ?" : ""}
         GROUP BY page_id
         ORDER BY detail_page_views DESC`,
        pageArgs
      ),
      all<ContestClickRow>(
        context.env,
        `SELECT
           contest_slug AS slug,
           MAX(contest_title) AS title,
           COUNT(*) AS official_clicks,
           SUM(CASE WHEN ${CLICK_TRUST_SQL} = 'trusted' THEN 1 ELSE 0 END) AS trusted_official_clicks,
           SUM(CASE WHEN ${CLICK_TRUST_SQL} = 'review' THEN 1 ELSE 0 END) AS review_official_clicks,
           SUM(CASE WHEN ${CLICK_TRUST_SQL} = 'suspicious' THEN 1 ELSE 0 END) AS suspicious_official_clicks
         FROM outbound_clicks
         WHERE is_bot = 0 AND created_at BETWEEN ? AND ?${clickFilter}
         GROUP BY contest_slug
         ORDER BY trusted_official_clicks DESC, official_clicks DESC`,
        clickArgs
      ),
      all<CampaignRow>(
        context.env,
        `SELECT utm_source, utm_medium, utm_campaign, COUNT(*) AS count
         FROM page_views
         WHERE is_bot = 0 AND created_at BETWEEN ? AND ?${pageFilter}
         GROUP BY utm_source, utm_medium, utm_campaign`,
        pageArgs
      ),
      all<CampaignRow>(
        context.env,
        `SELECT
           utm_source,
           utm_medium,
           utm_campaign,
           COUNT(*) AS count,
           SUM(CASE WHEN ${CLICK_TRUST_SQL} = 'trusted' THEN 1 ELSE 0 END) AS trusted_count,
           SUM(CASE WHEN ${CLICK_TRUST_SQL} = 'review' THEN 1 ELSE 0 END) AS review_count,
           SUM(CASE WHEN ${CLICK_TRUST_SQL} = 'suspicious' THEN 1 ELSE 0 END) AS suspicious_count
         FROM outbound_clicks
         WHERE is_bot = 0 AND created_at BETWEEN ? AND ?${clickFilter}
         GROUP BY utm_source, utm_medium, utm_campaign`,
        clickArgs
      ),
      all<DailyRow>(
        context.env,
        `SELECT substr(datetime(created_at, '+${JST_OFFSET_HOURS} hours'), 1, 10) AS date, COUNT(*) AS count
         FROM page_views
         WHERE is_bot = 0 AND created_at BETWEEN ? AND ?${pageFilter}
         GROUP BY date
         ORDER BY date`,
        pageArgs
      ),
      all<DailyClickRow>(
        context.env,
        `SELECT
           substr(datetime(created_at, '+${JST_OFFSET_HOURS} hours'), 1, 10) AS date,
           COUNT(*) AS count,
           SUM(CASE WHEN ${CLICK_TRUST_SQL} = 'trusted' THEN 1 ELSE 0 END) AS trusted_count,
           SUM(CASE WHEN ${CLICK_TRUST_SQL} = 'review' THEN 1 ELSE 0 END) AS review_count,
           SUM(CASE WHEN ${CLICK_TRUST_SQL} = 'suspicious' THEN 1 ELSE 0 END) AS suspicious_count
         FROM outbound_clicks
         WHERE is_bot = 0 AND created_at BETWEEN ? AND ?${clickFilter}
         GROUP BY date
         ORDER BY date`,
        clickArgs
      ),
      all<ClickTrustRow>(
        context.env,
        `SELECT ${CLICK_TRUST_SQL} AS trust, COUNT(*) AS count
         FROM outbound_clicks
         WHERE is_bot = 0 AND created_at BETWEEN ? AND ?${clickFilter}
         GROUP BY trust`,
        clickArgs
      ),
    ]);

  const contests = mergeContests(contestPvs, contestClicks);
  const clickTrust = normalizeClickTrustRows(clickTrustRows);
  if (format === "csv") {
    return new Response(toContestCsv(contests), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="analytics-contests-${from}-${to}.csv"`,
      },
    });
  }

  return jsonResponse({
    period: { from, to, timezone: REPORT_TIMEZONE },
    totals: {
      pageViews,
      outboundClicks,
      trustedOutboundClicks: clickTrust.trusted,
      reviewOutboundClicks: clickTrust.review,
      suspiciousOutboundClicks: clickTrust.suspicious,
    },
    clickTrust: [
      { trust: "trusted", outboundClicks: clickTrust.trusted },
      { trust: "review", outboundClicks: clickTrust.review },
      { trust: "suspicious", outboundClicks: clickTrust.suspicious },
    ],
    contests,
    pages: pages.map((row) => ({
      path: row.path,
      pageType: row.page_type,
      pageViews: Number(row.page_views || 0),
    })),
    campaigns: mergeCampaigns(pageCampaigns, clickCampaigns),
    daily: mergeDaily(dailyPvs, dailyClicks),
  });
}

function getUtcRangeFromJstDates(from: string, to: string): { start: string; end: string } {
  const start = new Date(`${from}T00:00:00.000+09:00`);
  const end = new Date(`${to}T23:59:59.999+09:00`);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function addDaysForJstDate(date: Date, days: number): Date {
  const jstDate = addDays(new Date(date.getTime() + JST_OFFSET_HOURS * 60 * 60 * 1000), days);
  return new Date(`${jstDate.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

async function firstCount(env: AnalyticsEnv, sql: string, values: unknown[]): Promise<number> {
  const row = await env.ANALYTICS_DB!.prepare(sql).bind(...values).first<CountRow>();
  return Number(row?.count || 0);
}

async function all<T>(env: AnalyticsEnv, sql: string, values: unknown[]): Promise<T[]> {
  const result = await env.ANALYTICS_DB!.prepare(sql).bind(...values).all<T>();
  return result.results ?? [];
}

function mergeContests(pvs: ContestPvRow[], clicks: ContestClickRow[]) {
  const map = new Map<
    string,
    {
      slug: string;
      title: string;
      detailPageViews: number;
      officialClicks: number;
      trustedOfficialClicks: number;
      reviewOfficialClicks: number;
      suspiciousOfficialClicks: number;
      clickThroughRate: number;
      trustedClickThroughRate: number;
    }
  >();
  for (const row of pvs) {
    if (!row.slug) continue;
    map.set(row.slug, {
      slug: row.slug,
      title: row.title || row.slug,
      detailPageViews: Number(row.detail_page_views || 0),
      officialClicks: 0,
      trustedOfficialClicks: 0,
      reviewOfficialClicks: 0,
      suspiciousOfficialClicks: 0,
      clickThroughRate: 0,
      trustedClickThroughRate: 0,
    });
  }
  for (const row of clicks) {
    if (!row.slug) continue;
    const current =
      map.get(row.slug) ||
      {
        slug: row.slug,
        title: row.title || row.slug,
        detailPageViews: 0,
        officialClicks: 0,
        trustedOfficialClicks: 0,
        reviewOfficialClicks: 0,
        suspiciousOfficialClicks: 0,
        clickThroughRate: 0,
        trustedClickThroughRate: 0,
      };
    current.title = current.title || row.title || row.slug;
    current.officialClicks = Number(row.official_clicks || 0);
    current.trustedOfficialClicks = Number(row.trusted_official_clicks || 0);
    current.reviewOfficialClicks = Number(row.review_official_clicks || 0);
    current.suspiciousOfficialClicks = Number(row.suspicious_official_clicks || 0);
    current.clickThroughRate = current.detailPageViews ? current.officialClicks / current.detailPageViews : 0;
    current.trustedClickThroughRate = current.detailPageViews ? current.trustedOfficialClicks / current.detailPageViews : 0;
    map.set(row.slug, current);
  }
  return [...map.values()].sort(
    (a, b) => b.detailPageViews - a.detailPageViews || b.trustedOfficialClicks - a.trustedOfficialClicks || b.officialClicks - a.officialClicks
  );
}

function mergeCampaigns(pageRows: CampaignRow[], clickRows: CampaignRow[]) {
  const map = new Map<
    string,
    {
      utmSource: string;
      utmMedium: string;
      utmCampaign: string;
      pageViews: number;
      outboundClicks: number;
      trustedOutboundClicks: number;
      reviewOutboundClicks: number;
      suspiciousOutboundClicks: number;
    }
  >();
  const keyFor = (row: CampaignRow) => [row.utm_source || "", row.utm_medium || "", row.utm_campaign || ""].join("\u001f");
  const ensure = (row: CampaignRow) => {
    const key = keyFor(row);
    if (!map.has(key)) {
      map.set(key, {
        utmSource: row.utm_source || "",
        utmMedium: row.utm_medium || "",
        utmCampaign: row.utm_campaign || "",
        pageViews: 0,
        outboundClicks: 0,
        trustedOutboundClicks: 0,
        reviewOutboundClicks: 0,
        suspiciousOutboundClicks: 0,
      });
    }
    return map.get(key)!;
  };
  for (const row of pageRows) ensure(row).pageViews = Number(row.count || 0);
  for (const row of clickRows) {
    const current = ensure(row);
    current.outboundClicks = Number(row.count || 0);
    current.trustedOutboundClicks = Number(row.trusted_count || 0);
    current.reviewOutboundClicks = Number(row.review_count || 0);
    current.suspiciousOutboundClicks = Number(row.suspicious_count || 0);
  }
  return [...map.values()].sort((a, b) => b.pageViews - a.pageViews || b.trustedOutboundClicks - a.trustedOutboundClicks || b.outboundClicks - a.outboundClicks);
}

function mergeDaily(pageRows: DailyRow[], clickRows: DailyClickRow[]) {
  const map = new Map<
    string,
    {
      date: string;
      pageViews: number;
      outboundClicks: number;
      trustedOutboundClicks: number;
      reviewOutboundClicks: number;
      suspiciousOutboundClicks: number;
    }
  >();
  for (const row of pageRows) {
    map.set(row.date, {
      date: row.date,
      pageViews: Number(row.count || 0),
      outboundClicks: 0,
      trustedOutboundClicks: 0,
      reviewOutboundClicks: 0,
      suspiciousOutboundClicks: 0,
    });
  }
  for (const row of clickRows) {
    const current = map.get(row.date) || {
      date: row.date,
      pageViews: 0,
      outboundClicks: 0,
      trustedOutboundClicks: 0,
      reviewOutboundClicks: 0,
      suspiciousOutboundClicks: 0,
    };
    current.outboundClicks = Number(row.count || 0);
    current.trustedOutboundClicks = Number(row.trusted_count || 0);
    current.reviewOutboundClicks = Number(row.review_count || 0);
    current.suspiciousOutboundClicks = Number(row.suspicious_count || 0);
    map.set(row.date, current);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function toContestCsv(contests: ReturnType<typeof mergeContests>): string {
  const rows = [
    [
      "contest_slug",
      "contest_title",
      "detail_page_views",
      "official_clicks",
      "trusted_official_clicks",
      "review_official_clicks",
      "suspicious_official_clicks",
      "click_through_rate",
      "trusted_click_through_rate",
    ],
  ];
  for (const contest of contests) {
    rows.push([
      contest.slug,
      contest.title,
      String(contest.detailPageViews),
      String(contest.officialClicks),
      String(contest.trustedOfficialClicks),
      String(contest.reviewOfficialClicks),
      String(contest.suspiciousOfficialClicks),
      contest.clickThroughRate.toFixed(4),
      contest.trustedClickThroughRate.toFixed(4),
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function normalizeClickTrustRows(rows: ClickTrustRow[]): { trusted: number; review: number; suspicious: number } {
  const counts = { trusted: 0, review: 0, suspicious: 0 };
  for (const row of rows) {
    if (row.trust === "trusted" || row.trust === "review" || row.trust === "suspicious") {
      counts[row.trust] = Number(row.count || 0);
    }
  }
  return counts;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
