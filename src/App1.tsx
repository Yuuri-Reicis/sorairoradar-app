import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

// ===== メタ情報 =====
const COPYRIGHT_YEAR = 2025 as const;
const APP_VERSION = "1.0.1";

// ===== 型定義 =====
type Category = "愛情" | "切なさ" | "悲しみ" | "甘え" | "欲";

interface Lexeme {
  term: string;
  weight?: number;
  categories?: Category[];
}

type Lexicon = Record<Category, Lexeme[]>;

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

// サンプル文（安全・一般的）
const SAMPLE = `
少し不安だけど、それでも前に進みたい。会いたい気持ちはあるし、
大切に思っていることは変わらない。もう少しだけそばにいてほしい。`;

// ===== コメント（テンプレート） =====
const COMMENT_BANK: Record<Category, { soft: string[]; mid: string[]; high: string[] }> = {
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

// ===== ユーティリティ関数 =====
function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    h = ((h << 5) - h + code) | 0;
  }
  return Math.abs(h);
}

function seededPick<T>(arr: T[], seed: string): T {
  if (!arr || arr.length === 0) return undefined as unknown as T;
  const n = simpleHash(seed) % arr.length;
  return arr[n];
}

// ===== LocalStorage Util =====
const LEXICON_KEY = "emotion_radar_template_lexicon_v1";
const HISTORY_KEY = "emotion_radar_history_v1";
const HISTORY_MAX_DEFAULT = 500;

function loadLexicon(): Lexicon {
  try {
    const raw = localStorage.getItem(LEXICON_KEY);
    if (!raw) return DEFAULT_LEXICON;
    const parsed = JSON.parse(raw) as Lexicon;
    const cats: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
    for (const c of cats) {
      if (!Array.isArray(parsed[c])) return DEFAULT_LEXICON;
    }
    return parsed;
  } catch {
    return DEFAULT_LEXICON;
  }
}

function saveLexicon(lex: Lexicon) {
  try {
    localStorage.setItem(LEXICON_KEY, JSON.stringify(lex));
  } catch (e) {
    console.error("Failed to save lexicon:", e);
  }
}

function resetLexicon() {
  localStorage.removeItem(LEXICON_KEY);
}

// ===== 解析ユーティリティ =====
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
    if (bonus) {
      const map = details.get("愛情")!;
      map.set("__RELATION_META__", (map.get("__RELATION_META__") || 0) + bonus);
    }
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

// ===== 履歴ユーティリティ =====
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
  try {
    return simpleHash(s).toString(36);
  } catch {
    return "0";
  }
}

function hashLexicon(lex: Lexicon): string {
  try {
    return hashBase36(JSON.stringify(lex));
  } catch {
    return "0";
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function makeHistItem(
  text: string,
  analysis: ReturnType<typeof analyze>,
  leaders: Category[],
  lexicon: Lexicon
): HistItem {
  const clean = text.trim();
  const full = clean.slice(0, 1000);
  const snip = clean.slice(0, 120);
  const norm = CATS_FOR_HISTORY.map((c) => round1(analysis.normalized[c])) as NormTuple;

  const top = CATS_FOR_HISTORY.reduce((acc, c) => {
    const m = analysis.details.get(c);
    const arr: Array<[string, number]> = m
      ? Array.from(m.entries())
          .filter(([k]) => !String(k).startsWith("__"))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([term, val]) => [term, round1(val)])
      : [];
    acc[c] = arr;
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
  } catch {
    return [];
  }
}

function saveHistory(items: HistItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Failed to save history:", e);
  }
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

// 改善版：全履歴をチェック
function appendWithLimit(
  existing: HistItem[],
  draft: HistItem,
  max = HISTORY_MAX_DEFAULT,
  hashSet: Set<string>
): HistItem[] {
  const h = hashBase36(draft.full);
  
  // 全履歴でのハッシュチェック
  if (hashSet.has(h)) return existing;
  
  hashSet.add(h);
  const next = [...existing, draft];
  
  // 上限超過時は古い非ピンを削除
  while (next.length > max) {
    const idx = next.findIndex((it) => !it.pinned);
    if (idx === -1) break;
    const removed = next.splice(idx, 1)[0];
    // ハッシュセットからも削除
    hashSet.delete(hashBase36(removed.full));
  }
  return next;
}

// ===== メインコンポーネント =====
export default function EmotionRadarTemplateApp() {
  const [text, setText] = useState("");
  const [relationBoost, setRelationBoost] = useState(true);
  const [lexicon, setLexicon] = useState<Lexicon>(DEFAULT_LEXICON);
  const [showEditor, setShowEditor] = useState(false);
  const [lastCsv, setLastCsv] = useState<string>("");
  const [showCsvContent, setShowCsvContent] = useState<boolean>(false);
  const csvTextRef = useRef<HTMLTextAreaElement | null>(null);
  const [history, setHistory] = useState<HistItem[]>([]);
  const lastSavedHashRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyHashSet = useRef<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [showHistExport, setShowHistExport] = useState(false);
  const [histExportText, setHistExportText] = useState<string>("");
  const histExportRef = useRef<HTMLTextAreaElement | null>(null);

  // 初期化
  useEffect(() => {
    const loaded = loadLexicon();
    setLexicon(loaded);
  }, []);

  useEffect(() => {
    saveLexicon(lexicon);
  }, [lexicon]);

  useEffect(() => {
    const h = loadHistory();
    setHistory(h);
    // ハッシュセットの初期化
    historyHashSet.current = new Set(h.map(item => hashBase36(item.full)));
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

  // 履歴保存
  const commitHistory = useCallback(
    (reason: "debounce" | "blur") => {
      const clean = text.trim();
      if (!clean) return;
      const full = clean.slice(0, 1000);
      const h = hashBase36(full);
      if (lastSavedHashRef.current === h) return;

      const localResult = analyze(clean, lexicon, relationBoost);
      const catsOrder: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
      const src = localResult.normalized;
      const vals = catsOrder.map((k) => src[k]);
      const max = Math.max(...vals);
      const localLeaders: Category[] =
        max <= 0 ? [] : catsOrder.filter((k) => Math.abs(src[k] - max) <= 0.0001);

      const item = makeHistItem(clean, localResult, localLeaders, lexicon);
      const next = appendWithLimit(history, item, HISTORY_MAX_DEFAULT, historyHashSet.current);
      if (next !== history) {
        setHistory(next);
        saveHistory(next);
        lastSavedHashRef.current = h;
      }
    },
    [text, lexicon, relationBoost, history]
  );

  const result = useMemo(() => analyze(text, lexicon, relationBoost), [text, lexicon, relationBoost]);

  const radarData = useMemo(() => {
    const cats: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
    return cats.map((cat) => ({
      subject: cat,
      A: Number(result.normalized[cat].toFixed(2)),
    }));
  }, [result]);

  const topTerms = (cat: Category) => {
    const m = result.details.get(cat);
    if (!m) return [];
    const entries = Array.from(m.entries());
    const filtered = entries.filter(([k]) => !String(k).startsWith("__"));
    return filtered.sort((a, b) => b[1] - a[1]).slice(0, 6);
  };

  const catsOrder: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
  const leaders: Category[] = useMemo(() => {
    const src = result.normalized;
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
    const level = score >= 85 ? "high" : score >= 60 ? "mid" : "soft";
    const pool = COMMENT_BANK[cat][level];
    let base = seededPick<string>(pool, text) || "";

    const m = result.details.get(cat);
    if (m && m.size) {
      const entries = Array.from(m.entries());
      const filtered = entries.filter(([k]) => !String(k).startsWith("__"));
      const sorted = filtered.sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        const [topTerm, topVal] = sorted[0];
        if (topVal > 0.7) {
          const tails: Record<Category, string> = {
            愛情: `主要寄与語："${topTerm}"`,
            切なさ: `主要寄与語："${topTerm}"`,
            悲しみ: `主要寄与語："${topTerm}"`,
            甘え: `主要寄与語："${topTerm}"`,
            欲: `主要寄与語："${topTerm}"`,
          };
          base = base ? `${base} ${tails[cat]}` : tails[cat];
        }
      }
    }
    return base;
  };

  const activeComments = useMemo(
    () => leaders.map((c) => ({ cat: c, text: commentFor(c) })).filter((x) => x.text),
    [leaders, text, result]
  );

  const exportCSV = () => {
    const rows: string[] = [];
    rows.push(["カテゴリ", "Normalized(%)"].join(","));
    catsOrder.forEach((cat) => {
      rows.push([cat, result.normalized[cat].toFixed(2)].join(","));
    });
    const csvBody = rows.join("\n");
    setLastCsv("\uFEFF" + csvBody); // 正しいBOM
    setShowCsvContent(true);
  };

  const importLexiconJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const cats: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
        for (const c of cats) {
          if (!Array.isArray(parsed[c])) throw new Error("Invalid shape");
        }
        setLexicon(parsed as Lexicon);
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
      const next = prev.filter((it) => it.id !== id);
      // ハッシュセットからも削除
      const deleted = prev.find(it => it.id === id);
      if (deleted) {
        historyHashSet.current.delete(hashBase36(deleted.full));
      }
      saveHistory(next);
      return next;
    });
  }, []);

  const clearAllHistory = useCallback(() => {
    if (!window.confirm("履歴をすべて削除します。よろしいですか？")) return;
    saveHistory([]);
    setHistory([]);
    historyHashSet.current.clear();
    lastSavedHashRef.current = null;
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
        const ok = parsed.every(
          (x) => x && typeof x.id === "string" && typeof x.ts === "string" && typeof x.full === "string"
        );
        if (!ok) throw new Error("shape");
        setHistory(parsed as HistItem[]);
        saveHistory(parsed as HistItem[]);
        // ハッシュセットも再構築
        historyHashSet.current = new Set(parsed.map(item => hashBase36(item.full)));
      } catch {
        alert("読み込みに失敗しました。JSON形式を確認してください。");
      }
    };
    reader.readAsText(f);
  }, [])