import React, { useEffect, useRef, useState } from "react";

// App.tsxから型定義をインポート
type Category = "愛情" | "切なさ" | "悲しみ" | "甘え" | "欲";

interface Lexeme {
  term: string;
  weight?: number;
  categories?: Category[];
}

type Lexicon = Record<Category, Lexeme[]>;

// Props の型定義
interface LexiconEditorProps {
  lexicon: Lexicon;
  onChange: (next: Lexicon) => void;
  onClose: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
}

export default function LexiconEditor({
  lexicon,
  onChange,
  onClose,
  onImport,
  onReset,
}: LexiconEditorProps) {
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

  useEffect(() => {
    if (showJsonText) {
      const obj = Object.fromEntries(
        categories.map((c) => [c, lexicon[c] ?? []])
      );
      setJsonText(JSON.stringify(obj, null, 2));
    }
  }, [showJsonText, lexicon]);

  const addLexeme = () => {
  const t = term.trim();
  if (!t) {
    alert("語句が空です。入力してください。");
    return;
  }

  // 重み（0.1〜5.0）の範囲をチェック
  const w = Number(weight);
  if (Number.isNaN(w) || w < 0.1 || w > 5.0) {
    alert("重みは 0.1 〜 5.0 の間で入力してください。");
    return;
  }

  // 追加しようとしているカテゴリ集合（複数指定されていればそれを採用）
  const cats = (multiCats && multiCats.length > 0) ? [...new Set(multiCats)] : [tab];

  // 同一タブ内で、同じ語句＋同じカテゴリ構成が既にあるかを確認
  const exists = (lexicon[tab] ?? []).some((x) => {
    const xCats = x.categories && x.categories.length > 0 ? x.categories.slice().sort().join(",") : tab;
    const newCats = (cats.length > 1 ? cats.slice().sort().join(",") : tab);
    return x.term === t && xCats === newCats;
  });
  if (exists) {
    alert("同じ語句（同じカテゴリ構成）がすでに登録されています。");
    return;
  }

  const newLex: Lexeme = { term: t, weight: w };
  if (cats.length > 1) newLex.categories = cats;

  const next: Lexicon = { ...lexicon };
  next[tab] = [...(next[tab] ?? []), newLex];

  onChange(next);
  setTerm("");
  setWeight(1);
};

  const deleteLexeme = (cat: Category, idx: number) => {
    const next = { ...lexicon };
    next[cat] = next[cat].filter((_, i) => i !== idx);
    onChange(next);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onImport(f);
    e.currentTarget.value = "";
  };

  return (
    <div className="fixed inset-0 z-50">
  {/* オーバーレイ */}
  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
  {/* 左上のほのかなグラデ（履歴の雰囲気） */}
  <div className="absolute inset-0 bg-[radial-gradient(100%_100%_at_0%_0%,rgba(255,255,255,0.15),transparent_50%)] pointer-events-none z-[1]" />
  <div className="relative z-20 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative">
       {/* ダイアログ内のグラデーション */}
  <div 
    className="absolute inset-0 pointer-events-none rounded-2xl"
    style={{
      background: 'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.02) 70%, transparent 90%)'
    }}
  />
        <div className="px-5 py-4 flex items-center justify-between bg-slate-950/80 border-b border-white/10">
          <h2 className="text-lg font-semibold">カスタム辞書エディタ</h2>
          <div className="flex items-center gap-2">
            {/* JSONプレビュー */}
            <button
              onClick={() => setShowJsonText((v) => !v)}
              className="px-3 py-1.5 text-sm rounded-lg bg-blue-950/30 border border-white/10 hover:bg-blue-950/45"
            >
              JSONインポート
            </button>
            {/* JSON読み込み */}
            <label className="px-3 py-1.5 text-sm rounded-lg bg-blue-950/30 border border-white/10 hover:bg-blue-950/45 cursor-pointer">
              JSON読み込み
              <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
            </label>
            {/* 初期化（危険） */}
            <button
              onClick={() => {
                const ok = window.confirm("本当に初期化してよろしいですか？\n（登録した辞書は元に戻せません）");
                if (ok) onReset();
              }}
              className="px-3 py-1.5 text-sm rounded-lg bg-rose-800/70 border border-rose-600 hover:bg-rose-700"
            >
              初期化
            </button>

            {/* 閉じる */}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-lg bg-blue-950/30 border border-white/10 hover:bg-blue-950/45"
            >
              閉じる
            </button>
          </div>
        </div>

        {/* JSONプレビュー領域 */}
        {showJsonText && (
          <div className="px-5">
            <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/50 max-h-[40vh] overflow-y-auto">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <div className="text-sm">JSONプレビュー（辞書書き出し）</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const blob = new Blob([jsonText], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "lexicon.json";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-2 py-1 text-xs rounded-md bg-blue-950/30 border border-white/10 hover:bg-blue-950/45"
                  >
                    ダウンロード
                  </button>
                  <button
                    onClick={async () => {
                      try {
                // 新しい方法：クリップボードAPI
                        await navigator.clipboard.writeText(jsonText);
                        alert("コピーしました！");
                      } catch {
                // フォールバック：従来の選択→copy
                        if (jsonTextRef.current) {
                          jsonTextRef.current.select();
                          document.execCommand("copy");
                          alert("お使いの環境では新しいコピー方法が使えませんでした。選択済みですので Ctrl+C でコピーしてください。");
                        }
                      }
                   }}
                   className="px-2 py-1 text-xs rounded-md bg-blue-950/30 border border-white/10 hover:bg-blue-950/45"
                >
                   全選択＆コピー
                </button>

                </div>
              </div>
              <div className="p-3">
                <textarea
                  ref={jsonTextRef}
                  readOnly
                  value={jsonText}
                  className="w-full h-40 bg-slate-950/60 border border-white/10 rounded-xl p-3 text-xs"
                />
                <p className="text-xs text-neutral-400 mt-1">
                  上の内容を選択して手動コピー → メモ帳等に貼り付け、UTF-8 (BOMなし) の .json として保存してください。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* タブ */}
        <div className="px-5 pt-3 flex gap-2 flex-wrap sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-white/10 pb-3">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`px-3 py-1.5 rounded-xl border ${
                tab === c ? "bg-blue-950/40 border-white/10" : "bg-blue-950/20 border-white/10 hover:bg-blue-950/35"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* メインコンテンツ */}
        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 追加フォーム */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-white/10">
            <h3 className="font-semibold mb-3">新規追加</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-neutral-400">語句</label>
                <input
                  type="text"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="例: 愛してる"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 focus:border-blue-400 outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-neutral-400">重み (0.1-5.0)</label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  min={0.1}
                  max={5.0}
                  step={0.1}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 focus:border-blue-400 outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-neutral-400">複数カテゴリ適用</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <label key={c} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={multiCats.includes(c)}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setMultiCats((prev) =>
                            on ? [...new Set([...prev, c])] : prev.filter((x) => x !== c)
                          );
                        }}
                      />
                      <span className="text-sm">{c}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                onClick={addLexeme}
                className="w-full py-2 rounded-lg bg-blue-950/40 hover:bg-blue-950/50 border border-white/10"
              >
                追加
              </button>
            </div>
          </div>

          {/* 辞書リスト */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-white/10">
            <h3 className="font-semibold mb-3">{tab} の辞書 ({lexicon[tab].length}件)</h3>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {lexicon[tab].length === 0 ? (
                <p className="text-neutral-400 text-sm">辞書項目がありません</p>
              ) : (
                lexicon[tab].map((lex, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-950/60 rounded-lg px-3 py-2 border border-white/10"
                  >
                    <div>
                      <span className="font-medium">{lex.term}</span>
                      <span className="ml-2 text-xs text-neutral-400">重み: {lex.weight ?? 1}</span>
                      {lex.categories && lex.categories.length > 1 && (
                        <span className="ml-2 text-xs text-neutral-400">
                          複数: {lex.categories.join(", ")}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteLexeme(tab, idx)}
                      className="px-2 py-1 text-xs rounded-md bg-white/10 hover:bg-red-500/20 border border-white/20 hover:border-red-500/30 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* 下部統計 */}
            <div className="mt-4 bg-slate-950/60 rounded-xl p-3 border border-white/10 text-sm text-neutral-300">
              愛情: {lexicon["愛情"].length}　切なさ: {lexicon["切なさ"].length}　悲しみ: {lexicon["悲しみ"].length}　甘え: {lexicon["甘え"].length}　欲: {lexicon["欲"].length}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
