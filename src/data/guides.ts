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

export type GuideSection = {
  heading: string;
  body: string;
  bullets?: string[];
};

export type Guide = {
  title: string;
  slug: string;
  description: string;
  category: GuideCategory;
  readTime: string;
  difficulty: GuideDifficulty;
  icon: string;
  relatedCategories: GuideCategory[];
  relatedContestCategories: ContestCategory[];
  publishedAt: string;
  updatedAt: string;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  learnings: string[];
  sections: GuideSection[];
  checklist: string[];
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

export const guides: Guide[] = [
  {
    title: "AIコンテストの始め方",
    slug: "start-ai-contest",
    description: "作品を作って応募するまでの基本ステップを解説。",
    category: "はじめ方",
    readTime: "5分",
    difficulty: "初心者向け",
    icon: "start",
    relatedCategories: ["選び方", "応募前チェック"],
    relatedContestCategories: ["ai-image", "ai-video", "ai-manga", "ai-music"],
    publishedAt: "2026-06-11",
    updatedAt: "2026-06-11",
    featured: true,
    seoTitle: "AIコンテストの始め方｜作品を作って応募するまでの基本ステップ",
    seoDescription:
      "AI画像・AI動画・AI漫画など、生成AI作品をコンテストに応募するまでの流れを初心者向けに解説します。",
    learnings: [
      "応募先を探す前に決めること",
      "作品制作から提出までの基本ステップ",
      "応募前に確認すべき条件",
      "初心者がつまずきやすいポイント",
    ],
    sections: [
      {
        heading: "まずは作品形式を決める",
        body: "最初に決めたいのは、画像、動画、漫画、音楽など、どの形式で応募するかです。得意なツールや制作時間に合わせて選ぶと、最後まで作り切りやすくなります。",
        bullets: ["短時間ならAI画像", "演出まで見せたいならAI動画", "物語を見せたいならAI漫画"],
      },
      {
        heading: "締切から逆算して作る",
        body: "コンテストは締切があるため、完成度だけでなく提出までの段取りが大切です。制作、確認、提出の時間を分けて考えると安全です。",
        bullets: ["締切日を確認する", "提出形式を先に見る", "最終日は修正とアップロード用に空ける"],
      },
      {
        heading: "応募前に公式ページを読む",
        body: "AI利用条件や著作権の扱いはコンテストごとに違います。気になるコンテストを見つけたら、公式ページの募集要項を必ず確認しましょう。",
      },
    ],
    checklist: ["締切日", "応募形式", "対象作品形式", "AI利用条件", "著作権・二次利用条件", "公式URL"],
  },
  {
    title: "AI動画コンテストに出すには？",
    slug: "how-to-make-ai-video",
    description: "構成・生成・編集・提出までの流れを紹介。",
    category: "AI動画",
    readTime: "7分",
    difficulty: "初心者〜中級者向け",
    icon: "video",
    relatedCategories: ["はじめ方", "応募前チェック"],
    relatedContestCategories: ["ai-video"],
    publishedAt: "2026-06-11",
    updatedAt: "2026-06-11",
    featured: true,
    seoTitle: "AI動画コンテストに出すには？初心者向けの作り方と応募前チェック",
    seoDescription:
      "AI動画コンテストに応募するための構成、生成、編集、提出前チェックの流れをわかりやすく紹介します。",
    learnings: ["短編AI動画の作り方の流れ", "構成で決めておくこと", "提出前の確認ポイント", "初心者が選びやすいコンテスト条件"],
    sections: [
      {
        heading: "短い構成を先に作る",
        body: "AI動画は生成前に、何を見せる動画なのかを短く決めておくと作りやすくなります。冒頭、見せ場、締めの3つだけでも十分です。",
        bullets: ["冒頭で世界観を見せる", "中盤で変化を作る", "最後に印象を残す"],
      },
      {
        heading: "生成した素材を編集でまとめる",
        body: "生成した動画をそのまま出すより、不要な部分を切り、音やテロップを整えるだけで伝わりやすくなります。応募規定の秒数もここで合わせます。",
      },
      {
        heading: "提出形式を早めに確認する",
        body: "動画コンテストでは、解像度、秒数、ファイル形式、YouTube公開の有無などが指定されることがあります。制作前に確認しておくと作り直しを避けられます。",
      },
    ],
    checklist: ["秒数・尺", "解像度", "ファイル形式", "音源の権利", "AI利用条件", "公開設定"],
  },
  {
    title: "AI漫画コンテストに出すには？",
    slug: "how-to-make-ai-manga",
    description: "ネーム・コマ割り・仕上げ・応募の基本を解説。",
    category: "AI漫画",
    readTime: "7分",
    difficulty: "初心者向け",
    icon: "manga",
    relatedCategories: ["はじめ方", "応募前チェック"],
    relatedContestCategories: ["ai-manga", "ai-illustration"],
    publishedAt: "2026-06-11",
    updatedAt: "2026-06-11",
    featured: true,
    seoTitle: "AI漫画コンテストに出すには？ネームから応募までの流れ",
    seoDescription:
      "AI漫画コンテストに応募するためのネーム、コマ割り、生成、仕上げ、応募前チェックの基本を解説します。",
    learnings: ["AI漫画制作の基本ステップ", "ネームとコマ割りの考え方", "仕上げで確認すること", "応募前に見る規約"],
    sections: [
      {
        heading: "先に短いネームを作る",
        body: "AI漫画は絵作りに入る前に、ページごとの展開を決めておくと安定します。短い作品なら、導入、展開、オチの3段階で考えるだけでも十分です。",
      },
      {
        heading: "コマごとの役割を分ける",
        body: "すべてのコマを同じ密度にせず、説明するコマ、感情を見せるコマ、見せ場のコマを分けると読みやすくなります。",
        bullets: ["説明のコマ", "表情や感情のコマ", "一番見せたい大きなコマ"],
      },
      {
        heading: "文字と画像の権利を確認する",
        body: "画像生成AIだけでなく、編集ツール、フォント、素材、二次利用条件も確認しましょう。受賞後の掲載条件も重要です。",
      },
    ],
    checklist: ["ページ数", "提出形式", "フォント・素材の権利", "AI使用範囲", "公開条件", "受賞作品の扱い"],
  },
  {
    title: "AIコンテスト応募前チェックリスト",
    slug: "ai-contest-checklist",
    description: "締切・規約・著作権・二次利用の確認ポイント。",
    category: "応募前チェック",
    readTime: "4分",
    difficulty: "全員向け",
    icon: "check",
    relatedCategories: ["はじめ方", "選び方"],
    relatedContestCategories: ["ai-image", "ai-video", "ai-manga", "ai-music", "other"],
    publishedAt: "2026-06-11",
    updatedAt: "2026-06-11",
    featured: false,
    seoTitle: "AIコンテスト応募前チェックリスト｜締切・規約・権利の確認ポイント",
    seoDescription:
      "AIコンテストに応募する前に確認したい締切、提出形式、AI利用条件、著作権、二次利用条件をチェックリスト形式で紹介します。",
    learnings: ["応募前に見るべき項目", "権利まわりの確認ポイント", "提出形式の見落とし防止", "公式ページで確認すべきこと"],
    sections: [
      {
        heading: "締切と提出形式を最初に見る",
        body: "締切日だけでなく、締切時刻、タイムゾーン、提出フォーム、ファイル形式まで確認しましょう。提出直前のトラブルを減らせます。",
      },
      {
        heading: "AI利用条件を確認する",
        body: "AI必須、AI可、AI一部可など、条件はコンテストごとに異なります。使用ツールの明記が必要な場合もあります。",
      },
      {
        heading: "著作権と二次利用を見る",
        body: "応募作品の権利がどう扱われるか、主催者がどの範囲で作品を掲載・利用できるかを確認しましょう。",
      },
    ],
    checklist: ["締切時刻", "提出方法", "AI利用条件", "使用素材の権利", "著作権", "二次利用条件", "受賞後の掲載条件"],
  },
  {
    title: "初心者でも参加しやすいAIコンテストの選び方",
    slug: "how-to-choose-beginner-contest",
    description: "初めて応募する人が見るべき条件を紹介。",
    category: "選び方",
    readTime: "5分",
    difficulty: "初心者向け",
    icon: "choose",
    relatedCategories: ["はじめ方", "応募前チェック"],
    relatedContestCategories: ["ai-image", "ai-manga", "other"],
    publishedAt: "2026-06-11",
    updatedAt: "2026-06-11",
    featured: false,
    seoTitle: "初心者でも参加しやすいAIコンテストの選び方",
    seoDescription:
      "初めてAIコンテストに応募する人向けに、締切、応募形式、作品形式、参加しやすさの見方を紹介します。",
    learnings: ["初心者向けコンテストの見分け方", "短期間で応募しやすい形式", "賞金以外に見るべきポイント", "無理なく参加する考え方"],
    sections: [
      {
        heading: "応募形式がシンプルなものを選ぶ",
        body: "初めてなら、X投稿やフォーム提出など、提出方法が分かりやすいコンテストを選ぶと参加しやすくなります。",
      },
      {
        heading: "制作量が少ない形式から始める",
        body: "いきなり長編動画や多ページ作品に挑戦するより、1枚画像、短編動画、短い漫画などから始めると完成まで進めやすいです。",
      },
      {
        heading: "賞金だけで選ばない",
        body: "賞金額だけでなく、応募条件、テーマの自由度、作品掲載の機会、自分の制作スタイルに合うかも見ておきましょう。",
      },
    ],
    checklist: ["応募形式の分かりやすさ", "制作量", "締切までの日数", "テーマの自由度", "初心者向け表記", "公式ページの分かりやすさ"],
  },
];

export function getAllGuides(): Guide[] {
  return guides;
}

export function getFeaturedGuides(limit = 3): Guide[] {
  return guides.filter((guide) => guide.featured).slice(0, limit);
}

export function getGuideBySlug(slug: string): Guide | undefined {
  return guides.find((guide) => guide.slug === slug);
}

export function getGuidesByCategory(category: GuideCategory): Guide[] {
  return guides.filter((guide) => guide.category === category);
}

export function getRelatedGuides(guide: Guide, limit = 3): Guide[] {
  return guides
    .filter((item) => item.slug !== guide.slug)
    .filter((item) => guide.relatedCategories.includes(item.category) || item.relatedCategories.includes(guide.category))
    .slice(0, limit);
}

export function getGuidesForContestCategories(categories: ContestCategory[], limit = 3): Guide[] {
  const scored = guides
    .map((guide) => ({
      guide,
      score: guide.relatedContestCategories.filter((category) => categories.includes(category)).length,
    }))
    .filter((item) => item.score > 0 || item.guide.slug === "ai-contest-checklist")
    .sort((a, b) => b.score - a.score);

  const unique = new Map<string, Guide>();
  for (const item of scored) unique.set(item.guide.slug, item.guide);
  unique.set("ai-contest-checklist", guides.find((guide) => guide.slug === "ai-contest-checklist")!);
  return Array.from(unique.values()).slice(0, limit);
}

export function formatGuideDate(date: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00+09:00`));
}
