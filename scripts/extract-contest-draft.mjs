const sourceUrl = process.argv[2];
if (!sourceUrl) throw new Error("Usage: npm run contest:extract-draft -- <official-url>");

const response = await fetch(sourceUrl, { redirect: "follow", signal: AbortSignal.timeout(20000), headers: { "User-Agent": "Mozilla/5.0 YuruContestNaviDraft/1.0" } });
if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
const html = await response.text();
const plain = decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));

const draft = {
  sourceUrl: response.url,
  title: meta("og:title") || tag("title"),
  description: meta("og:description") || meta("description"),
  image: meta("og:image"),
  deadlineCandidates: snippets(/(?:応募|募集|投稿)?締切[^。]{0,80}|(?:202[5-9]年)?\s*\d{1,2}月\d{1,2}日[^。]{0,40}/g),
  prizeCandidates: snippets(/(?:賞金|賞品|副賞|グランプリ)[^。]{0,100}/g),
  applicationCandidates: snippets(/(?:応募方法|参加方法|提出方法)[^。]{0,140}/g),
  rightsCandidates: snippets(/(?:著作権|二次利用|利用許諾|権利)[^。]{0,140}/g),
  status: "候補",
  note: "自動抽出結果です。公開前に公式募集要項で必ず確認してください。",
};
console.log(JSON.stringify(draft, null, 2));

function meta(name) { const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const patterns = [new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"), new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, "i")]; return decodeEntities(patterns.map((pattern) => html.match(pattern)?.[1] ?? "").find(Boolean) ?? ""); }
function tag(name) { return decodeEntities(html.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1]?.replace(/<[^>]+>/g, " ").trim() ?? ""); }
function snippets(pattern) { return [...new Set(plain.match(pattern)?.map((item) => item.trim()) ?? [])].slice(0, 5); }
function decodeEntities(value) { return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim(); }
