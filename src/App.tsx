import React, { useEffect, useMemo, useRef, useState } from "react";
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

// ===== 型定義 =====
type Category = "愛情" | "切なさ" | "悲しみ" | "甘え" | "欲";

interface Lexeme {
  term: string; // 解析対象の語
  weight?: number; // 重要度（デフォルト1）
  categories?: Category[]; // 複数カテゴリに寄与する場合
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
  "とても",
  "すごく",
  "めっちゃ",
  "超絶",
  "超",
  "かなり",
  "本当に",
  "ほんとに",
  "めちゃくちゃ",
]; // ×1.5
const DIMINISHERS = ["少し", "ちょっと", "やや", "まあまあ", "すこし"]; // ×0.7
const NEGATIONS = ["じゃない", "ではない", "ない", "ぬ", "ず"];
const EMOJI_BOOST: { [k in Category]: string[] } = {
  愛情: ["❤️", "💕", "😘", "💖", "🥰"],
  切なさ: ["🥺", "🫨"],
  悲しみ: ["😢", "😭"],
  甘え: ["🤲", "🤍"],
  欲: ["🔥", "💦", "😍"],
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

// ===== LocalStorage Util =====
const LEXICON_KEY = "emotion_radar_template_lexicon_v1"; // 個人版と分離
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
  return c * 1.2; // 1絵文字=+1.2相当
}

function analyze(text: string, lexicon: Lexicon, relationBoost = true) {
  const t = text.trim();
  if (!t) {
    return {
      raw: { 愛情: 0, 切なさ: 0, 悲しみ: 0, 甘え: 0, 欲: 0 } as Record<Category, number>,
      normalized: { 愛情: 0, 切なさ: 0, 悲しみ: 0, 甘え: 0, 欲: 0 } as Record<
        Category,
        number
      >,
      details: new Map<Category, Map<string, number>>(),
    };
  }

  const exclamAmp = Math.min(0.5, (t.match(/[!！]/g) || []).length * 0.05);
  const amp = 1 + exclamAmp; // ！が多いほど強度アップ

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

  // 関係ブースト：呼称や関係性ワードを愛情に軽く加点（ON/OFF可）
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

  // 語彙マッチング（UI編集後の lexicon を使用）
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
        if (windowHas(NEGATIONS, right)) factor = 0; // 否定が直後に来たら無効化

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

  // 絵文字補正
  for (const c of categories) {
    raw[c] += baseEmojiBoost(t, c);
  }

  // 長さに応じた小正規化（極端な長文バイアスを緩和）
  const lengthNorm = Math.max(0.7, Math.min(1.0, 180 / Math.max(60, t.length)));
  for (const c of categories) raw[c] *= amp * lengthNorm;

  // 正規化（最大値を100）
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

// ===== UI =====
export default function EmotionRadarTemplateApp() {
  const [text, setText] = useState("");
  const [relationBoost, setRelationBoost] = useState(true);
  const [lexicon, setLexicon] = useState<Lexicon>(DEFAULT_LEXICON);
  const [showEditor, setShowEditor] = useState(false);
  // CSV テキスト表示用
  const [lastCsv, setLastCsv] = useState<string>("");
  const [showCsvContent, setShowCsvContent] = useState<boolean>(false);
  const csvTextRef = useRef<HTMLTextAreaElement | null>(null);
  // 開発テスト結果の表示用
  
  useEffect(() => {
    const loaded = loadLexicon();
    setLexicon(loaded);
  }, []);

  useEffect(() => {
    saveLexicon(lexicon);
  }, [lexicon]);

  const result = useMemo(() => analyze(text, lexicon, relationBoost), [text, lexicon, relationBoost]);

  const radarData = useMemo(() => {
    // Object.entries は TS 的に [string, unknown][] になりやすいので、
    // カテゴリの配列から確実に number を引く形に変更して型エラーを回避
    const cats: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
    return cats.map((cat) => ({ subject: cat, A: Number(result.normalized[cat].toFixed(2)) }));
  }, [result]);

  const topTerms = (cat: Category) => {
    const m = result.details.get(cat);
    if (!m) return [] as Array<[string, number]>;
    // 明示的にタプル型にしてから filter/sort する
    const entries: Array<[string, number]> = Array.from(m.entries());
    const filtered = entries.filter(([k]: [string, number]) => !String(k).startsWith("__"));
    return filtered.sort((a, b) => b[1] - a[1]).slice(0, 6);
  };

  // ライブ行用：現在入力の“同率首位”カテゴリ群
  const catsOrder: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
  const leaders: Category[] = useMemo(() => {
    const src = result.normalized as Record<Category, number>;
    const vals = catsOrder.map((k) => src[k]);
    const max = Math.max(...vals);
    if (!text.trim() || max <= 0) return [];
    const EPS = 0.0001;
    return catsOrder.filter((k) => Math.abs(src[k] - max) <= EPS);
  }, [result, text]);

  // コメント（カテゴリ別・文脈差し込み）
  const commentFor = (cat: Category): string => {
    if (!text.trim()) return "";
    if (!leaders.includes(cat)) return "";
    const score = result.normalized[cat];
    const level = score >= 85 ? "high" : score >= 60 ? "mid" : "soft";
    const pool = COMMENT_BANK[cat][level as "soft" | "mid" | "high"];
    let base = seededPick<string>(pool, text) || "";

    const m = result.details.get(cat);
    if (m && m.size) {
      // 明示的にタプル型にしてから filter/sort する
      const entries: Array<[string, number]> = Array.from(m.entries());
      const filtered = entries.filter(([k]: [string, number]) => !String(k).startsWith("__"));
      const [topTerm, topVal] = (filtered.sort((a, b) => b[1] - a[1])[0] ?? ["", 0]) as [string, number];
      if (topVal > 0.7) {
        const tails: Record<Category, string> = {
          愛情: `主要寄与語:“${topTerm}”`,
          切なさ: `主要寄与語:“${topTerm}”`,
          悲しみ: `主要寄与語:“${topTerm}”`,
          甘え: `主要寄与語:“${topTerm}”`,
          欲: `主要寄与語:“${topTerm}”`,
        };
        base = base ? `${base} ${tails[cat]}` : tails[cat];
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
    (Object.keys(result.raw) as Category[]).forEach((c) => {
      rows.push([c, result.normalized[c].toFixed(1)].join(","));
    });
    const csvBody = rows.filter((line) => line.trim() !== "").join("\n");
    setLastCsv("\uFEFF" + csvBody);
    setShowCsvContent(true);
  };
  const importLexiconJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const cats: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
        for (const c of cats) if (!Array.isArray(parsed[c])) throw new Error("Invalid shape");
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

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 px-6 py-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        <header className="lg:col-span-2 flex items-end justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">感情レーダー（テンプレート版）</h1>
            <div className="mt-1"><span className="inline-flex items-center px-2 py-0.5 rounded-full border border-neutral-700 bg-neutral-800 text-xs">by Reicis</span></div>
            <p className="text-neutral-400 mt-2">テキストから「愛情・切なさ・悲しみ・甘え・欲」を推定し、レーダーチャートで可視化します。ブラウザ内のみで動作（辞書はローカル保存）。</p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadSample} className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700">サンプル</button>
            <button onClick={exportCSV} className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700">CSVエクスポート</button><button onClick={() => setShowEditor(true)} className="px-3 py-2 rounded-xl bg-emerald-700/70 hover:bg-emerald-600 border border-emerald-500">辞書編集</button>
          </div>
        </header>

        {/* テキストでのCSV表示 */}
        {showCsvContent && lastCsv && (
          <div className="lg:col-span-2 -mt-2 mb-2 rounded-xl border border-emerald-700/40 bg-emerald-900/20">
            <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
              <div className="text-sm">CSVプレビュー</div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      if (csvTextRef.current) {
                        csvTextRef.current.focus();
                        csvTextRef.current.select();
                        csvTextRef.current.setSelectionRange(0, lastCsv.length);
                      }
                      if (navigator.clipboard && window.isSecureContext) {
                        await navigator.clipboard.writeText(lastCsv);
                        alert("全選択してコピーしました。");
                      } else {
                        const ok = document.execCommand("copy");
                        alert(ok ? "全選択してコピーしました。" : "コピーに失敗しました。手動で選択してコピーしてください。");
                      }
                    } catch (e) {
                      alert("コピーに失敗しました。手動で選択してコピーしてください。");
                    }
                  }}
                  className="px-2 py-1 text-xs rounded-md bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
                >
                  全選択してコピー
                </button>
                <button
                  onClick={() => setShowCsvContent(false)}
                  className="px-2 py-1 text-xs rounded-md bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
                >
                  閉じる
                </button>
              </div>
            </div>
            <div className="p-3">
              <textarea ref={csvTextRef} readOnly value={lastCsv} className="w-full h-40 bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs" />
              <p className="text-xs text-neutral-400 mt-1">上の内容を選択して手動コピー → メモ帳等に貼り付け、UTF-8(BOM付)で .csv として保存してください。</p>
            </div>
          </div>
        )}

        {/* 左パネル：入力とコントロール */}
        <section className="bg-neutral-900/60 rounded-2xl p-5 border border-neutral-800 shadow-xl">
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-neutral-400">テキスト入力</label>
            <button onClick={resetAll} className="px-2 py-1 text-xs rounded-md bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">リセット</button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="ここにテキストを貼り付けてください。"
            className="w-full h-56 resize-y rounded-2xl bg-neutral-900 border border-neutral-800 focus:border-neutral-600 outline-none p-4 text-base"
          />

          <div className="mt-5 bg-neutral-900 rounded-2xl p-4 border border-neutral-800 flex flex-col gap-2">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={relationBoost} onChange={(e) => setRelationBoost(e.target.checked)} />
              <span className="text-sm">関係ブースト（呼称・関係語で愛情に加点）</span>
            </label>
          </div>

          <div className="mt-5 text-sm text-neutral-400 leading-relaxed">
            <p>※ 簡易ロジック：辞書マッチ＋強弱表現（とても/ちょっと 等）＋否定（〜じゃない 等）＋絵文字補正。文末の「！」は強度を微増。</p>
            <p>※ 長文バイアス緩和のため、テキスト長に応じた軽い正規化を行います。</p>
          </div>
        </section>

        {/* 右パネル：レーダーチャートと内訳 */}
        <section className="bg-neutral-900/60 rounded-2xl p-5 border border-neutral-800 shadow-xl flex flex-col">
          {activeComments.length > 0 && (
            <div className="mb-4 space-y-3">
              {activeComments.map(({ cat, text: msg }) => (
                <div key={cat} className="rounded-2xl border border-emerald-600/60 bg-emerald-900/20 p-4">
                  <div className="text-emerald-300 text-sm">
                    コメント <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/60 bg-emerald-900/30 text-emerald-300">{cat}</span>
                  </div>
                  <p className="mt-1 leading-relaxed">{msg}</p>
                </div>
              ))}
            </div>
          )}
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius={120}>
                <PolarGrid stroke="#3f3f46" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#d4d4d8", fontSize: 12 }} />
                <PolarRadiusAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} angle={30} domain={[0, 100]} />
                <Radar name="Normalized(%)" dataKey="A" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.4} />
                <Legend wrapperStyle={{ color: "#e4e4e7" }} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", color: "#e4e4e7" }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {( ["愛情", "切なさ", "悲しみ", "甘え", "欲"] as Category[] ).map((c) => (
              <div key={c} className={`rounded-2xl bg-neutral-900 border p-4 ${leaders.includes(c) ? 'border-emerald-500 ring-1 ring-emerald-500/30' : 'border-neutral-800'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><h3 className="font-semibold">{c}</h3>{leaders.includes(c) && (<span className="ml-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/60 bg-emerald-900/30 text-emerald-300">{leaders.length > 1 ? '同率首位' : '首位'}</span>)}</div>
                  <div className="text-xs text-neutral-400">Norm: {result.normalized[c].toFixed(1)}%</div>
                </div>
                <ul className="text-sm text-neutral-300 space-y-1">
                  {topTerms(c).length === 0 && <li className="text-neutral-500">主要寄与語なし</li>}
                  {topTerms(c).map(([term, val]) => (
                    <li key={term} className="flex items-center justify-between">
                      <span className="truncate">{term}</span>
                      <span className="tabular-nums text-neutral-400">+{val.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <footer className="lg:col-span-2 text-neutral-400 text-sm mt-2">
          <p>
            本テンプレートは創作・自己観察向けの試作です。結果は参考指標であり、医療・心理診断の代替ではありません。入力はブラウザ内で処理され、辞書は端末ローカルに保存されます。
          </p>
          <p className="mt-1 text-xs text-neutral-400">作成：Reicis（レイシス） © {COPYRIGHT_YEAR}</p>
          <p className="mt-1 text-xs text-neutral-300">利用条件：個人利用のみ／自作発言・二次配布・販売・改変は禁止。リンク共有はOK。</p>
        </footer>
      </div>
      {/* ===== Lexicon Editor Overlay ===== */}
      {showEditor && (
        <LexiconEditor
          lexicon={lexicon}
          onClose={() => setShowEditor(false)}
          onChange={setLexicon}          onImport={importLexiconJSON}
          onReset={() => {
            setLexicon(DEFAULT_LEXICON);
            resetLexicon();
          }}
        />
      )}
    </div>
  );
}

// ===== Lexicon Editor Component =====
function LexiconEditor({
  lexicon,
  onChange,
  onClose,
    onImport,
  onReset,
}: {
  lexicon: Lexicon;
  onChange: (l: Lexicon) => void;
  onClose: () => void;
  onImport: (f: File) => void;
  onReset: () => void;
}) {
  const categories: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
  const [tab, setTab] = useState<Category>("愛情");
  const [term, setTerm] = useState("");
  const [weight, setWeight] = useState(1.0);
  const [multiCats, setMultiCats] = useState<Category[]>([tab]);
  const [showJsonText, setShowJsonText] = useState(false);
  const [jsonText, setJsonText] = useState<string>("");
  const jsonTextRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setMultiCats([tab]);
  }, [tab]);

  const addLexeme = () => {
    const t = term.trim();
    if (!t) return;
    const w = Number(weight) || 1;

    const targets: Category[] = multiCats && multiCats.length > 0 ? multiCats : [tab];
    const next = { ...lexicon } as Lexicon;
    targets.forEach((cat) => {
      next[cat] = [...next[cat], { term: t, weight: w }];
    });

    onChange(next);
    setTerm("");
    setWeight(1.0);
    setMultiCats([tab]);
  };

  const deleteLexeme = (cat: Category, idx: number) => {
    const next = { ...lexicon } as Lexicon;
    next[cat] = next[cat].filter((_, i) => i !== idx);
    onChange(next);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onImport(f);
    e.currentTarget.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between bg-neutral-900/80 border-b border-neutral-800">
          <h2 className="text-lg font-semibold">カスタム辞書エディタ</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => { setJsonText(JSON.stringify(lexicon, null, 2)); setShowJsonText(v => !v); }} className="px-3 py-1.5 text-sm rounded-lg bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">{showJsonText ? "JSONプレビューを閉じる" : "JSONプレビュー"}</button>
            <label className="px-3 py-1.5 text-sm rounded-lg bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 cursor-pointer">
              JSON読み込み
              <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
            </label>
            <button onClick={onReset} className="px-3 py-1.5 text-sm rounded-lg bg-rose-800/70 border border-rose-600 hover:bg-rose-700">初期化</button>
            <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg bg-neutral-700 hover:bg-neutral-600">閉じる</button>
          </div>
        </div>

        {/* JSONプレビュー（書き出し） */}
        {showJsonText && (
          <div className="px-5">
            <div className="mt-3 rounded-xl border border-emerald-700/40 bg-emerald-900/20 max-h-[40vh] overflow-y-auto">
              <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
                <div className="text-sm">JSONプレビュー（辞書書き出し）</div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        if (jsonTextRef.current) {
                          jsonTextRef.current.focus();
                          jsonTextRef.current.select();
                          jsonTextRef.current.setSelectionRange(0, jsonText.length);
                        }
                        if (navigator.clipboard && window.isSecureContext) {
                          await navigator.clipboard.writeText(jsonText);
                          alert("全選択してコピーしました。");
                        } else {
                          const ok = document.execCommand("copy");
                          alert(ok ? "全選択してコピーしました。" : "コピーに失敗しました。手動で選択してコピーしてください。");
                        }
                      } catch (e) {
                        alert("コピーに失敗しました。手動で選択してコピーしてください。");
                      }
                    }}
                    className="px-2 py-1 text-xs rounded-md bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
                  >
                    全選択してコピー
                  </button>
                  <button
                    onClick={() => setShowJsonText(false)}
                    className="px-2 py-1 text-xs rounded-md bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
                  >
                    閉じる
                  </button>
                </div>
              </div>
              <div className="p-3">
                <textarea ref={jsonTextRef} readOnly value={jsonText} className="w-full h-40 bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs" />
                <p className="text-xs text-neutral-400 mt-1">上の内容を選択して手動コピー → メモ帳等に貼り付け、UTF-8 (BOMなし) の .json として保存してください。</p>
              </div>
            </div>
          </div>
        )}

        {/* タブ */}
        <div className="px-5 pt-3 flex gap-2 flex-wrap sticky top-0 z-10 bg-neutral-900/95 backdrop-blur border-b border-neutral-800">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`px-3 py-1.5 rounded-xl border ${
                tab === c ? "bg-emerald-700/70 border-emerald-500" : "bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* 追加フォーム */}
        <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-neutral-800">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">語（term）</label>
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none"
              placeholder="例：ぎゅ、誓う、会いたい など"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">重み（weight）</label>
            <input
              type="number"
              step={0.1}
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value))}
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none"
              placeholder="1.0"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">寄与カテゴリ（複数可・未指定ならタブのカテゴリ）</label>
            <div className="flex flex-wrap gap-2">
              {(categories as Category[]).map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={multiCats.includes(c)}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setMultiCats((prev) => (on ? Array.from(new Set([...prev, c])) : prev.filter((x) => x !== c)));
                    }}
                  />
                  <span>{c}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button onClick={addLexeme} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400">追加</button>
          </div>
        </div>

        {/* 一覧 */}
        <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto">
          {categories.map((c) => (
            <div key={c} className="rounded-2xl border border-neutral-800 bg-neutral-900/80">
              <div className="px-4 py-2 flex items-center justify-between border-b border-neutral-800">
                <h3 className="font-semibold">{c}</h3>
                <span className="text-xs text-neutral-400">{lexicon[c].length} 語</span>
              </div>
              <ul className="divide-y divide-neutral-800">
                {lexicon[c].length === 0 && <li className="px-4 py-3 text-neutral-500">語彙なし</li>}
                {lexicon[c].map((lx, idx) => (
                  <li key={`${lx.term}-${idx}`} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{lx.term}</div>
                      <div className="text-xs text-neutral-400">
                        w:{(lx.weight ?? 1).toFixed(1)}
                        {lx.categories && lx.categories.length ? ` / cats:${lx.categories.join("・")}` : ""}
                      </div>
                    </div>
                    <button onClick={() => deleteLexeme(c, idx)} className="px-2 py-1 text-xs rounded-lg bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">削除</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
