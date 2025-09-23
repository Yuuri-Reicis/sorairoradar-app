import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { BarChart3 } from "lucide-react";
import TamagotchiPanel from "./components/TamagotchiPanel";
import LexiconEditor from "./components/LexiconEditor";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  History,
  FileText,
  Download,
  BookOpen,
  RefreshCw,
  Heart,
  Sparkles,
  Cloud,
  Droplets,
  Flame,
  Clock,
  Pin,
  Trash2,
  Copy,
  Upload,
  X,
  ChevronRight,
  MessageCircle
} from "lucide-react";
import { Settings } from "lucide-react";

// ===== メタ情報 =====
const COPYRIGHT_YEAR = 2025 as const;

// ===== 型定義 =====
type Category = "愛情" | "切なさ" | "悲しみ" | "甘え" | "欲";

interface Lexeme {
  term: string;
  weight?: number;
  categories?: Category[];
}

type Lexicon = Record<Category, Lexeme[]>;

// ===== コメントテンプレ型・保存キー =====
type CommentLevel = "soft" | "mid" | "high";
export type CommentBank = Record<Category, Record<CommentLevel, string[]>>;

const COMMENT_BANK_KEY = "emotion_radar_comment_bank_v1";

// デフォルト文言
const DEFAULT_COMMENT_BANK: CommentBank = {
  愛情: {
    soft: [
      "あたたかさが感じられます。思いやりの語が散見されます。",
      "穏やかな好意のニュアンスが強めです。",
      "親近感を示す語が目立ちます。",
    ],
    mid: [
      "明確な好意・肯定の表現が複数見られます。",
      "関係性を重んじる語が重なり、愛情が優勢です。",
      "安心・保護のニュアンスが増えています。",
    ],
    high: [
      "強い愛情のサインが集中しています。",
      "好意表現が高密度です。文の主眼が愛情に寄っています。",
      "肯定・絆の語が主要因となっています。",
    ],
  },
  切なさ: {
    soft: [
      "距離や未充足を示す語が少し見られます。",
      "控えめな物足りなさのニュアンスです。",
      "待機・保留の雰囲気が含まれます。",
    ],
    mid: [
      "会いたさ・届かなさの表現が増えています。",
      "願望と現状のギャップが目立ちます。",
      "恋しさの語が主要因です。",
    ],
    high: [
      "強い希求や距離感がテキストの中心になっています。",
      "未達・不足の表現が高密度です。",
      "切実なトーンが最大要因となっています。",
    ],
  },
  悲しみ: {
    soft: [
      "軽い落ち込み・不安の語が見られます。",
      "弱い否定的情動のサインがあります。",
      "ため息・疲労感の含みがあります。",
    ],
    mid: [
      "寂しさ・痛みの表現が複数確認できます。",
      "涙・喪失に関する語が寄与しています。",
      "ネガティブな心情の記述が増えています。",
    ],
    high: [
      "悲嘆・喪失を示す強い語が集中しています。",
      "否定的情動が主役です。",
      "痛み・涙の語が主要因です。",
    ],
  },
  甘え: {
    soft: [
      "小さな依頼・依存の語が見られます。",
      "安心を求める穏やかな表現です。",
      "近接を望む語が含まれます。",
    ],
    mid: [
      "依頼や呼びかけが増えており、甘えが優勢です。",
      "寄り添い・接触の要望が複数あります。",
      "相手への委ねが明確です。",
    ],
    high: [
      "強い依頼・密接の要望が中心です。",
      "保護・安心への欲求が高密度です。",
      "近接・接触の語が主要因です。",
    ],
  },
  欲: {
    soft: [
      "控えめな要求や希求の語が見られます。",
      "もう少し、を示す語が含まれます。",
      "軽い前向きな欲求です。",
    ],
    mid: [
      "明確な要求・希望が複数あります。",
      "『もっと』『求める』などの語が寄与しています。",
      "行動への志向性が強まっています。",
    ],
    high: [
      "強い希求の表現が中心です。",
      "欲求の語が高密度に出現しています。",
      "積極的な獲得志向が主要因です。",
    ],
  },
};

// 読み込み・保存
function loadCommentBank(): CommentBank {
  try {
    const raw = localStorage.getItem(COMMENT_BANK_KEY);
    if (!raw) return DEFAULT_COMMENT_BANK;
    return JSON.parse(raw) as CommentBank;
  } catch {
    return DEFAULT_COMMENT_BANK;
  }
}

function saveCommentBank(bank: CommentBank) {
  localStorage.setItem(COMMENT_BANK_KEY, JSON.stringify(bank));
}





// ===== カテゴリアイコンマップ =====
const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  愛情: <Heart className="w-3 h-3" />,
  切なさ: <Cloud className="w-3 h-3" />,
  悲しみ: <Droplets className="w-3 h-3" />,
  甘え: <Sparkles className="w-3 h-3" />,
  欲: <Flame className="w-3 h-3" />,
};

// ===== カテゴリカラー =====
const CATEGORY_COLORS: Record<Category, string> = {
  愛情: "from-rose-500/20 to-pink-500/20 border-rose-500/40",
  切なさ: "from-violet-500/20 to-purple-500/20 border-violet-500/40",
  悲しみ: "from-blue-500/20 to-cyan-500/20 border-blue-500/40",
  甘え: "from-amber-500/20 to-yellow-500/20 border-amber-500/40",
  欲: "from-orange-500/20 to-red-500/20 border-orange-500/40",
};

// ===== デフォルト語彙（初期値） =====
const DEFAULT_LEXICON: Lexicon = {
  愛情: [
    { term: "愛してる", weight: 3 },
    { term: "愛してるよ", weight: 3 },
    { term: "好き", weight: 2 },
    { term: "大好き", weight: 3 },
    { term: "いとしい", weight: 2 },
    { term: "大切", weight: 2 },
    { term: "ずっと", weight: 1.5 },
    { term: "抱きしめ", weight: 2 },
    { term: "ぎゅ", weight: 1.8 },
    { term: "キス", weight: 1.6 },
    { term: "そばに", weight: 1.4 },
    { term: "一緒に", weight: 1.2 },
    { term: "誓う", weight: 1.8 },
  ],
  切なさ: [
    { term: "切ない", weight: 3 },
    { term: "恋しい", weight: 2.2, categories: ["愛情", "切なさ"] },
    { term: "会いたい", weight: 2.4, categories: ["愛情", "切なさ"] },
    { term: "まだ", weight: 1 },
    { term: "もし", weight: 1.2 },
    { term: "いつか", weight: 1.2 },
    { term: "届か", weight: 1.4 },
    { term: "足りない", weight: 1.6 },
    { term: "ため息", weight: 1.6 },
  ],
  悲しみ: [
    { term: "悲しい", weight: 3 },
    { term: "涙", weight: 2.4 },
    { term: "辛い", weight: 2.4 },
    { term: "苦しい", weight: 2.2 },
    { term: "寂しい", weight: 2.2 },
    { term: "痛い", weight: 1.6 },
    { term: "泣", weight: 2.0 },
    { term: "喪失", weight: 2.2 },
  ],
  甘え: [
    { term: "ねえ", weight: 1.4 },
    { term: "お願い", weight: 1.8 },
    { term: "だっこ", weight: 2.0 },
    { term: "撫でて", weight: 1.8 },
    { term: "よしよし", weight: 1.6 },
    { term: "そばにいて", weight: 2.0 },
    { term: "ぎゅー", weight: 1.8 },
    { term: "甘え", weight: 2.0 },
    { term: "頼って", weight: 1.6 },
  ],
  欲: [
    { term: "欲しい", weight: 2.0 },
    { term: "欲", weight: 2.2 },
    { term: "もっと", weight: 1.8 },
    { term: "求め", weight: 2.0 },
    { term: "ください", weight: 1.2 },
    { term: "して", weight: 1.1 },
    { term: "触れ", weight: 1.6, categories: ["愛情", "欲"] },
    { term: "抱い", weight: 1.6, categories: ["愛情", "欲"] },
    { term: "熱", weight: 1.4 },
  ],
};

// 強/弱調語、否定マーカー、感情補助（絵文字など）
const INTENSIFIERS = [
  "とても", "すごく", "めっちゃ", "超絶", "超",
  "かなり", "本当に", "ほんとに", "めちゃくちゃ",
];
const DIMINISHERS = ["少し", "ちょっと", "やや", "まあまあ", "すこし"];
const NEGATIONS = ["じゃない", "ではない", "ない", "ぬ", "ず"];
const EMOJI_BOOST: { [k in Category]: string[] } = {
  愛情: ["❤️", "💕", "😘", "💖", "🥰"],
  切なさ: ["🥺", "😢"],
  悲しみ: ["😢", "😭"],
  甘え: ["🤲", "🤗"],
  欲: ["🔥", "💦", "😏"],
};

// サンプル文
const SAMPLE = `
少し不安だけど、それでも前に進みたい。会いたい気持ちはあるし、
大切に思っていることは変わらない。もう少しだけそばにいてほしい。`;

// 画面説明（場所を移動させる用）
const HERO_DESC = `テキストから感情を分析し、5つのカテゴリで可視化します。\n あなたの言葉に込められた感情を美しいレーダーチャートで表現。`;


// ===== ユーティリティ関数 =====
function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function seededPick<T>(arr: T[], seed: string): T {
  if (!arr || arr.length === 0) return (undefined as unknown) as T;
  const n = simpleHash(seed) % arr.length;
  return arr[n];
}

// LocalStorage
const LEXICON_KEY = "emotion_radar_template_lexicon_v1";
const HISTORY_KEY = "emotion_radar_history_v1";
const HISTORY_MAX_DEFAULT = 500;

const HISTORY_SAVE_DEBOUNCE_MS = 6000;
const HISTORY_MIN_CHARS = 10; 

// ▼ 育成ステータス（カテゴリごとの累積ポイント）
type GrowthStats = Record<Category, number>;

const GROWTH_KEY = "emotion_radar_growth_v1";
const DEFAULT_GROWTH: GrowthStats = { 愛情: 0, 切なさ: 0, 悲しみ: 0, 甘え: 0, 欲: 0 };

function loadGrowth(): GrowthStats {
  try {
    const raw = localStorage.getItem(GROWTH_KEY);
    return raw ? (JSON.parse(raw) as GrowthStats) : DEFAULT_GROWTH;
  } catch {
    return DEFAULT_GROWTH;
  }
}

function saveGrowth(v: GrowthStats) {
  localStorage.setItem(GROWTH_KEY, JSON.stringify(v));
}


function loadLexicon(): Lexicon {
  try {
    const raw = localStorage.getItem(LEXICON_KEY);
    if (!raw) return DEFAULT_LEXICON;
    const parsed = JSON.parse(raw) as Lexicon;
    const cats: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
    for (const c of cats) if (!Array.isArray((parsed as any)[c])) return DEFAULT_LEXICON;
    return parsed;
  } catch {
    return DEFAULT_LEXICON;
  }
}

function saveLexicon(lex: Lexicon) {
  localStorage.setItem(LEXICON_KEY, JSON.stringify(lex));
}

function resetLexicon() {
  localStorage.removeItem(LEXICON_KEY);
}

// 解析関数
function countSubstringIndices(text: string, term: string): number[] {
  const indices: number[] = [];
  let from = 0;
  while (true) {
    const idx = text.indexOf(term, from);
    if (idx === -1) break;
    indices.push(idx);
    from = idx + term.length;
  }
  return indices;
}

function windowHas(wordList: string[], windowText: string): boolean {
  return wordList.some((w) => windowText.includes(w));
}

function baseEmojiBoost(text: string, cat: Category): number {
  const emojis = EMOJI_BOOST[cat];
  let c = 0;
  for (const e of emojis) {
    c += (text.match(new RegExp(e, "g")) || []).length;
  }
  return c * 1.2;
}

function analyze(text: string, lexicon: Lexicon, relationBoost = true) {
  const t = text.trim();
  if (!t) {
    return {
      raw: { 愛情: 0, 切なさ: 0, 悲しみ: 0, 甘え: 0, 欲: 0 } as Record<Category, number>,
      normalized: { 愛情: 0, 切なさ: 0, 悲しみ: 0, 甘え: 0, 欲: 0 } as Record<Category, number>,
      details: new Map<Category, Map<string, number>>(),
    };
  }

  const exclamAmp = Math.min(0.5, (t.match(/[!！]/g) || []).length * 0.05);
  const amp = 1 + exclamAmp;

  const raw: Record<Category, number> = {
    愛情: 0,
    切なさ: 0,
    悲しみ: 0,
    甘え: 0,
    欲: 0,
  };
  const details = new Map<Category, Map<string, number>>();

  const categories: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
  for (const c of categories) details.set(c, new Map());

  if (relationBoost) {
    const bondBoosters = ["あなた", "君", "妻", "夫", "二人", "ずっと一緒", "約束", "誓い"];
    let bonus = 0;
    bondBoosters.forEach((w) => (bonus += (t.match(new RegExp(w, "g")) || []).length * 0.6));
    raw["愛情"] += bonus;
    if (bonus)
      details
        .get("愛情")
        ?.set("__RELATION_META__", (details.get("愛情")?.get("__RELATION_META__") || 0) + bonus);
  }

  for (const cat of categories) {
    for (const lex of lexicon[cat]) {
      const weight = lex.weight ?? 1;
      const idxs = countSubstringIndices(t, lex.term);
      for (const idx of idxs) {
        const left = t.slice(Math.max(0, idx - 8), idx);
        const right = t.slice(idx + lex.term.length, idx + lex.term.length + 6);

        let factor = 1;
        if (windowHas(INTENSIFIERS, left)) factor *= 1.5;
        if (windowHas(DIMINISHERS, left)) factor *= 0.7;
        if (windowHas(NEGATIONS, right)) factor = 0;

        const delta = weight * factor;
        const cats = lex.categories ?? [cat];
        for (const cc of cats) {
          raw[cc] += delta;
          const m = details.get(cc)!;
          m.set(lex.term, (m.get(lex.term) || 0) + delta);
        }
      }
    }
  }

  for (const c of categories) {
    raw[c] += baseEmojiBoost(t, c);
  }

  const lengthNorm = Math.max(0.7, Math.min(1.0, 180 / Math.max(60, t.length)));
  for (const c of categories) raw[c] *= amp * lengthNorm;

  const maxv = Math.max(0.0001, ...categories.map((c) => raw[c]));
  const normalized: Record<Category, number> = {
    愛情: (raw["愛情"] / maxv) * 100,
    切なさ: (raw["切なさ"] / maxv) * 100,
    悲しみ: (raw["悲しみ"] / maxv) * 100,
    甘え: (raw["甘え"] / maxv) * 100,
    欲: (raw["欲"] / maxv) * 100,
  };

  return { raw, normalized, details };
}

// 履歴型定義
const APP_VERSION = "1.3.0";
type NormTuple = [number, number, number, number, number];
type TopTerms = Record<Category, Array<[string, number]>>;

type HistItem = {
  id: string;
  ts: string;
  snip: string;
  full: string;
  norm: NormTuple;
  lead: Category[];
  top: TopTerms;
  ver: string;
  lex: string;
  pinned?: boolean;
};

const CATS_FOR_HISTORY: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];

function hashBase36(s: string): string {
  try { return simpleHash(s).toString(36); } catch { return "0"; }
}
function hashLexicon(lex: Lexicon): string {
  try { return hashBase36(JSON.stringify(lex)); } catch { return "0"; }
}
function round1(n: number): number { return Math.round(n * 10) / 10; }

function makeHistItem(
  text: string,
  analysis: ReturnType<typeof analyze>,
  leaders: Category[],
  lexicon: Lexicon
): HistItem {
  const clean = text.trim();
  const full = clean.slice(0, 1000);
  const snip = clean.slice(0, 120);
  const norm = CATS_FOR_HISTORY.map(c => round1(analysis.normalized[c])) as NormTuple;

  const top = CATS_FOR_HISTORY.reduce((acc, c) => {
    const m = analysis.details.get(c);
    const arr: Array<[string, number]> = m
      ? Array.from(m.entries())
          .filter(([k]) => !String(k).startsWith("__"))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([term, val]) => [term, round1(val)])
      : [];
    (acc as any)[c] = arr;
    return acc;
  }, {} as TopTerms);

  const id = `${Date.now().toString(36)}-${hashBase36(full)}`;

  return {
    id,
    ts: new Date().toISOString(),
    snip,
    full,
    norm,
    lead: leaders.slice(),
    top,
    ver: APP_VERSION,
    lex: hashLexicon(lexicon),
  };
}

function loadHistory(): HistItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as HistItem[]) : [];
  } catch { return []; }
}

function saveHistory(items: HistItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

function estimateHistorySizeMB(items: HistItem[]): number {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(items)).length;
    return Math.round((bytes / 1048576) * 100) / 100;
  } catch {
    const bytes = JSON.stringify(items).length;
    return Math.round((bytes / 1048576) * 100) / 100;
  }
}

function appendWithLimit(existing: HistItem[], draft: HistItem, max = HISTORY_MAX_DEFAULT): HistItem[] {
  const h = hashBase36(draft.full);
  const recent = existing.slice(-10);
  if (recent.some(it => hashBase36(it.full) === h)) return existing;

  const next = [...existing, draft];
  while (next.length > max) {
    const idx = next.findIndex(it => !it.pinned);
    if (idx === -1) break;
    next.splice(idx, 1);
  }
  return next;
}

function CommentSettingsEditor({
  bank,
  onChange,
  onClose,
}: {
  bank: CommentBank;
  onChange: (next: CommentBank) => void;
  onClose: () => void;
}) {
  const cats: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
  const levels: CommentLevel[] = ["soft", "mid", "high"];
  const LEVEL_LABEL: Record<CommentLevel, string> = { soft: "SOFT", mid: "MID", high: "HIGH" };

  // 選択中のカテゴリと強さ
  const [cat, setCat] = useState<Category>("愛情");
  const [lv, setLv] = useState<CommentLevel>("soft");

  // 入力欄と編集インデックス
  const [textVal, setTextVal] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);

  // 追加 or 更新
  const saveLine = () => {
    const v = textVal.trim();
    if (!v) return;
    const next = { ...bank, [cat]: { ...bank[cat], [lv]: bank[cat][lv].slice() } } as CommentBank;
    if (editIdx === null) {
      next[cat][lv].push(v);
    } else {
      next[cat][lv][editIdx] = v;
    }
    onChange(next);
    setTextVal("");
    setEditIdx(null);
  };

  // 編集開始
  const startEdit = (idx: number) => {
    setTextVal(bank[cat][lv][idx] ?? "");
    setEditIdx(idx);
  };

  // 削除
  const removeLine = (idx: number) => {
    const next = { ...bank, [cat]: { ...bank[cat], [lv]: bank[cat][lv].slice() } } as CommentBank;
    next[cat][lv].splice(idx, 1);
    onChange(next);
    // いま編集中の行を消したら入力をリセット
    if (editIdx === idx) {
      setTextVal("");
      setEditIdx(null);
    }
  };

  const list = (bank[cat]?.[lv] ?? []).filter(s => typeof s === "string");

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full sm:w-[720px] bg-gradient-to-b from-slate-900 to-slate-950 border-l border-white/10 shadow-2xl flex flex-col">
        {/* ヘッダ */}
        <div className="p-4 border-b border-white/10 backdrop-blur-lg bg-white/5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">コメント設定</h2>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm">閉じる</button>
        </div>

        {/* 本体 */}
        <div className="p-4 space-y-4 overflow-y-auto">

        <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm leading-relaxed">
          入力結果に出すコメントを、感情と強さごとに保存・編集します。保存した複数の文から1つがランダムで表示されます。
        </div>

          {/* 入力セクション */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            {/* カテゴリボタン */}
            <div className="flex flex-wrap gap-2">
              {cats.map(c => (
                <button
                  key={c}
                  onClick={() => { setCat(c); setEditIdx(null); setTextVal(""); }}
                  className={
                    "px-3 py-1.5 rounded-full text-sm border " +
                    (cat === c ? "bg-white/20 border-white/40" : "bg-black/20 border-white/10 hover:bg-black/30")
                  }
                >
                  {c}
                </button>
              ))}
            </div>

            {/* 強さボタン */}
            <div className="flex flex-wrap gap-2">
              {levels.map(l => (
                <button
                  key={l}
                  onClick={() => { setLv(l); setEditIdx(null); setTextVal(""); }}
                  className={
                    "px-3 py-1.5 rounded-full text-xs border " +
                    (lv === l ? "bg-white/20 border-white/40" : "bg-black/20 border-white/10 hover:bg-black/30")
                  }
                >
                  {LEVEL_LABEL[l]}
                </button>
              ))}
            </div>

            {/* テキスト入力欄 */}
            <textarea
              value={textVal}
              onChange={(e) => setTextVal(e.target.value)}
              className="w-full h-28 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm"
              placeholder="ここに文を入力"
            />

            {/* 保存/キャンセル */}
            <div className="flex items-center gap-2 justify-end">
              {editIdx !== null && (
                <button
                  onClick={() => { setTextVal(""); setEditIdx(null); }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs"
                >
                  編集をやめる
                </button>
              )}
              <button
                onClick={saveLine}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-sm shadow-lg shadow-cyan-500/25"
              >
                {editIdx === null ? "保存" : "更新"}
              </button>
            </div>
          </div>

          {/* 保存済み一覧（選択中のカテゴリ×強さ） */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">以前保存した内容</h3>
              <div className="text-xs opacity-70">{cat} / {LEVEL_LABEL[lv]}</div>
            </div>

            {list.length === 0 ? (
              <div className="text-sm opacity-70">まだありません。</div>
            ) : (
              <div className="space-y-2">
                {list.map((line, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <span className="text-sm">{line}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(idx)}
                        className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => removeLine(idx)}
                        className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-xs"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </aside>
    </div>
  );
}

// ===== メインコンポーネント =====
export default function EmotionRadarTemplateApp() {
  const [text, setText] = useState("");
  const [relationBoost, setRelationBoost] = useState(true);
  const [lexicon, setLexicon] = useState<Lexicon>(DEFAULT_LEXICON);

  const [commentBank, setCommentBank] = useState<CommentBank>(DEFAULT_COMMENT_BANK);

  const [showEditor, setShowEditor] = useState(false);
  const [showCommentSettings, setShowCommentSettings] = useState(false);
  const [showTamagotchi, setShowTamagotchi] = useState(false);
  const [showGrowth, setShowGrowth] = useState(false);
  const [growth, setGrowth] = useState<GrowthStats>(DEFAULT_GROWTH);
  const [lastCsv, setLastCsv] = useState<string>("");
  const [showCsvContent, setShowCsvContent] = useState<boolean>(false);
  const csvTextRef = useRef<HTMLTextAreaElement | null>(null);
  const [history, setHistory] = useState<HistItem[]>([]);
  const lastSavedHashRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showHistExport, setShowHistExport] = useState(false);
  const [histExportText, setHistExportText] = useState<string>("");
  const histExportRef = useRef<HTMLTextAreaElement | null>(null);
  
 // ▼ たまごっちの現在LvをTOPに出すための状態（←ここに移動）
  const [petLevel, setPetLevel] = useState<number>(1);

  useEffect(() => {
    // 初回読み取り
    const readLevel = () => {
      try {
        const raw = localStorage.getItem("emotion_pet_v1");
        const parsed = raw ? JSON.parse(raw) : { total: 0 };
        const total = Number(parsed?.total ?? 0);
        return Math.floor(total / 100) + 1;
      } catch {
        return 1;
      }
    };
    setPetLevel(readLevel());

    // ストレージ更新（他タブ更新の反映）
    const onStorage = (e: StorageEvent) => {
      if (e.key === "emotion_pet_v1") {
        try {
          const parsed = e.newValue ? JSON.parse(e.newValue) : { total: 0 };
          const total = Number(parsed?.total ?? 0);
          setPetLevel(Math.floor(total / 100) + 1);
        } catch { /* 何もしない */ }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

useEffect(() => {
    if (!showTamagotchi) {
      try {
        const raw = localStorage.getItem("emotion_pet_v1");
        const parsed = raw ? JSON.parse(raw) : { total: 0 };
        const total = Number(parsed?.total ?? 0);
        setPetLevel(Math.floor(total / 100) + 1);
      } catch {}
    }
      }, [showTamagotchi]);

    // ▼ トースト（小さな通知）
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "warn" | "error" } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
    }, [toast]);

  // ▼ トースト位置の微調整（px）
  const TOAST_SHIFT_PX = 24;

  // ▼ レベルアップ演出（1.2秒だけ表示）
  const [levelFxAt, setLevelFxAt] = useState<number | null>(null);
  useEffect(() => {
    if (!levelFxAt) return;
    const t = setTimeout(() => setLevelFxAt(null), 1200);
    return () => clearTimeout(t);
  }, [levelFxAt]);

  // ▼ TOPからワンタップでご飯（クイックご飯）
  const PET_KEY = "emotion_pet_v1";
  const FEED_LOG_KEY = "emotion_pet_feed_log_v1";
  const FEED_LOG_MAX = 50;

  // 保存データの形（超シンプルに）
  type PetSave = {
    stats: Record<Category, number>;
    total: number;
    version: number;
    forms?: { teen?: Category; adult?: Category };
  };

  // 「同じ解析かどうか」の鍵（小数1桁で丸めて連結）
  const makeResultKey = (latest: Record<Category, number> | null): string | null => {
    if (!latest) return null;
    const cats: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
    const arr = cats.map(c => Math.round((latest[c] ?? 0) * 10));
    return arr.join("|");
  };

    const quickFeed = () => {
    const latest = result?.normalized ?? null;
    if (!latest) { setToast({ msg: "先に測定してね", kind: "warn" }); return; }

    try {
      // 同じ結果の連投を防ぐ
      const key = makeResultKey(latest);
      const rawLog = localStorage.getItem(FEED_LOG_KEY);
      const log: string[] = rawLog ? JSON.parse(rawLog) : [];
      if (key && log.includes(key)) { setToast({ msg: "同じ解析結果はもうあげてるよ", kind: "warn" }); return; }


      // いまの育成データを読む（なければ初期値）
      const rawPet = localStorage.getItem(PET_KEY);
      const pet: PetSave = rawPet ? JSON.parse(rawPet) : {
        stats: { 愛情: 0, 切なさ: 0, 悲しみ: 0, 甘え: 0, 欲: 0 },
        total: 0, version: 1, forms: {}
      };

      const cats: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
      const prevLevel = Math.floor(Number(pet.total) / 100) + 1;
      const gainFactor = (lv: number) => (lv < 3 ? 1.0 : lv < 6 ? 0.7 : lv < 10 ? 0.5 : 0.35);

      // 加算量を作る（Lvが上がるほど少し控えめ）
      const incStats: Record<Category, number> = { 愛情: 0, 切なさ: 0, 悲しみ: 0, 甘え: 0, 欲: 0 };
      cats.forEach((c) => {
        const raw = (latest[c] ?? 0) * 0.2 * gainFactor(prevLevel);
        incStats[c] = raw > 0 ? Math.max(1, Math.round(raw)) : 0;
      });

      // 反映
      const next: PetSave = { ...pet, stats: { ...pet.stats }, forms: pet.forms ?? {}, total: pet.total };
      cats.forEach(c => { next.stats[c] = Math.max(0, (next.stats[c] ?? 0) + incStats[c]); });
      next.total += cats.reduce((s, c) => s + incStats[c], 0);

      // 進化先の確定（teen/adult 到達時）
      const stageFromLevel = (lv: number) => (lv < 3 ? "egg" : lv < 6 ? "child" : lv < 10 ? "teen" : "adult");
      const newLevel = Math.floor(next.total / 100) + 1;
      const prevStage = stageFromLevel(prevLevel);
      const newStage  = stageFromLevel(newLevel);
      const topCat: Category = cats.reduce((a, b) => ((latest[a] ?? 0) >= (latest[b] ?? 0) ? a : b));
      if (newStage !== prevStage) {
        if (newStage === "teen"  && !(next.forms?.teen))  next.forms = { ...(next.forms ?? {}), teen: topCat };
        if (newStage === "adult" && !(next.forms?.adult)) next.forms = { ...(next.forms ?? {}), adult: topCat };
      }

      // 保存
      localStorage.setItem(PET_KEY, JSON.stringify(next));
      if (key) {
        const newLog = [key, ...log.filter(x => x !== key)].slice(0, FEED_LOG_MAX);
        localStorage.setItem(FEED_LOG_KEY, JSON.stringify(newLog));
      }

                  // TOPのLvバッジも更新
      setPetLevel(newLevel);
      if (newLevel > prevLevel) setLevelFxAt(Date.now());

      setToast({ msg: `ごはん完了！ Lv.${prevLevel} → ${newLevel}`, kind: "ok" });
    } catch {
      setToast({ msg: "保存でエラー…もう一度試してね", kind: "error" });
    }
  };

  useEffect(() => {
    const loaded = loadLexicon();
    setLexicon(loaded);
  }, []);


  useEffect(() => {
    saveLexicon(lexicon);
  }, [lexicon]);

useEffect(() => { setCommentBank(loadCommentBank()); }, []);
useEffect(() => { saveCommentBank(commentBank); }, [commentBank]);


  useEffect(() => {
    const h = loadHistory();
    setHistory(h);
    if (h.length) {
      const last = h[h.length - 1];
      lastSavedHashRef.current = hashBase36(last.full);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // 初回ロード
  useEffect(() => {
    setGrowth(loadGrowth());
  }, []);

// 変更があったら保存
  useEffect(() => {
    saveGrowth(growth);
  }, [growth]);


  const commitHistory = useCallback((reason: 'debounce' | 'blur') => {
    const clean = text.trim();
    if (clean.length < HISTORY_MIN_CHARS) return;
    const full = clean.slice(0, 1000);
    const h = hashBase36(full);
    if (lastSavedHashRef.current === h) return;

    const localResult = analyze(clean, lexicon, relationBoost);
    const catsOrder: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
    const src = localResult.normalized as Record<Category, number>;
    const vals = catsOrder.map((k) => src[k]);
    const max = Math.max(...vals);
    const localLeaders: Category[] = max <= 0 ? [] : catsOrder.filter((k) => Math.abs(src[k] - max) <= 0.0001);

    const item = makeHistItem(clean, localResult, localLeaders, lexicon);
    const next = appendWithLimit(history, item, HISTORY_MAX_DEFAULT);
    if (next !== history) {
      setHistory(next);
      saveHistory(next);
      lastSavedHashRef.current = h;
    }
  }, [text, lexicon, relationBoost, history]);

  const result = useMemo(() => analyze(text, lexicon, relationBoost), [text, lexicon, relationBoost]);

  const radarData = useMemo(() => {
    const cats: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
    return cats.map((cat) => ({ subject: cat, A: Number(result.normalized[cat].toFixed(2)) }));
  }, [result]);

  const topTerms = (cat: Category) => {
    const m = result.details.get(cat);
    if (!m) return [] as Array<[string, number]>;
    const entries: Array<[string, number]> = Array.from(m.entries());
    const filtered = entries.filter(([k, _v]: [string, number]) => !String(k).startsWith("__"));
    return filtered.sort((a, b) => b[1] - a[1]).slice(0, 6);
  };

  const catsOrder: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
  const leaders: Category[] = useMemo(() => {
    const src = result.normalized as Record<Category, number>;
    const vals = catsOrder.map((k) => src[k]);
    const max = Math.max(...vals);
    if (!text.trim() || max <= 0) return [];
    const EPS = 0.0001;
    return catsOrder.filter((k) => Math.abs(src[k] - max) <= EPS);
  }, [result, text]);

  const commentFor = (cat: Category): string => {
  if (!text.trim()) return "";
  if (!leaders.includes(cat)) return "";
  const score = result.normalized[cat];
  const level: CommentLevel = score >= 85 ? "high" : score >= 60 ? "mid" : "soft";

  const pool = commentBank[cat][level];
  const usable = pool.filter(s => s.trim() !== "");
  const base = usable.length ? usable[Math.floor(Math.random() * usable.length)] : "";
  return base; // ← 追記はしない
};


  const activeComments = useMemo(
    () => leaders.map((c) => ({ cat: c, text: commentFor(c) })).filter((x) => x.text),
    [leaders, text, result]
  );

  const exportCSV = () => {
    const rows: string[] = [];
    rows.push("カテゴリ,Normalized(%)");
    (["愛情", "切なさ", "悲しみ", "甘え", "欲"] as Category[]).forEach((c) => {
      rows.push(`${c},${result.normalized[c].toFixed(1)}`);
    });
    const csvBody = rows.join("\n");
    setLastCsv("\uFEFF" + csvBody);
    setShowCsvContent(true);
  };

  const importLexiconJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const cats: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
        for (const c of cats) if (!Array.isArray((parsed as any)[c])) throw new Error("Invalid shape");
        setLexicon(parsed as Lexicon);
        saveLexicon(parsed as Lexicon);
      } catch (e) {
        alert("読み込みに失敗しました。json形式を確認してください。");
      }
    };
    reader.readAsText(file);
  };

  const loadSample = () => setText(SAMPLE);
  const resetAll = () => {
    setText("");
    setRelationBoost(true);
  };

  const restoreFromHistory = useCallback((item: HistItem) => {
    setText(item.full);
  }, []);

    const togglePinHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.map((it) => (it.id === id ? { ...it, pinned: !it.pinned } : it));
      saveHistory(next);
      return next;
    });
  }, []);

  const deleteHistoryItem = useCallback((id: string) => {
    setHistory((prev) => {
      const target = prev.find(it => it.id === id);
      if (target?.pinned) {
        setToast({ msg: "ピン済みは削除できません（先にピン解除してね）", kind: "warn" });
        return prev;
      }
      const next = prev.filter((it) => it.id !== id);
      saveHistory(next);
      return next;
    });
  }, []);

    const clearAllHistory = useCallback(() => {
    if (!window.confirm("ピン以外の履歴をすべて削除します。よろしいですか？")) return;
    setHistory((prev) => {
      const kept = prev.filter((it) => it.pinned);
      saveHistory(kept);
      return kept;
    });
    lastSavedHashRef.current = null;
    setToast({ msg: "ピン以外の履歴を削除しました", kind: "ok" });
  }, []);

  const doExportHistory = useCallback(() => {
    try {
      const txt = JSON.stringify(history, null, 2);
      setHistExportText(txt);
      setShowHistExport(true);
    } catch {
      alert("エクスポートに失敗しました");
    }
  }, [history]);

  const handleImportHistoryInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error("array");
        const ok = parsed.every((x) => x && typeof x.id === "string" && typeof x.ts === "string" && typeof x.full === "string");
        if (!ok) throw new Error("shape");
        setHistory(parsed as HistItem[]);
        saveHistory(parsed as HistItem[]);
      } catch {
        alert("読み込みに失敗しました。JSON形式を確認してください。");
      }
    };
    reader.readAsText(f);
  }, []);

  return (
        <div className="min-h-screen w-screen bg-gradient-to-br from-black via-slate-950 to-blue-950 text-white relative overflow-hidden overflow-x-hidden">

    {/* 背景エフェクト */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>


{/* ▼▼ 全体を中央寄せする外枠 ▼▼ */}
<div className="relative z-10 flex justify-center px-4 sm:px-6 lg:px-8 py-8">
  {/* 中央寄せ＋最大幅を持つ内側の箱 */}
  <div className="w-full max-w-7xl">

        {/* ヘッダー */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
             
              <div className="mt-2 flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 text-xs font-medium">
                  v{APP_VERSION}
                </span>
              </div>
          
            </div>
          </div>

        {/* CSV表示 */}
        {showCsvContent && lastCsv && (
          <div className="mb-6 backdrop-blur-lg bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-300">CSVプレビュー</span>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(lastCsv);
                      alert("コピーしました！");
                    } catch {
                      alert("コピーに失敗しました。");
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-xs flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  コピー
                </button>
                <button
                  onClick={() => setShowCsvContent(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-xs flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  閉じる
                </button>
              </div>
            </div>
            <textarea
              ref={csvTextRef}
              readOnly
              value={lastCsv}
              className="w-full h-32 bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-xs font-mono"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 入力パネル */}
          <section className="backdrop-blur-lg bg-white/5 rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-colors relative">
            
            <div className="flex flex-wrap gap-2 mb-3 w-full -mt-3">
              <button
                onClick={() => setShowHistory(true)}
                className="px-3 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-200 flex items-center gap-2 group"
              >
                <History className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                履歴
              </button>
              <button
                onClick={loadSample}
                className="px-3 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-200 flex items-center gap-2 group"
              >
                <FileText className="w-4 h-4 group-hover:scale-110 transition-transform" />
                サンプル
              </button>
              <button
                onClick={exportCSV}
                className="px-3 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-200 flex items-center gap-2 group"
              >
                <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                CSV
              </button>
              <button
                onClick={() => setShowEditor(true)}
                className="px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transition-all duration-200 flex items-center gap-2 group shadow-lg shadow-purple-500/25"
              >
                <BookOpen className="w-4 h-4 group-hover:rotate-3 transition-transform" />
                辞書編集
              </button>
              <button
                 onClick={() => setShowCommentSettings(true)}
                 className="px-3 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 transition-all duration-200 flex items-center gap-2 group shadow-lg shadow-cyan-500/25"
              >
                <Settings className="w-4 h-4" />
                設定
              </button>
              <button
  onClick={() => setShowTamagotchi(true)}
  className="px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 hover:from-emerald-600 hover:to-lime-600 text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25"
>
    <BarChart3 className="w-4 h-4" />
  育成
  <span className="ml-1 px-2 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px]">
    Lv.{petLevel}
  </span>
</button>

<button
  onClick={quickFeed}
  disabled={!result?.normalized}
  title={!result?.normalized ? "先に測定してね" : undefined}
  className="px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-sm flex items-center gap-2 shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
>

         <Heart className="w-4 h-4" />
  クイックご飯
</button>

{/* トースト（上：中央基準＋微調整オフセット） */}
{toast && (
  <div
    className="fixed z-[120] pointer-events-none"
      style={{
    top: "5rem",
    left: "60%",
    transform: `translateX(calc(-50% + ${TOAST_SHIFT_PX}px))`,
  }}
  >
    <div
      className={
        "max-w-[90vw] whitespace-pre-wrap text-center pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-xl border shadow-lg " +
        (toast.kind === "ok"
          ? "bg-emerald-500/15 border-emerald-500/40"

          : toast.kind === "warn"
          ? "bg-amber-500/15 border-amber-500/40"
          : "bg-rose-500/15 border-rose-500/40")
      }
    >
      {/* ✓ / ！ の簡易SVG（import不要） */}
      {toast.kind === "ok" ? (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="9 12 12 15 17 10" />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12" y2="16" />
        </svg>
      )}
      <span className="text-sm">{toast.msg}</span>
    </div>
  </div>
)}

{/* レベルアップ演出（上中央） */}
{levelFxAt && (
  <div className="fixed left-1/2 top-20 -translate-x-1/2 z-[130] pointer-events-none">
    <div className="relative w-48 h-48">
      <style>{`
        @keyframes pop { 0%{transform:scale(0);opacity:0} 30%{transform:scale(1);opacity:1} 100%{transform:scale(0.6);opacity:0} }
        @keyframes ray { 0%{transform:scaleX(0);opacity:0} 40%{transform:scaleX(1);opacity:1} 100%{transform:scaleX(0);opacity:0} }
      `}</style>
      <div className="absolute inset-0 rounded-full bg-white/30 blur-xl animate-[pop_900ms_ease-out_forwards]" />
      {[0,45,90,135].map((deg) => (
        <div
          key={deg}
          className="absolute left-1/2 top-1/2 h-0.5 w-24 origin-left bg-white/80"
          style={{ transform: `translate(-50%,-50%) rotate(${deg}deg)`, animation: "ray 900ms ease-out forwards" }}
        />
      ))}
    </div>
    </div>
)}


            </div>


            
            
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-purple-400" />
                テキスト入力
              </h2>
              <button
                onClick={resetAll}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-xs flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                リセット
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                saveTimerRef.current = setTimeout(() => commitHistory('debounce'), HISTORY_SAVE_DEBOUNCE_MS);
              }}
              onBlur={() => commitHistory('blur')}
              placeholder="ここにテキストを入力してください..."
              className="w-full h-64 bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-base resize-none focus:border-purple-500/50 focus:outline-none transition-colors placeholder:text-gray-500"
            />

            <div className="mt-2 p-4 bg-black/20 backdrop-blur-sm rounded-xl border border-white/10">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={relationBoost}
                  onChange={(e) => setRelationBoost(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                />
                <span className="text-sm group-hover:text-purple-400 transition-colors">
                  関係ブースト（呼称・関係語で愛情に加点）
                </span>
              </label>
            </div>
            <div className="mt-5 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
              <p className="text-xs text-gray-300 leading-relaxed">
                💡 簡易ロジック：辞書マッチ＋強弱表現＋否定判定＋絵文字補正
              </p>
              {/* 画面説明：左下に配置 */}
            <div className="mt-6 text-sm text-gray-300 leading-relaxed sm:max-w-[36rem] whitespace-pre-line">
               {HERO_DESC}
            </div>
            <p className="absolute left-1/1 -translate-x-1/1 -bottom-0 text-s text-gray-400/85">
                Emotional Hue Radar
              </p>
              <p className="absolute left-1/2 -translate-x-2/2 -bottom-0 text-xs text-gray-400/85">
                © {COPYRIGHT_YEAR} Reicis. 個人利用のみ。改変・再配布禁止。
              </p>

            </div>

          </section>

          {/* 結果パネル */}
          <section className="backdrop-blur-lg bg-white/5 rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-colors">
            {/* コメント表示 */}
            {activeComments.length > 0 && (
              <div className="mb-6 space-y-3">
                {activeComments.map(({ cat, text: msg }) => (
                  <div
                    key={cat}
                    className={`p-4 rounded-xl bg-gradient-to-r ${CATEGORY_COLORS[cat]} backdrop-blur-sm border`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {CATEGORY_ICONS[cat]}
                      <span className="text-sm font-medium">{cat}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{msg}</p>
                  </div>
                ))}
              </div>
            )}

            {/* レーダーチャート */}
            <div className="h-80 w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "#e2e8f0", fontSize: 12 }}
                  />
                  <PolarRadiusAxis
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    angle={30}
                    domain={[0, 100]}
                  />
                  <Radar
                    name="Score"
                    dataKey="A"
                    stroke="rgb(168, 85, 247)"
                    fill="rgb(168, 85, 247)"
                    fillOpacity={0.3}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(0,0,0,0.8)",
                      border: "1px solid rgba(168,85,247,0.5)",
                      borderRadius: "8px",
                      backdropFilter: "blur(8px)",
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* カテゴリ詳細 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["愛情", "切なさ", "悲しみ", "甘え", "欲"] as Category[]).map((c) => (
                <div
                  key={c}
                  className={`p-4 rounded-xl bg-gradient-to-r ${
                    leaders.includes(c)
                      ? CATEGORY_COLORS[c]
                      : "from-white/5 to-white/5 border-white/10"
                  } backdrop-blur-sm border transition-all duration-300 ${
                    leaders.includes(c) ? "scale-105 shadow-lg" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {CATEGORY_ICONS[c]}
                      <span className="font-medium">{c}</span>
                      {leaders.includes(c) && (
                        <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs">
                          {leaders.length > 1 ? "同率首位" : "首位"}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {result.normalized[c].toFixed(1)}%
                    </span>
                  </div>
                  <ul className="space-y-1 text-xs">
                    {topTerms(c).length === 0 && (
                      <li className="text-gray-500">寄与語なし</li>
                    )}
                    {topTerms(c).slice(0, 3).map(([term, val]) => (
                      <li key={term} className="flex items-center justify-between">
                        <span className="truncate">{term}</span>
                        <span className="text-gray-400">+{val.toFixed(1)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

        </div>
        </div> 
</div>   


      {/* 履歴パネル */}
      {showHistory && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
          <aside className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-gradient-to-b from-slate-900 to-slate-950 border-l border-white/10 shadow-2xl flex flex-col">
            <div className="p-4 border-b border-white/10 backdrop-blur-lg bg-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-semibold">履歴</h2>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs">
                    {history.length}件
                  </span>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

                        <div className="p-3 border-b border-white/10 flex gap-2">
              <button
                onClick={clearAllHistory}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 transition-colors text-xs flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                ピン以外を全削除
              </button>
              <button
                onClick={doExportHistory}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-xs flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                エクスポート
              </button>
              <label className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-xs flex items-center gap-1 cursor-pointer">
                <Upload className="w-3 h-3" />
                インポート
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleImportHistoryInput}
                />
              </label>
            </div>

            {showHistExport && (
              <div className="p-3 border-b border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">JSON出力</span>
                  <button
                    onClick={() => setShowHistExport(false)}
                    className="p-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <textarea
                  ref={histExportRef}
                  readOnly
                  value={histExportText}
                  className="w-full h-32 bg-black/20 border border-white/10 rounded-lg p-2 text-xs font-mono"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {history.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">まだ履歴がありません</p>
                </div>
              ) : (
                history
                  .slice()
                  .reverse()
                  .map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">
                          {new Date(item.ts).toLocaleString("ja-JP")}
                        </span>
                        <div className="flex items-center gap-1">
                          {item.lead.map((c) => (
                            <span
                              key={c}
                              className="px-2 py-0.5 rounded-full bg-white/10 text-xs flex items-center gap-1"
                            >
                              {CATEGORY_ICONS[c]}
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-300 mb-3 line-clamp-2">{item.snip}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => restoreFromHistory(item)}
                          className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 transition-colors text-xs flex items-center gap-1"
                        >
                          <ChevronRight className="w-3 h-3" />
                          復元
                        </button>
                        <button
                          onClick={() => togglePinHistory(item.id)}
                          className={`px-3 py-1.5 rounded-lg ${
                            item.pinned ? "bg-amber-500/20 border-amber-500/30" : "bg-white/10 border-white/20"
                          } hover:bg-white/20 border transition-colors text-xs flex items-center gap-1`}
                        >
                          <Pin className="w-3 h-3" />
                          {item.pinned ? "解除" : "ピン"}
                        </button>
                        <button
                          onClick={() => deleteHistoryItem(item.id)}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-red-500/20 border border-white/20 hover:border-red-500/30 transition-colors text-xs flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </aside>
        </div>
      )}

      {/* コメント設定エディタ */}
      {showCommentSettings && (
        <CommentSettingsEditor
          bank={commentBank}
          onChange={setCommentBank}
          onClose={() => setShowCommentSettings(false)}
        />
      )}

      {showTamagotchi && (
        <TamagotchiPanel
          latest={result?.normalized ?? null}
          onClose={() => setShowTamagotchi(false)}
        />
      )}


      {/* 育成パネル */}
      {showGrowth && (
        <GrowthPanel
          growth={growth}
          onClose={() => setShowGrowth(false)}
          onReset={() => setGrowth(DEFAULT_GROWTH)}
          onApplyFromCurrent={() => {
      // 直近の解析結果を加算（必要なら係数を調整）
       const cats: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
      setGrowth(prev => {
        const next = { ...prev };
        cats.forEach(c => {
          const inc = Math.round((result?.normalized?.[c] ?? 0));
          next[c] = Math.max(0, (next[c] ?? 0) + inc);
        });
        return next;
      });
    }}
  />
)}

      {/* 辞書エディタ */}
      {showEditor && (
        <LexiconEditor
          lexicon={lexicon}
          onClose={() => setShowEditor(false)}
          onChange={setLexicon}
          onImport={importLexiconJSON}
          onReset={() => {
            setLexicon(DEFAULT_LEXICON);
            resetLexicon();            
          }}
        />
      )}
    </div>
  );
}
function GrowthPanel({
  growth,
  onClose,
  onReset,
  onApplyFromCurrent,
}: {
  growth: GrowthStats;
  onClose: () => void;
  onReset: () => void;
  onApplyFromCurrent: () => void;
}) {
  const cats: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
  const maxVal = Math.max(100, ...cats.map(c => Math.max(0, growth[c] ?? 0)));

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full sm:w-[720px] bg-gradient-to-b from-slate-900 to-slate-950 border-l border-white/10 shadow-2xl flex flex-col">
        {/* ヘッダ */}
        <div className="p-4 border-b border-white/10 bg-white/5 backdrop-blur flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            育成ステータス
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={onReset} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm">リセット</button>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm">閉じる</button>
          </div>
        </div>

        {/* 本体 */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* 説明 */}
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm leading-relaxed">
            解析結果から加算された育成ポイントを表示します。「最新の解析結果を加算」を押すと、現在の結果をステータスに足します。
          </div>

          {/* グラフ（シンプルなバー） */}
          <div className="space-y-3">
            {cats.map(c => {
              const v = Math.max(0, growth[c] ?? 0);
              const w = Math.round((v / maxVal) * 100);
              return (
                <div key={c}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="opacity-80">{c}</span>
                    <span className="opacity-70">{v}</span>
                  </div>
                  <div className="h-3 rounded bg-black/30 border border-white/10">
                    <div className="h-full rounded bg-gradient-to-r from-sky-500 to-cyan-500" style={{ width: `${w}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 加算アクション */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onApplyFromCurrent}
              className="px-3 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-sm shadow-lg shadow-cyan-500/25">
              最新の解析結果を加算
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
