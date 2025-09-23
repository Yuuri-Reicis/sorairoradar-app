import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

import { BarChart3, Sparkles, Copy, X, Download, Upload, ImagePlus, Trash2, Edit3, HelpCircle } from "lucide-react";

/** App.tsx と同じ定義に合わせる */
type Category = "愛情" | "切なさ" | "悲しみ" | "甘え" | "欲";
type GrowthStats = Record<Category, number>;

/** 保存データ */
type PetSave = {
  stats: GrowthStats;
  total: number;
  version: number;
  /** 進化枝（ティーン/アダルトで分岐。未設定なら undefined） */
  forms?: { teen?: Category; adult?: Category };
};

const PET_KEY = "emotion_pet_v1";

const DEFAULT_SAVE: PetSave = {
  stats: { 愛情: 0, 切なさ: 0, 悲しみ: 0, 甘え: 0, 欲: 0 },
  total: 0,
  version: 1,
  forms: {},
};


// ▼ 同じごはん防止用のログ（直近の解析キーを記録）
const FEED_LOG_KEY = "emotion_pet_feed_log_v1";
const FEED_LOG_MAX = 50;

// ▼ 成長段階ごとの画像保存キー
const PET_IMAGES_KEY = "emotion_pet_images_v1";

// ▼ 進化枝（teen/adult × カテゴリ）専用画像の保存キー
const PET_BRANCH_IMAGES_KEY = "emotion_pet_branch_images_v1";

// ▼ 背景画像の保存キー（全ステージ共通）
const PET_BG_KEY = "emotion_pet_bg_v1";

// ▼ 画像の拡大率・位置の保存キー（ステージごと）
const PET_IMAGE_TF_KEY = "emotion_pet_image_tf_v1";

// ▼ キャラの“ふわふわ”アニメON/OFF保存キー
const PET_IMAGE_ANIM_KEY = "emotion_pet_image_anim_v1";

// ▼ 台詞カスタマイズの保存キー
const PET_LINES_KEY = "emotion_pet_lines_v1";

// 解析結果を「比較しやすいキー」にする（小数1桁で丸めて5項目を連結）
function makeResultKey(latest: Record<Category, number> | null): string | null {
  if (!latest) return null;
  const cats: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
  const arr = cats.map(c => Math.round(((latest[c] ?? 0) * 10))); // 例：72.3 → 723
  return arr.join("|"); // 例："723|510|101|65|0"
}

// ロード/セーブ
function loadFeedLog(): string[] {
  try {
    const raw = localStorage.getItem(FEED_LOG_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
function saveFeedLog(v: string[]) {
  localStorage.setItem(FEED_LOG_KEY, JSON.stringify(v));
}


function loadPet(): PetSave {
  try {
    const raw = localStorage.getItem(PET_KEY);
    return raw ? (JSON.parse(raw) as PetSave) : DEFAULT_SAVE;
  } catch {
    return DEFAULT_SAVE;
  }
}
function savePet(v: PetSave) {
  localStorage.setItem(PET_KEY, JSON.stringify(v));
}

// 画像ファイルを「ほどよい大きさのPNGデータURL」に変換する
async function fileToPngDataURL(file: File, maxSide: number): Promise<string> {
  // 画像を <img> に読み込む
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("画像の読み込みに失敗"));
      i.src = url;
    });

    // 短辺・長辺の比率を保ったまま、最大辺を maxSide にする
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    // PNG で吐き出す（常に data:image/png;base64,... 形式になる）
    return canvas.toDataURL("image/png");
    } finally {
    URL.revokeObjectURL(url);
  }
}

export default function TamagotchiPanel({
  latest,
  onClose,
}: {
  latest: Record<Category, number> | null;
  onClose: () => void;
}) {
  const cats: Category[] = ["愛情", "切なさ", "悲しみ", "甘え", "欲"];
  const [pet, setPet] = useState<PetSave>(() => loadPet());
  useEffect(() => savePet(pet), [pet]);

// ▼ 同じごはん防止ログ
const [feedLog, setFeedLog] = useState<string[]>(() => loadFeedLog());
useEffect(() => saveFeedLog(feedLog), [feedLog]);


  // ▼ トースト（お知らせ）用
const [toastMsg, setToastMsg] = useState<string | null>(null);
const toastTimerRef = useRef<number | null>(null);
const lastLineRef = useRef<string | null>(null);

const [toastKind, setToastKind] = useState<"info" | "error">("info");
const [imageErrorMsg, setImageErrorMsg] = useState<string | null>(null);

// ▼ ここから追記：バックアップ窓
const [showBackup, setShowBackup] = useState(false);
const [backupText, setBackupText] = useState<string>("");
const backupRef = useRef<HTMLTextAreaElement | null>(null);
const [showImageConfig, setShowImageConfig] = useState(false);
const [showLinesConfig, setShowLinesConfig] = useState(false);

// ▼ ヘッダーのミニヘルプ（？）
const [showHeaderHelp, setShowHeaderHelp] = useState(false);

// ▼ ドラッグ移動（ウィンドウ位置）※ヘルプ追従で参照するため先に宣言
const [drag, setDrag] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

// ▼ ヘルプの表示位置（モーダル右側にドッキング）
const [helpPos, setHelpPos] = useState<{ left: number; top: number } | null>(null);
const updateHelpPos = useCallback(() => {
  const rect = panelRef.current?.getBoundingClientRect();
  if (!rect) return;
    const GAP = 16;     // モーダル右端とのすき間
  const WIDTH = 360;  // ヘルプの横幅（存在感UP版に合わせる）
  const left = Math.min(rect.right + GAP, window.innerWidth - WIDTH - 8);
  const top = rect.top + 56; // ヘッダーの下あたり
  setHelpPos({ left, top });
}, []);
useEffect(() => {
  if (!showHeaderHelp) return;
  updateHelpPos();
  const onWin = () => updateHelpPos();
  window.addEventListener("resize", onWin);
  window.addEventListener("scroll", onWin);
  return () => {
    window.removeEventListener("resize", onWin);
    window.removeEventListener("scroll", onWin);
  };
}, [showHeaderHelp, drag, updateHelpPos]);

// ▼ ドラッグ移動（ウィンドウ位置）
const draggingRef = useRef(false);
const dragStartRef = useRef<{ mx: number; my: number }>({ mx: 0, my: 0 });

// ▼ レベルアップ演出（1.2秒だけ表示）
const [levelFxAt, setLevelFxAt] = useState<number | null>(null);
useEffect(() => {
  if (!levelFxAt) return;
  const t = setTimeout(() => setLevelFxAt(null), 1200);
  return () => clearTimeout(t);
}, [levelFxAt]);

const dragOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
const dragBoundsRef = useRef<{ minX: number; maxX: number; minY: number; maxY: number }>({ minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity });
const panelRef = useRef<HTMLElement | null>(null);
const onDragStart = (e: React.MouseEvent) => {
  // ボタンや入力をドラッグ開始にしない
  const el = e.target as HTMLElement;
  if (el.closest("button,select,input,textarea")) return;
  draggingRef.current = true;
  dragStartRef.current = { mx: e.clientX, my: e.clientY };
  dragOriginRef.current = { ...drag };
  // 画面外に飛び出しすぎないように境界を計算
  const rect = panelRef.current?.getBoundingClientRect();
  if (rect) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const margin = 8;
    dragBoundsRef.current = {
      minX: -rect.left + margin,
      maxX: vw - rect.right - margin,
      minY: -rect.top + margin,
      maxY: vh - rect.bottom - margin,
    };
  }
  document.body.style.userSelect = "none";
  document.body.style.cursor = "grabbing";
};
useEffect(() => {
  const onMove = (ev: MouseEvent) => {
    if (!draggingRef.current) return;
    const dx = ev.clientX - dragStartRef.current.mx;
    const dy = ev.clientY - dragStartRef.current.my;
    const nextX = dragOriginRef.current.x + dx;
    const nextY = dragOriginRef.current.y + dy;
    const b = dragBoundsRef.current;
    setDrag({ x: Math.min(b.maxX, Math.max(b.minX, nextX)), y: Math.min(b.maxY, Math.max(b.minY, nextY)) });
  };
  const onUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  return () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
}, []);

// 進化枝画像の編集用セレクタ（UI用）
const [branchEditStage, setBranchEditStage] = useState<BranchStage>("teen");
const [branchEditCat, setBranchEditCat] = useState<Category>("愛情");


// バックアップ窓を開く（保存データをJSONで表示）
const openBackup = () => {

  try {
    const raw = localStorage.getItem(PET_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      setBackupText(JSON.stringify(obj, null, 2));
    } else {
      setBackupText(JSON.stringify({ message: "まだセーブデータがありません。" }, null, 2));
    }
  } catch {
    setBackupText(JSON.stringify({ error: "データの読み込みに失敗しました。" }, null, 2));
  }
  setShowBackup(true);
};

// ▼ 追記：インポート（復元）用の状態
const [importText, setImportText] = useState<string>("");
const importRef = useRef<HTMLTextAreaElement | null>(null);

// ▼ 追記：ファイルから読み込む
const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
  const f = e.target.files?.[0];
  e.currentTarget.value = "";
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const txt = String(reader.result ?? "");
      // そのまま貼り付け欄に入れる（ユーザーが中身を確認できるように）
      setImportText(txt);
    } catch {
      alert("ファイルの読み込みに失敗しました。");
    }
  };
  reader.readAsText(f);
};

// ▼ 追記：貼り付け/読み込み済みテキストを検証して復元
const applyImport = () => {
  const txt = importText.trim();
  if (!txt) {
    alert("復元するJSONを貼り付けてください。");
    return;
  }
  let obj: any;
  try {
    obj = JSON.parse(txt);
  } catch {
    alert("JSONの形式が正しくありません。");
    return;
  }

  // 最低限の形だけチェック（stats と total があればOK）
  if (!obj || typeof obj !== "object") {
    alert("JSONオブジェクトではありません。");
    return;
  }
  if (!obj.stats || typeof obj.stats !== "object") {
    if (!window.confirm("stats が見つかりません。このまま保存してもよろしいですか？")) return;
  }

  // --- 正規化（欠けている値を補完／数値化／合計合わせ）---
  const cats: Category[] = ["愛情","切なさ","悲しみ","甘え","欲"];
    const normalized: PetSave = {
    stats: {
      愛情: Math.max(0, Math.round(Number(obj?.stats?.["愛情"] ?? 0))),
      切なさ: Math.max(0, Math.round(Number(obj?.stats?.["切なさ"] ?? 0))),
      悲しみ: Math.max(0, Math.round(Number(obj?.stats?.["悲しみ"] ?? 0))),
      甘え: Math.max(0, Math.round(Number(obj?.stats?.["甘え"] ?? 0))),
      欲: Math.max(0, Math.round(Number(obj?.stats?.["欲"] ?? 0))),
    },
    total: 0, // いったん0にして下で合計し直す
    // 文字列 "1.0.0" のような場合もあるので、数値にできなければ 1
    version: Number(obj?.version) || 1,
    forms: (obj?.forms && typeof obj.forms === "object")
      ? { teen: obj.forms?.teen as Category | undefined, adult: obj.forms?.adult as Category | undefined }
      : {},
  };

  const sum = cats.reduce((acc, c) => acc + (normalized.stats[c] ?? 0), 0);
  normalized.total = sum;

  if (!window.confirm("インポートした内容で現在の育成データを上書きします。よろしいですか？")) return;

  try {
    // 保存
    localStorage.setItem(PET_KEY, JSON.stringify(normalized));
    // ★ 画面の状態も更新（ここがポイント）
    setPet(normalized);

    // 窓の表示内容も新データに合わせる
    setBackupText(JSON.stringify(normalized, null, 2));

    setToastMsg("インポート（復元）が完了しました");
    setTimeout(() => setToastMsg(null), 2500);
  } catch {
    alert("インポートに失敗しました。");
  }
};



// ▼ エクスポート（.jsonをダウンロード）
const downloadBackup = () => {
  try {
    // セーブが無ければ初期値で出す
    const raw = localStorage.getItem(PET_KEY) ?? JSON.stringify(DEFAULT_SAVE);
    const obj = JSON.parse(raw);

    // あると便利な付帯情報
    const out = {
      app: "宙色レーダー育成",
      savedAt: new Date().toISOString(),
      ...obj,
    };

    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `emotion_pet_backup_${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    alert("エクスポートに失敗しました。");
  }
};


  // 合計100ptごとにLv+1（目安）
  const level = Math.floor(pet.total / 100) + 1;
  const lastLevelRef = useRef<number>(level);

// ▼ セリフ解禁のしきい値（Lv1で1本、Lv2で2本、Lv4で3本 解禁の例）
const UNLOCK_LEVELS = [1, 2, 4] as const;
const unlockedCount = (lv: number) => UNLOCK_LEVELS.filter(t => lv >= t).length;


  // ▼ レベルUPしたらトーストを出す
  useEffect(() => {
  const prev = lastLevelRef.current;
  const curr = level;
  if (curr > prev) {
    const prevUnlocked = unlockedCount(prev);
    const currUnlocked = unlockedCount(curr);
    const extra = currUnlocked > prevUnlocked ? " 新しいセリフが解禁されたよ！" : "";

    setToastKind("info");
setToastMsg(`レベルが ${prev} → ${curr} に上がったよ！${extra}`);
if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3000);

  }
  lastLevelRef.current = curr;
}, [level]);


// アンマウント時にタイマー片付け
useEffect(() => {
  return () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  };
}, []);


  // ▼追加：成長段階
  type Stage = "egg" | "child" | "teen" | "adult";
  const stage: Stage =
    level < 3 ? "egg" :
    level < 6 ? "child" :
    level < 10 ? "teen" : "adult";

  const STAGE_LABEL: Record<Stage, string> = {
    egg: "たまご",
    child: "幼年期",
    teen: "成長期",
    adult: "成熟期",
  };
    const STAGE_EMOJI: Record<Stage, string> = {
    egg: "🥚",
    child: "🐣",
    teen: "🐥",
    adult: "🕊️",
  };

  // ▼ 感情トップの算出（最新があれば最新、無ければ累積）
  const topBy = (s: Record<Category, number>) => cats.reduce((a, b) => (s[a] >= s[b] ? a : b));
  const topCat: Category = latest ? topBy(latest) : topBy(pet.stats);

  // ▼ 進化枝の記録（ステージが変わった瞬間に固定化）
  const lastStageRef = useRef<Stage>(stage);
  useEffect(() => {
    const prev = lastStageRef.current;
    if (stage !== prev) {
      if (stage === "teen" && !(pet.forms?.teen)) {
        setPet(p => ({ ...p, forms: { ...(p.forms ?? {}), teen: topCat } }));
      }
      if (stage === "adult" && !(pet.forms?.adult)) {
        setPet(p => ({ ...p, forms: { ...(p.forms ?? {}), adult: topCat } }));
      }
      lastStageRef.current = stage;
    }
  }, [stage, topCat]);

  // ▼ 台詞設定モーダル用の編集ステート
  const [editCat, setEditCat] = useState<Category>("愛情"); // 初期値は固定。開く時に topCat を反映する
  const [editStage, setEditStage] = useState<Stage>(stage);
  const [editText, setEditText] = useState<string>("");

  const openLinesConfig = () => {
    setEditCat(topCat);
    setEditStage(stage);

    const arr = (lines[topCat]?.[stage] ?? DEFAULT_LINES[topCat][stage]) || [];
    setEditText(arr.join("\n"));
    setShowLinesConfig(true);
  };

  // ▼ 初期画像（ゆうり作）※ ファイルは public/pet/ に置いてね
  // 例）public/pet/bg.jpg, egg.png, child.png, teen.png, adult.png
  const DEFAULT_BG: string | null = "/pet/bg.jpg"; // 背景の初期画像（なければ null に）
  const DEFAULT_IMAGES: Record<Stage, string | null> = {
  egg:  "/pet/egg.png",
  child:"/pet/child.png",
  teen: "/pet/teen.png",
  adult:"/pet/adult.png",
};

// ▼ 画像の基準オフセット（少し左へ寄せる）
type Offset = { x: number; y: number };
const BASE_OFFSET: Record<Stage, Offset> = {
  egg:  { x: -40, y: 0 },   // 卵は大きいので強めに左
  child:{ x: -20, y: 0 },
  teen: { x: -12, y: 0 },
  adult:{ x:  -8, y: 0 },
};

    // ▼ 成長段階ごとの画像設定
  type PetImages = Record<Stage, string | null>;

  // ▼ 進化枝（teen/adult × カテゴリ）専用画像
  type BranchStage = "teen" | "adult";
  type BranchImages = Record<BranchStage, Partial<Record<Category, string | null>>>;

  const [images, setImages] = useState<PetImages>(() => {
    try {
      const raw = localStorage.getItem(PET_IMAGES_KEY);
      return raw ? (JSON.parse(raw) as PetImages) : { egg: null, child: null, teen: null, adult: null };
    } catch {
      return { egg: null, child: null, teen: null, adult: null };
    }
  });
  const lastSavedImagesRef = useRef<PetImages>(images);

  useEffect(() => {
    try {
      localStorage.setItem(PET_IMAGES_KEY, JSON.stringify(images));
      lastSavedImagesRef.current = images; // 正常保存できた時だけ更新
    } catch (e) {
  console.error(e);
  // ★エラートースト（自動では消さない）
  setToastKind("error");
  setToastMsg("キャラ画像の保存に失敗：容量オーバーの可能性があります");

  // ★画像設定モーダルを開き、上部に説明バナーも出す
  setShowImageConfig(true);
  setImageErrorMsg("画像が大きすぎて保存できませんでした。長辺を小さくするか、より軽い画像でお試しください。直前の状態に戻しました。");

  // 失敗したら直前の状態に戻す（白画面防止）
  setImages(lastSavedImagesRef.current);
}

  }, [images]);

   // ▼ 進化枝専用画像の状態・保存
  const [branchImages, setBranchImages] = useState<BranchImages>(() => {
    try {
      const raw = localStorage.getItem(PET_BRANCH_IMAGES_KEY);
      return raw ? (JSON.parse(raw) as BranchImages) : { teen: {}, adult: {} };
    } catch {
      return { teen: {}, adult: {} };
    }
  });
  useEffect(() => {
    try { localStorage.setItem(PET_BRANCH_IMAGES_KEY, JSON.stringify(branchImages)); } catch {}
  }, [branchImages]);

  // ▼ 画像の拡大率・位置（ステージごと）
  type ImageTF = { zoom: number; x: number; y: number };
  const BASE_TF: ImageTF = { zoom: 1, x: 0, y: 0 };
  const DEFAULT_IMAGE_TF: Record<Stage, ImageTF> = {
    egg: { ...BASE_TF },
    child: { ...BASE_TF },
    teen: { ...BASE_TF },
    adult: { ...BASE_TF },
  };
  const [imageTF, setImageTF] = useState<Record<Stage, ImageTF>>(() => {
    try {
      const raw = localStorage.getItem(PET_IMAGE_TF_KEY);
      return raw ? (JSON.parse(raw) as Record<Stage, ImageTF>) : DEFAULT_IMAGE_TF;
    } catch {
      return DEFAULT_IMAGE_TF;
    }
  });
  useEffect(() => {
    localStorage.setItem(PET_IMAGE_TF_KEY, JSON.stringify(imageTF));
  }, [imageTF]);

  const [bgImage, setBgImage] = useState<string | null>(() => {
  try {
    const raw = localStorage.getItem(PET_BG_KEY);
    return raw ? String(raw) : null;
  } catch {
    return null;
  }
});
useEffect(() => {
  try {
    if (bgImage === null) {
      localStorage.removeItem(PET_BG_KEY);
    } else {
      localStorage.setItem(PET_BG_KEY, bgImage);
    }
  } catch (e) {
    console.error(e);
    setToastMsg("背景画像の保存に失敗しました（容量オーバーの可能性）");
    window.setTimeout(() => setToastMsg(null), 3000);
  }
}, [bgImage]);


const onPickBg = async (f: File | null) => {
  if (!f) return;
  try {
    // 背景は JPEG で保存して容量を大幅節約（最大1600px・画質0.85）
    const dataUrl = await fileToJpegDataURL(f, 1600, 0.85);
    setBgImage(dataUrl); // 即時反映
  } catch {
    alert("背景画像の読み込みに失敗しました。別の画像を試してください。");
  }
};

const clearBg = () => setBgImage(null);

const onPickImage = async (st: Stage, f: File | null) => {
  if (!f) return;
  try {
    // GIF/WebP を含むすべての画像を「静止画PNG（最大1200px）」に変換して保存
    const dataUrl = await fileToPngDataURL(f, 1200);
    setImages((prev) => ({ ...prev, [st]: dataUrl }));
  } catch {
    alert("画像の読み込みに失敗しました。別の画像を試してください。");
  }
};




  const clearImage = (st: Stage) => setImages(prev => ({ ...prev, [st]: null }));

 // ▼ 進化枝専用画像：保存
  const onPickBranchImage = async (st: BranchStage, cat: Category, f: File | null) => {
    if (!f) return;
    try {
      const dataUrl = await fileToPngDataURL(f, 1200);
      setBranchImages(prev => ({ ...prev, [st]: { ...(prev[st] ?? {}), [cat]: dataUrl } }));
    } catch {
      alert("画像の読み込みに失敗しました。別の画像を試してください。");
    }
  };
  // ▼ 進化枝専用画像：削除
  const clearBranchImage = (st: BranchStage, cat: Category) => {
    setBranchImages(prev => ({ ...prev, [st]: { ...(prev[st] ?? {}), [cat]: null } }));
  };

// 背景用：JPEG（品質指定）でサイズ圧縮して DataURL を作る
async function fileToJpegDataURL(file: File, maxSide: number, quality = 0.85): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("画像の読み込みに失敗"));
      i.src = url;
    });

    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    // JPEGで出力（data:image/jpeg;base64,...）
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}


  // いま表示する画像
  const effectiveImages: PetImages = {
  egg: images.egg ?? DEFAULT_IMAGES.egg,
  child: images.child ?? DEFAULT_IMAGES.child,
  teen: images.teen ?? DEFAULT_IMAGES.teen,
  adult: images.adult ?? DEFAULT_IMAGES.adult,
};
// 進化枝が確定していれば、そのカテゴリ専用画像を優先（teen/adultのみ）
const branchStageKey: BranchStage | null = stage === "teen" ? "teen" : stage === "adult" ? "adult" : null;
const branchForm: Category | undefined = branchStageKey ? pet.forms?.[branchStageKey] : undefined;
const branchOverride = (branchStageKey && branchForm)
  ? branchImages[branchStageKey]?.[branchForm] ?? null
  : null;

const currentImage = effectiveImages[stage];
const tf = imageTF[stage];
const effectiveBg = bgImage ?? DEFAULT_BG;


// ▼追加：レベルに応じて加算を下げる係数
const gainFactor = (lv: number) => {
  if (lv < 3)  return 1.0;  // Lv1-2 … そのまま
  if (lv < 6)  return 0.7;  // Lv3-5 … 70%
  if (lv < 10) return 0.5;  // Lv6-9 … 50%
  return 0.35;              // Lv10+  … 35%
};

  // ごはん（直近スコア）を与える
  const feedLatest = () => {
    if (!latest) return;
    
// ▼ 直近解析のキーを作って、重複なら中断
  const key = makeResultKey(latest);
  if (key && feedLog.includes(key)) {
    setToastKind("info");
setToastMsg("同じ解析結果はごはんにできないよ");
if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 2500);

    return;
  }

  // ここから加算
  const incStats: GrowthStats = { 愛情: 0, 切なさ: 0, 悲しみ: 0, 甘え: 0, 欲: 0 };
  cats.forEach((c) => {
    const raw = (latest[c] ?? 0) * 0.2 * gainFactor(level);
    const inc  = raw > 0 ? Math.max(1, Math.round(raw)) : 0; // 1以上を保証
    incStats[c] = inc;
  });

  const next: PetSave = { stats: { ...pet.stats }, total: pet.total, version: pet.version };
  cats.forEach((c) => {
    next.stats[c] = Math.max(0, (next.stats[c] ?? 0) + incStats[c]);
    next.total += incStats[c];
  });

    // 保存（即時）
  setPet(next);
  savePet(next);

  // ★Lvアップ時だけキラッを出す
  const newLevel = Math.floor(next.total / 100) + 1;
  if (newLevel > level) setLevelFxAt(Date.now());

  // ▼ フィードログを更新（先頭に追加・上限で切る）
  if (key) setFeedLog(prev => [key, ...prev].slice(0, FEED_LOG_MAX));
};

// 感情トップ or ステージが変わったら直前のセリフ記憶をリセット
useEffect(() => {
  lastLineRef.current = null;
}, [topCat, stage]);

const DEFAULT_LINES: Record<Category, Record<Stage, string[]>> = {
  愛情: {
    egg:   ["ここ…あったかい…", "ぽかぽかする…"],
    child: ["なかよししたい！", "ぎゅってしてもいい？"],
    teen:  ["もっと一緒にいたいな", "手をつないで歩こうよ"],
    adult: ["大好きがあふれてるよ", "きみがいると安心する"],
  },
  切なさ: {
    egg:   ["ときどき…きゅってなる", "だれか…いるかな"],
    child: ["はやくあいたいよ", "キミをさがしちゃう"],
    teen:  ["会えない時間が長いね", "窓の外を見ちゃうんだ"],
    adult: ["気持ちが届きますように", "また会える日を楽しみにしてる"],
  },
  悲しみ: {
    egg:   ["しーん…", "少しさみしい…"],
    child: ["ぎゅってして…", "ないちゃってもいい？"],
    teen:  ["今日は元気ない？そばにいるね", "深呼吸しよ、一緒に"],
    adult: ["無理しないでね、ここにいるから", "つらい時は頼ってほしいな"],
  },
  甘え: {
    egg:   ["ふにゃ…", "ぴとっ…"],
    child: ["なでてほしいな", "だっこ～！"],
    teen:  ["ちょっと甘えてもいい？", "となり座っていい？"],
    adult: ["たまに甘えてもいいよね", "寄りかかってもいい？"],
  },
  欲: {
    egg:   ["うずうず…", "やってみたい…！"],
    child: ["ちょうせんしてみる！", "あたらしいことだいすき！"],
    teen:  ["次はもっと上手くやるぞ", "計画立てて動こう！"],
    adult: ["さあ次のステップへ", "目標に向かって進もう"],
  },
};

// ▼ ユーザー上書き台詞（localStorageから読み込み／無ければ既定を使う）
const [lines, setLines] = useState<Record<Category, Record<Stage, string[]>>>(() => {
  try {
    const raw = localStorage.getItem(PET_LINES_KEY);
    return raw ? (JSON.parse(raw) as Record<Category, Record<Stage, string[]>>) : DEFAULT_LINES;
  } catch {
    return DEFAULT_LINES;
  }
});

// 変更があれば保存
useEffect(() => {
  try {
    localStorage.setItem(PET_LINES_KEY, JSON.stringify(lines));
  } catch { /* 保存失敗時は何もしない */ }
}, [lines]);


// セリフ選択（候補が2つ以上のときだけ“前回を避ける”）
const stageKey: keyof NonNullable<PetSave['forms']> | null =
  stage === "teen" ? "teen" : stage === "adult" ? "adult" : null;
const branchCat: Category | null = stageKey ? (pet.forms?.[stageKey] ?? null) : null; // ← 進化枝が決まっていればそれを優先
const activeCat: Category = branchCat ?? topCat;
const baseArrRaw = (lines[activeCat]?.[stage] ?? DEFAULT_LINES[activeCat][stage]);
const baseArr = (baseArrRaw && baseArrRaw.length) ? baseArrRaw : DEFAULT_LINES[activeCat][stage];
const unlocked = baseArr.slice(0, Math.min(baseArr.length, unlockedCount(level)));
const pool = unlocked.length ? unlocked : baseArr;

let selected: string;
if (pool.length >= 2) {
  const cands = lastLineRef.current ? pool.filter(s => s !== lastLineRef.current) : pool;
  selected = cands[Math.floor(Math.random() * cands.length)] ?? pool[0] ?? "";
} else {
  // 候補が1本しかないならそれを使う（解禁待ち）
  selected = pool[0] ?? "";
}

const line = selected;
lastLineRef.current = selected;

  // バー表示
const maxVal = Math.max(100, ...cats.map((c) => pet.stats[c] ?? 0));
const formForStage: Category | undefined =
  stage === "teen" ? pet.forms?.teen : stage === "adult" ? pet.forms?.adult : undefined;

// ▼ レベルゲージ用（今のLvで何pt入っているか）
const levelInto = pet.total % 100;              // 0〜99
const levelRemain = 100 - levelInto;            // 次のLvまで
const levelPct = Math.round((levelInto / 100) * 100); // %表示用

          return (

     
    <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => { if (!showBackup && !showImageConfig) onClose(); }}
            />
      <div className="absolute inset-0 flex items-start justify-center pt-10 pointer-events-none">
        <section
          ref={panelRef as any}
          style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}
          className="pointer-events-auto w-[min(92vw,820px)] max-h-[90vh] flex flex-col
                     rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950
                     border border-white/10 shadow-2xl overflow-hidden relative">
         

                                {/* CSS：静止画の“ふわふわ”アニメ */}
  <style>{`
  @keyframes petFloat {
    0%   { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(var(--zoom)); }
    50%  { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty) + 6px)) scale(var(--zoom)); }
    100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(var(--zoom)); }
  }
  /* ラッパー用（子のtransformと合成されるので安全） */
  @keyframes petBob {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(6px); }
  }
  @keyframes toastShake {
    0%,100% { transform: translateX(0); }
    25%     { transform: translateX(-4px); }
    50%     { transform: translateX(4px); }
    75%     { transform: translateX(-2px); }
  }
`}</style>

                              {/* ヘッダ */}
          <div
            className="p-4 border-b border-white/10 bg-white/5 backdrop-blur flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
            onMouseDown={onDragStart}
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
  育成ルーム
  {/* ？ボタン：ドラッグと競合しないよう mousedown は止める */}
  <button
    type="button"
    onMouseDown={(e) => e.stopPropagation()}
    onClick={() => {
      setShowHeaderHelp(prev => {
        const next = !prev;
        if (next) setTimeout(() => updateHelpPos(), 0); // ← 初回クリックですぐ位置を計算
        return next;
      });
    }}
    className={`rounded-full p-1.5 border text-xs transition
                ${showHeaderHelp ? "bg-white/20 border-white/30" : "bg-white/10 hover:bg-white/15 border-white/20"}`}
    aria-label="この画面の簡単な説明"
    title="この画面の簡単な説明"
  >
    <HelpCircle className="w-4 h-4" />
  </button>
</h2>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 border border-white/15">
                Lv.{level}（合計{pet.total}）
              </span>
              <button
                onClick={openBackup}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
              >
                データ
              </button>
              <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm">
                閉じる
              </button>
            </div>
          </div>

          {/* トースト */}
          {toastMsg && (
  <div className="absolute top-3 right-3 z-50">
    <div
      className={
        "flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg backdrop-blur " +
        (toastKind === "error"
          ? "bg-red-500/20 border border-red-300/40"
          : "bg-gradient-to-r from-amber-400/20 to-rose-400/20 border border-amber-300/30")
      }
      style={toastKind === "error" ? { animation: "toastShake .45s ease-in-out 2" } : undefined}
    >
      <Sparkles className="w-4 h-4" />
      <span className="text-sm">{toastMsg}</span>
      <button
        onClick={() => setToastMsg(null)}
        className="ml-2 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
      >
        OK
      </button>
    </div>
    </div>
)}
  
                                               {/* ヘルプ（右側ドッキング表示：ポータルで body に直接描画） */}
          {showHeaderHelp &&
            createPortal(
              <div
                className="fixed z-[200]"
                style={{
                  left: helpPos?.left ?? Math.max(8, window.innerWidth - 360 - 8),
                  top:  helpPos?.top  ?? 80,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="relative w-[360px] text-sm leading-relaxed rounded-2xl border border-white/15 ring-1 ring-cyan-300/20
                                bg-gradient-to-b from-slate-900/90 to-slate-950/90 text-white/90 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/60
                                animate-[helpPop_160ms_ease-out]">
                  <style>{`
                    @keyframes helpPop {
                      0% { transform: translateY(-6px) scale(.98); opacity: 0; }
                      100%{ transform: translateY(0) scale(1);   opacity: 1; }
                    }
                  `}</style>
                  {/* 上縁にアクセントライン */}
                  <div className="pointer-events-none absolute left-3 right-3 -top-[1px] h-[2px] rounded-full bg-gradient-to-r from-cyan-300/60 via-fuchsia-300/60 to-amber-300/60" />
                  {/* モーダルとの連結感を出す小三角 */}
                  <div className="absolute -left-2 top-6 w-4 h-4 rotate-45 bg-slate-900/90 border-l border-t border-white/20 shadow-lg" />
                  {/* ヘッダー行 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 opacity-90" />
                      <div className="font-semibold">この画面の使い方</div>
                    </div>
                    <button
                      className="p-1.5 rounded-full border border-white/20 bg-slate-800/80 text-white
                                 hover:bg-slate-700/80 transition"
                      onClick={() => setShowHeaderHelp(false)}
                      aria-label="ヘルプを閉じる"
                      title="閉じる"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* ↓ 本文：カードで区切って視認性UP（スクロール可） */}
                  <div className="max-h-[70vh] overflow-auto space-y-3 pr-1">

                    {/* 1. 進化のしくみ */}
                    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 opacity-90" />
                        <h3 className="font-semibold text-sm">進化のしくみ</h3>
                      </div>
                      <ul className="space-y-1.5 list-disc pl-4">
                        <li>ステージ：<b>たまご → 幼年期 → 成長期 → 成熟期</b>。</li>
                        <li><b>成長期／成熟期に上がった瞬間</b>、その時いちばん高いカテゴリが <b>進化先</b> として自動確定。</li>
                        <li>進化先が確定していると、<b>その枝の画像・セリフが優先</b>で表示されます。</li>
                        <li>まちがえた時は <b>進化リセット</b> で未確定に戻せます。</li>
                      </ul>
                    </section>

                    {/* 2. ボタンの説明 */}
                    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <ImagePlus className="w-4 h-4 opacity-90" />
                        <h3 className="font-semibold text-sm">ボタンの説明</h3>
                      </div>
                      <ul className="space-y-1.5 list-disc pl-4">
                        <li><b>画像設定</b>：背景とキャラ画像を変更。ステージ別／進化先別に設定。X/Y/ズームで位置調整。「ふわふわ動く」をONにすると、やさしくゆれます。</li>
                        <li><b>台詞設定</b>：セリフを編集。ステージ別／進化先別に登録。未設定のところはデフォルトが出ます。</li>
                        <li><b>エクスポート</b>：セーブデータを表示＆コピー。バックアップにどうぞ。</li>
                        <li><b>進化リセット</b>：確定済みの進化先を解除（ステージはそのまま）。</li>
                        <li><b>リセット</b>：育成データを初期化（やり直し）。実行前に確認ダイアログが出ます。</li>
                      </ul>
                    </section>

                    {/* 3. ヒント */}
                    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <HelpCircle className="w-4 h-4 opacity-90" />
                        <h3 className="font-semibold text-sm">ヒント</h3>
                      </div>
                      <ul className="space-y-1.5 list-disc pl-4">
                        <li>画像がずれて見える → 画像設定の <b>X/Y/ズーム</b> を少し動かす。</li>
                        <li>ゆれない → 画像設定の <b>ふわふわ動く</b> をON。</li>
                        <li>セリフが長い → そのまま改行してOK（自動で折り返し）。</li>
                      </ul>
                    </section>
                  </div>

                </div>
              </div>,
              document.body
            )}


          {/* 本体：二列レイアウト */}
          <div className="p-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                            {/* 左：ステータス＋アクション */}
              <div className="lg:col-span-5 space-y-4">
                {/* レベルゲージ */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span>Lv.{level}</span>
                    <span className="opacity-80">次まで {levelRemain}pt</span>
                  </div>
                  <div className="h-2 rounded bg-black/30 border border-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-amber-400"
                      style={{ width: `${levelPct}%` }}
                    />
                  </div>
                </div>

                {/* ステータス */}
                <div className="space-y-3">

                  {["愛情","切なさ","悲しみ","甘え","欲"].map((c) => {
                    const v = Math.max(0, pet.stats[c as Category] ?? 0);
                    const w = Math.round((v / Math.max(100, maxVal)) * 100);
                    return (
                      <div key={c}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="opacity-80">{c}</span>
                          <span className="opacity-70">{v}</span>
                        </div>
                        <div className="h-3 rounded bg-black/30 border border-white/10">
                          <div className="h-full rounded bg-gradient-to-r from-amber-400 to-rose-400" style={{ width: `${w}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* アクション（左側だけに配置：画像設定／エクスポート／リセット） */}
<div className="flex items-center gap-2 flex-wrap">
  <button
    type="button"
    onClick={() => setShowImageConfig(true)}
    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm flex items-center gap-1"
  >
    <ImagePlus className="w-4 h-4" />
    画像設定
  </button>

<button
    type="button"
    onClick={openLinesConfig}
    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm flex items-center gap-1"
  >
    <Edit3 className="w-4 h-4" />
    台詞設定
  </button>

    <button
    onClick={openBackup}
    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
  >
    エクスポート
  </button>

  {/* 進化だけリセット（数値はそのまま・formsだけ消す） */}
  <button
    onClick={() => {
      const ok = window.confirm("進化だけリセットしますか？\n（分岐をやり直せます。数値は消えません）");
      if (!ok) return;
      setPet(p => {
        const next = { ...p, forms: {} };
        savePet(next);
        return next;
      });
    }}
    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
  >
    進化リセット
  </button>

  <button
    onClick={() => {
      const ok = window.confirm("本当にリセットしますか？\n（育成データが初期化されます）");
      if (ok) { setPet(DEFAULT_SAVE); savePet(DEFAULT_SAVE); }
    }}
    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
  >
    リセット
  </button>

</div>

              </div>

             {/* 右：画像表示窓（オーバーレイ付き） */}
<div className="lg:col-span-7">
  {/* 画像表示窓 */}
  <div className="rounded-2xl bg-black/20 border border-white/10 p-2">
    <div className="relative aspect-[4/3] w-full rounded-xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
      {/* 背景（あれば敷く） */}
      {effectiveBg && (
        <img
          src={effectiveBg}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

                 {/* キャラ */}
           {currentImage ? (
        <div
          className="absolute top-1/2 left-1/2 animate-[petBob_2.6s_ease-in-out_infinite]"
          style={{ transform: "translate(-50%, -50%)" }}
        >
                      <img
              src={currentImage}
              alt="pet"

            className="max-w-full max-h-full"
            style={{
              // スライダー値 + ステージごとの基準オフセット
              ["--tx" as any]: `${tf.x + BASE_OFFSET[stage].x}px`,
              ["--ty" as any]: `${tf.y + BASE_OFFSET[stage].y}px`,
              ["--zoom" as any]: tf.zoom,
              position: "relative",
              left: "40%",
              top: "50%",
              transform: `translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(var(--zoom))`,
              transformOrigin: "center center",
            } as React.CSSProperties}
          />
        </div>
      ) : (
        <span className="opacity-40 text-5xl select-none">{STAGE_EMOJI[stage]}</span>
      )}

            {/* 読みやすさ用のスクリーン（上・下） */}
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent z-10 pointer-events-none" />

      {/* ★キラッ演出（レベルアップ時） */}
      {levelFxAt && (
        <div className="absolute left-1/2 top-6 -translate-x-1/2 z-30 pointer-events-none">
          <div className="relative w-40 h-40">
            <style>{`
              @keyframes pop { 0%{transform:scale(0);opacity:0} 30%{transform:scale(1);opacity:1} 100%{transform:scale(0.6);opacity:0} }
              @keyframes ray { 0%{transform:scaleX(0);opacity:0} 40%{transform:scaleX(1);opacity:1} 100%{transform:scaleX(0);opacity:0} }
            `}</style>
            <div className="absolute inset-0 rounded-full bg-white/30 blur-xl animate-[pop_900ms_ease-out_forwards]" />
            {[0,45,90,135].map((deg) => (
              <div
                key={deg}
                className="absolute left-1/2 top-1/2 h-0.5 w-20 origin-left bg-white/80"
                style={{ transform: `translate(-50%,-50%) rotate(${deg}deg)`, animation: "ray 900ms ease-out forwards" }}
              />
            ))}
          </div>
        </div>
      )}

      {/* オーバーレイ：上部バッジ（ここではドラッグ開始しない） */}
      <div
        className="absolute inset-x-0 top-0 z-20 p-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="px-2 py-0.5 rounded-full bg-black/40 backdrop-blur border border-white/15 text-[11px] sm:text-xs">
            {STAGE_LABEL[stage]}
          </span>
                   <div className="flex items-center gap-2">
            {formForStage && (
              <span className="px-2 py-0.5 rounded-full bg-black/35 backdrop-blur border border-white/12 text-[11px] sm:text-xs">
                進化：{formForStage}型
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-black/30 backdrop-blur border border-white/10 text-[11px] sm:text-xs">
              直近の傾向：{latest ? `${topCat}` : "—"}
            </span>
          </div>
        </div>
      </div>


      {/* オーバーレイ：下部セリフ（恋愛SLG風の帯） */}
      <div className="absolute inset-x-0 bottom-0 z-20 p-3">
        <div className="rounded-xl px-4 py-2 bg-black/45 backdrop-blur border border-white/15 text-sm sm:text-base leading-relaxed text-white/90">
          {line}
        </div>
      </div>
    </div>
  </div>
</div>
            </div>

            {/* フッター：左=説明 / 右=最新の解析結果ボタン */}
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs opacity-70">
                解析結果（レーダーの数値）を「ごはん」として加算します。同じ解析は一度だけ有効です。
              </div>
              <button
                onClick={feedLatest}
                disabled={!latest}
                className="px-3 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-sm shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                最新の解析結果をあげる
              </button>
            </div>
          </div>
        </section>

        {/* エクスポート／インポート窓（モーダル） */}
                                {showBackup && (
          <div className="fixed inset-0 z-[60] pointer-events-auto">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setShowBackup(false)}
            />
            <aside


              className="absolute right-0 top-0 h-full w-full sm:w-[720px] bg-gradient-to-b from-slate-900 to-slate-950 border-l border-white/10 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
                          
                            <div className="p-4 border-b border-white/10 backdrop-blur-lg bg-white/5 flex items-center justify-between">
                <h3 className="text-lg font-semibold">セーブデータ（JSON）</h3>
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setShowBackup(false); }}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>



              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                <div className="text-sm opacity-80">
                  表示された内容をコピーして、メモ帳などに貼り付けて保存してください。
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={downloadBackup}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    エクスポート
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(backupText);
                        alert("コピーしました！");
                      } catch {
                        if (backupRef.current) {
                          backupRef.current.select();
                          document.execCommand("copy");
                          alert("選択済みです。Ctrl+C でコピーしてください。");
                        }
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    コピー
                  </button>
                  <button
                    onClick={() => setShowBackup(false)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs"
                  >
                    閉じる
                  </button>
                </div>

                <textarea
                  ref={backupRef}
                  readOnly
                  value={backupText}
                  className="w-full h-80 bg-black/20 border border-white/10 rounded-xl p-3 text-xs font-mono"
                />

                {/* 区切り線 */}
                <div className="h-px my-4 bg-white/10" />

                {/* インポート（復元） */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">復元（インポート）</h4>
                    <label className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs flex items-center gap-1 cursor-pointer">
                      <Upload className="w-3 h-3" />
                      ファイルから
                      <input type="file" accept="application/json" className="hidden" onChange={onImportFile} />
                    </label>
                  </div>

                  <div className="text-xs opacity-80">
                    ここにエクスポートしたJSONを貼り付けるか、ファイルを選んでください。「復元」で現在の育成データを上書きします。
                  </div>

                  <textarea
                    ref={importRef}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder='例：{"stats":{"愛情":120,"切なさ":45,"悲しみ":10,"甘え":80,"欲":60},"total":315,"version":"1.0.0"}'
                    className="w-full h-56 bg-black/20 border border-white/10 rounded-xl p-3 text-xs font-mono"
                  />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={applyImport}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs"
                    >
                      復元
                    </button>
                    <button
                      onClick={() => setImportText("")}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs"
                    >
                      クリア
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* 画像設定（モーダル） */}
                      {showImageConfig && (
          <div className="fixed inset-0 z-[80] pointer-events-auto">
            {/* 黒幕：外側クリックで閉じる */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowImageConfig(false)}
            />
            {/* 本体：ここでクリックの伝播を止める */}
            <aside
              className="absolute right-0 top-0 h-full w-full sm:w-[720px] bg-gradient-to-b from-slate-900 to-slate-950 border-l border-white/10 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
                        >
              <div className="p-4 border-b border-white/10 backdrop-blur-lg bg-white/5 flex items-center justify-between">
  <h3 className="text-lg font-semibold">画像設定</h3>
  <button
    type="button"
    onMouseDown={(e) => e.stopPropagation()}
    onClick={(e) => { e.stopPropagation(); setShowImageConfig(false); }}
    className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
  >
    <X className="w-4 h-4" />
  </button>
</div>

              <div className="p-4 space-y-4 overflow-y-auto">
                {/* 背景カード（全ステージ共通） */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3">
                  <div className="w-28 h-20 bg-black/20 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden">
                    {effectiveBg ? (
                      <img src={effectiveBg} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs opacity-70">背景なし</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm mb-2">背景（全段階共通）</div>
                    <div className="flex items-center gap-2">
                      {/* …中略（画像設定カード群）… */}
                    </div>
                                        <p className="text-xs opacity-70 mt-1">推奨：横長の画像（object-cover で全体に敷き詰め）</p>
                  </div>
                </div>

                {/* 各ステージの画像カード */}
                {(["egg","child","teen","adult"] as const).map((st) => (
                  <div key={st} className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3">
                    <div className="w-28 h-20 bg-black/20 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden">
                      {(effectiveImages[st]) ? (
                        <img src={effectiveImages[st] as string} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-3xl select-none">{STAGE_EMOJI[st]}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm mb-2">{STAGE_LABEL[st]}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <label
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs flex items-center gap-1 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ImagePlus className="w-3 h-3" />
                          画像を選ぶ
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              (e.currentTarget as HTMLInputElement).value = "";
                              void onPickImage(st, f);
                            }}
                          />
                        </label>
                        {images[st] && (
                          <button
                            type="button"
                            onClick={() => clearImage(st)}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            クリア
                          </button>
                        )}
                        <button
                          type="button"
                          className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs"
                          onClick={() => {
                            // 位置・拡大率を既定に戻す
                            setImageTF(prev => ({ ...prev, [st]: { zoom: 1, x: 0, y: 0 } }));
                          }}
                        >
                          位置をリセット
                        </button>
                      </div>

                      {/* 画像の拡大率・位置 */}
                                           <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <label className="flex flex-col gap-1">
                          <span className="opacity-80">拡大率 {imageTF[st].zoom.toFixed(2)}x</span>
                          <input
                            type="range"
                            min={0.5}
                            max={2}
                            step={0.01}
                            value={imageTF[st].zoom}
                            onChange={(e) => setImageTF(prev => ({ ...prev, [st]: { ...prev[st], zoom: Number(e.target.value) } }))}
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="opacity-80">横位置 {imageTF[st].x}px</span>
                          <input
                            type="range"
                            min={-200}
                            max={200}
                            step={1}
                            value={imageTF[st].x}
                            onChange={(e) => setImageTF(prev => ({ ...prev, [st]: { ...prev[st], x: Number(e.target.value) } }))}
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="opacity-80">縦位置 {imageTF[st].y}px</span>
                          <input
                            type="range"
                            min={-200}
                            max={200}
                            step={1}
                            value={imageTF[st].y}
                            onChange={(e) => setImageTF(prev => ({ ...prev, [st]: { ...prev[st], y: Number(e.target.value) } }))}
                          />
                        </label>
                      </div>

                      <p className="text-xs opacity-70 mt-2">推奨：PNG / 透過背景可（大きめOK・自動で縮小表示）</p>

                    </div>
                  </div>
                ))}

 {/* 進化枝ごとの画像（ティーン/アダルト × カテゴリ） */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3">
                  <div className="w-28 h-20 bg-black/20 border border-white/10 rounded-lg flex items-center justify-center overflow-hidden">
                    {(() => {
                      const st = branchEditStage;
                      const cat = branchEditCat;
                      const src = branchImages[st]?.[cat] ?? null;
                      return src ? <img src={src} className="w-full h-full object-cover" /> : (
                        <span className="text-xs opacity-70">画像なし</span>
                      );
                    })()}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-sm">進化枝ごとの画像</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label className="text-xs flex flex-col gap-1">
                        <span className="opacity-80">ステージ</span>
                        <select
                          value={branchEditStage}
                          onChange={(e) => setBranchEditStage(e.target.value as BranchStage)}
                          className="bg-black/20 border border-white/10 rounded p-2 text-sm"
                        >
                          <option value="teen">{STAGE_LABEL["teen"]}</option>
                          <option value="adult">{STAGE_LABEL["adult"]}</option>
                        </select>
                      </label>
                      <label className="text-xs flex flex-col gap-1">
                        <span className="opacity-80">カテゴリ</span>
                        <select
                          value={branchEditCat}
                          onChange={(e) => setBranchEditCat(e.target.value as Category)}
                          className="bg-black/20 border border-white/10 rounded p-2 text-sm"
                        >
                          {(["愛情","切なさ","悲しみ","甘え","欲"] as const).map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <div className="text-xs opacity-70 self-end">
                        ※ 進化先が決まっているときは、ここで設定した画像を優先表示します
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs flex items-center gap-1 cursor-pointer" onClick={(e)=>e.stopPropagation()}>
                        <ImagePlus className="w-3 h-3" />
                        画像を選ぶ
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => onPickBranchImage(branchEditStage, branchEditCat, e.target.files?.[0] ?? null)}
                        />
                      </label>
                      <button
                        onClick={() => clearBranchImage(branchEditStage, branchEditCat)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        クリア
                      </button>
                    </div>
                  </div>
                </div>


              </div>
            </aside>


                              

          </div>
        )}

        {/* 台詞設定（モーダル） */}
        {showLinesConfig && (
          <div className="fixed inset-0 z-[85] pointer-events-auto">
            {/* 黒幕：外側クリックで閉じる */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowLinesConfig(false)}
            />
            {/* 本体：ここでクリックの伝播を止める */}
            <aside
              className="absolute right-0 top-0 h-full w-full sm:w-[720px] bg-gradient-to-b from-slate-900 to-slate-950 border-l border-white/10 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 backdrop-blur-lg bg-white/5 flex items-center justify-between">
                <h3 className="text-lg font-semibold">台詞設定</h3>
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setShowLinesConfig(false); }}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="text-xs flex flex-col gap-1">
                    <span className="opacity-80">カテゴリ</span>
                    <select
                      value={editCat}
                      onChange={(e) => setEditCat(e.target.value as Category)}
                      className="bg-black/20 border border-white/10 rounded p-2 text-sm"
                    >
                      {(["愛情","切なさ","悲しみ","甘え","欲"] as const).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs flex flex-col gap-1">
                    <span className="opacity-80">ステージ</span>
                    <select
                      value={editStage}
                      onChange={(e) => setEditStage(e.target.value as Stage)}
                      className="bg-black/20 border border-white/10 rounded p-2 text-sm"
                    >
                      {(["egg","child","teen","adult"] as const).map(s => (
                        <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                      ))}
                    </select>
                  </label>
                  <div className="text-xs opacity-70 self-end">※ 1行 = 1つの台詞</div>
                </div>

                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder={"例：\nなかよししたい！\nぎゅってしてもいい？"}
                  className="w-full h-48 bg-black/20 border border-white/10 rounded-xl p-3 text-sm"
                />

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      const arr = editText.split("\n").map(s => s.trim()).filter(Boolean);
                      setLines(prev => ({
                        ...prev,
                        [editCat]: { ...prev[editCat], [editStage]: arr }
                      }));
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      const def = DEFAULT_LINES[editCat][editStage] || [];
                      setEditText(def.join("\n"));
                      setLines(prev => ({
                        ...prev,
                        [editCat]: { ...prev[editCat], [editStage]: def }
                      }));
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs"
                  >
                    既定に戻す
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

      </div>
    </div>
       
   );

  }

