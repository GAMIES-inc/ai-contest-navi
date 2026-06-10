export type ContestStatus = "open" | "closing-soon" | "upcoming" | "ended" | "needs-check";

export type ContestCategory =
  | "ai-image"
  | "ai-video"
  | "ai-manga"
  | "ai-music"
  | "ai-illustration"
  | "design"
  | "other";

export type Contest = {
  title: string;
  slug: string;
  description: string;
  deadline: string;
  status: ContestStatus;
  categories: ContestCategory[];
  prize: string;
  applicationMethod: string;
  difficulty: string;
  aiUsage: string;
  rightsNote: string;
  officialUrl: string;
  thumbnail: string;
  featured: boolean;
};

export const contests: Contest[] = [
  {
    title: "第1回 アイマンガコンテスト",
    slug: "first-ai-manga-contest",
    description:
      "AIで制作した1話完結の漫画作品を募集するコンテスト。AI漫画をまず1本形にしたい人に向いています。",
    deadline: "2026-06-30",
    status: "closing-soon",
    categories: ["ai-manga", "ai-illustration"],
    prize: "Amazonギフトカード 10,000円 / 5,000円 / 3,000円",
    applicationMethod: "サイト提出",
    difficulty: "初心者向け",
    aiUsage: "AI必須",
    rightsNote: "提出形式、素材、受賞作品の掲載条件を公式ページで確認",
    officialUrl: "https://a-i-manga.com/events/first-ai-manga-contest",
    thumbnail: "https://a-i-manga.com/images/events/first-ai-manga-contest/ogp.png",
    featured: true,
  },
  {
    title: "U-18アーティストコンテスト2026 AI作品部門",
    slug: "dhu-u18-artist-contest-2026-ai",
    description:
      "18歳以下のクリエイター向け。AIを活用した動画作品で応募できる学生向けコンテストです。",
    deadline: "2026-07-07",
    status: "closing-soon",
    categories: ["ai-video"],
    prize: "各賞あり。詳細は公式確認",
    applicationMethod: "フォーム",
    difficulty: "初心者向け",
    aiUsage: "AI必須",
    rightsNote: "年齢条件、応募部門、AIツールと初期プロンプト開示を確認",
    officialUrl: "https://www.dhw.ac.jp/p/articon/",
    thumbnail: "https://www.dhw.ac.jp/p/articon/img/fb_main.png",
    featured: true,
  },
  {
    title: "AAIFF 2026 - Astana AI Film Festival",
    slug: "aaiff-2026",
    description:
      "生成AIを活用した映像作品を対象にした国際AI映画祭。AI映像作品を海外向けの実績にしたい人向けです。",
    deadline: "2026-08-15",
    status: "open",
    categories: ["ai-video"],
    prize: "合計100万ドル規模のファンド表記あり",
    applicationMethod: "サイト提出",
    difficulty: "作品力必要",
    aiUsage: "AI必須",
    rightsNote: "英語字幕、提出形式、公開利用許諾を公式ページで確認",
    officialUrl: "https://aaiff.ai/",
    thumbnail: "https://aaiff.ai/logo.png",
    featured: true,
  },
  {
    title: "26秒のカーニバル 第九回",
    slug: "26sec-carnival-9",
    description:
      "テーマに沿った26秒の未発表動画を募集。AIを使った短尺動画作品でも応募できます。",
    deadline: "2026-09-13",
    status: "open",
    categories: ["ai-video"],
    prize: "グランプリ 100,000円 / 準グランプリ 50,000円",
    applicationMethod: "フォーム",
    difficulty: "初心者向け",
    aiUsage: "AI可",
    rightsNote: "未発表作品、音源、素材、人物表現、YouTube公開条件を確認",
    officialUrl: "https://www.miiketakashi.com/26/",
    thumbnail: "https://www.miiketakashi.com/26/assets/img/ogp.png",
    featured: true,
  },
  {
    title: "2026 AI Creativity Awards",
    slug: "ai-creativity-awards-2026",
    description:
      "画像、映像、音楽、文章、デザインなど幅広いAI創作作品を募集する国際アワードです。",
    deadline: "2026-11-01",
    status: "open",
    categories: ["ai-image", "ai-video", "ai-music", "design", "other"],
    prize: "バッジ、証明書、プロフィール掲載など。賞金なし",
    applicationMethod: "サイト提出",
    difficulty: "標準",
    aiUsage: "AI必須",
    rightsNote: "AI使用内容の開示、カテゴリごとの提出条件、作品掲載条件を確認",
    officialUrl: "https://aicreativityawards.com/",
    thumbnail: "/brand-thumbnail.svg",
    featured: false,
  },
];
