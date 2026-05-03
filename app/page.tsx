"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./page.module.css";

const DEVICE_ID_KEY = "notePromptDeviceId";
const STEP_KEY = "notePromptBuilderStep";

function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing && existing.length >= 8) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

async function readErrorBody(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const j = await res.json();
      return JSON.stringify(j, null, 2);
    }
    return await res.text();
  } catch {
    return "";
  }
}

function statusHint(status: number): string {
  return status === 500
    ? "Lambda のログ、環境変数、権限、S3 キー、DynamoDB を確認してください。"
    : status === 404
    ? "API Gateway のルート、ステージ、パスを確認してください。"
    : status === 400
    ? "リクエスト JSON の形式と必須項目を確認してください。"
    : status === 403
    ? "CORS、認可、権限を確認してください。"
    : "";
}

function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className,
  minHeight = 44,
  readOnly = false,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
  }, [minHeight]);

  useEffect(() => {
    resize();
  }, [resize, value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => {
        onChange(e);
        requestAnimationFrame(resize);
      }}
      placeholder={placeholder}
      className={className}
      readOnly={readOnly}
      style={{ overflow: "hidden", resize: "none" }}
    />
  );
}

function Field({
  label,
  hint,
  required,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>
        {label}
        {required && <span className={styles.requiredBadge}>必須</span>}
        {optional && <span className={styles.optionalBadge}>任意</span>}
      </label>
      {hint && <div className={styles.fieldHint}>{hint}</div>}
      {children}
    </div>
  );
}

function BulletListInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  hint,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  const setAt = (idx: number, v: string) => {
    const next = value.slice();
    next[idx] = v;
    onChange(next);
  };

  return (
    <Field label={label} required={required} optional={!required} hint={hint}>
      <div className={styles.bulletList}>
        {value.map((line, idx) => (
          <div key={idx} className={styles.bulletRow}>
            <AutoResizeTextarea
              className={`${styles.input} ${styles.bulletTextarea}`}
              value={line}
              onChange={(e) => setAt(idx, e.target.value)}
              placeholder={placeholder}
              minHeight={44}
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
              className={styles.bulletDelete}
              aria-label="削除"
            >
              x
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...value, ""])}
          className={styles.addRowButton}
        >
          + 行を追加
        </button>
      </div>
    </Field>
  );
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <div className={styles.markdownPreview}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

type Step = 0 | 1 | 2;
type ArticleType = "problem" | "experience" | "experiment";
type PrimaryGoalSlug =
  | "action"
  | "collect_feedback"
  | "build_trust"
  | "lead_paid"
  | "fan_build";

const STEPS = ["基本設定", "記事素材", "生成結果"];

const ARTICLE_TYPES: {
  id: ArticleType;
  icon: string;
  title: string;
  description: string;
}[] = [
  {
    id: "problem",
    icon: "!",
    title: "問題解決型",
    description: "課題、原因、解決策を整理する記事",
  },
  {
    id: "experience",
    icon: "*",
    title: "体験共有型",
    description: "出来事、感情、学びを共有する記事",
  },
  {
    id: "experiment",
    icon: "#",
    title: "実験ログ型",
    description: "仮説、実行、結果、考察を残す記事",
  },
];

const PRIMARY_GOALS: { slug: PrimaryGoalSlug; label: string }[] = [
  { slug: "action", label: "行動してもらう" },
  { slug: "collect_feedback", label: "感想・改善案を集める" },
  { slug: "build_trust", label: "信頼を作る" },
  { slug: "lead_paid", label: "有料・商品へ誘導" },
  { slug: "fan_build", label: "ファン化" },
];

const TARGET_TAGS = [
  "note初心者",
  "副業初心者",
  "収益化したい人",
  "継続できない人",
  "AI活用したい人",
  "学生",
  "社会人",
];

const STYLE_PRESET_OPTIONS = [
  {
    value: "casual",
    title: "カジュアル",
    description: "自然で親しみやすい",
  },
  {
    value: "logical",
    title: "ロジカル",
    description: "結論と理由を整理",
  },
  {
    value: "passionate",
    title: "情熱的",
    description: "主張と熱量を強める",
  },
  {
    value: "friendly",
    title: "フレンドリー",
    description: "距離感が近くやさしい",
  },
  {
    value: "professional",
    title: "プロフェッショナル",
    description: "丁寧で信頼感がある",
  },
];

export default function HomePage() {
  const [deviceId, setDeviceId] = useState("");
  const [step, setStep] = useState<Step>(0);
  const [showSplash, setShowSplash] = useState(true);
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE ?? "", []);

  const [theme, setTheme] = useState("");
  const [articleType, setArticleType] = useState<ArticleType>("problem");
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoalSlug>("action");
  const [targetTags, setTargetTags] = useState<string[]>([]);
  const [targetDetail, setTargetDetail] = useState("");
  const [authority, setAuthority] = useState("");
  const [stylePreset, setStylePreset] = useState("casual");

  const [pProblem, setPProblem] = useState<string[]>([""]);
  const [pEpisode, setPEpisode] = useState<string[]>([""]);
  const [pCause, setPCause] = useState<string[]>([""]);
  const [pSolutions, setPSolutions] = useState<string[]>([""]);
  const [pTodayAction, setPTodayAction] = useState("");

  const [optEvidence, setOptEvidence] = useState<string[]>([""]);
  const [optFailures, setOptFailures] = useState<string[]>([""]);
  const [optBackground, setOptBackground] = useState<string[]>([""]);
  const [showOptional, setShowOptional] = useState(false);

  const [eEvent, setEEvent] = useState<string[]>([""]);
  const [eFeelings, setEFeelings] = useState<string[]>([""]);
  const [eInsight, setEInsight] = useState<string[]>([""]);
  const [eLearnings, setELearnings] = useState<string[]>([""]);
  const [eQuestion, setEQuestion] = useState("");
  const [eMessage, setEMessage] = useState("");
  const [optData, setOptData] = useState<string[]>([""]);
  const [optFailureDetails, setOptFailureDetails] = useState<string[]>([""]);

  const [xHypothesis, setXHypothesis] = useState("");
  const [xDid, setXDid] = useState<string[]>([""]);
  const [xResult, setXResult] = useState<string[]>([""]);
  const [xDiscussion, setXDiscussion] = useState<string[]>([""]);
  const [xNextAction, setXNextAction] = useState<string[]>([""]);
  const [optCompare, setOptCompare] = useState<string[]>([""]);
  const [optUnexpected, setOptUnexpected] = useState<string[]>([""]);
  const [optXFailures, setOptXFailures] = useState<string[]>([""]);

  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [historyId, setHistoryId] = useState<string>("");
  const [articleTitleIdeas, setArticleTitleIdeas] = useState<string[]>([]);
  const [articleOutline, setArticleOutline] = useState<string[]>([]);
  const [generatedArticleMarkdown, setGeneratedArticleMarkdown] = useState("");
  const [articleModel, setArticleModel] = useState("");
  const [resultTab, setResultTab] = useState<"prompt" | "article">("prompt");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  const [error, setError] = useState("");
  const [articleError, setArticleError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
    const savedStep = Number(localStorage.getItem(STEP_KEY));
    if (savedStep === 0 || savedStep === 1 || savedStep === 2) {
      setStep(savedStep as Step);
    }
    const timer = window.setTimeout(() => setShowSplash(false), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(STEP_KEY, String(step));
  }, [step]);

  const formLocked = loading || saving;
  const hasAtLeastOne = (arr: string[]) => arr.some((x) => x.trim().length > 0);

  const canGenerate = (() => {
    if (formLocked) return false;
    if (!theme.trim() || !articleType || !primaryGoal || !stylePreset) return false;
    if (articleType === "problem") {
      return hasAtLeastOne(pProblem) && hasAtLeastOne(pSolutions) && !!pTodayAction.trim();
    }
    if (articleType === "experience") {
      return hasAtLeastOne(eEvent) && hasAtLeastOne(eFeelings) && hasAtLeastOne(eLearnings) && !!eMessage.trim();
    }
    return !!xHypothesis.trim() && hasAtLeastOne(xDid) && hasAtLeastOne(xResult) && hasAtLeastOne(xDiscussion);
  })();

  const canSave = !formLocked && !!historyId && !!generatedPrompt.trim() && isEditing && dirty;

  const toggleTag = (tag: string) => {
    setTargetTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const buildPayloadV10 = () => {
    const base: Record<string, unknown> = {
      theme,
      articleType,
      primaryGoal,
      targets: { tags: targetTags, detail: targetDetail.trim() },
      authority: authority.trim(),
      stylePreset,
      meta: { deviceId, templateId: "note-v10", version: "0.2.0" },
    };

    if (articleType === "problem") {
      base.materials = {
        problem: {
          problem: pProblem.filter((x) => x.trim()),
          episode: pEpisode.filter((x) => x.trim()),
          cause: pCause.filter((x) => x.trim()),
          solutions: pSolutions.filter((x) => x.trim()),
          todayAction: pTodayAction.trim(),
        },
      };
      base.optional = {
        background: optBackground.filter((x) => x.trim()),
        evidence: optEvidence.filter((x) => x.trim()),
        failures: optFailures.filter((x) => x.trim()),
      };
    }

    if (articleType === "experience") {
      base.materials = {
        experience: {
          event: eEvent.filter((x) => x.trim()),
          feelingsOrSituation: eFeelings.filter((x) => x.trim()),
          insight: eInsight.filter((x) => x.trim()),
          learnings: eLearnings.filter((x) => x.trim()),
          question: eQuestion.trim(),
          message: eMessage.trim(),
        },
      };
      base.optional = {
        background: optBackground.filter((x) => x.trim()),
        data: optData.filter((x) => x.trim()),
        failureDetails: optFailureDetails.filter((x) => x.trim()),
      };
    }

    if (articleType === "experiment") {
      base.materials = {
        experiment: {
          hypothesis: xHypothesis.trim(),
          did: xDid.filter((x) => x.trim()),
          result: xResult.filter((x) => x.trim()),
          discussion: xDiscussion.filter((x) => x.trim()),
          nextAction: xNextAction.filter((x) => x.trim()),
        },
      };
      base.optional = {
        background: optBackground.filter((x) => x.trim()),
        compare: optCompare.filter((x) => x.trim()),
        failures: optXFailures.filter((x) => x.trim()),
        unexpected: optUnexpected.filter((x) => x.trim()),
      };
    }

    return base;
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    setIsEditing(false);
    setDirty(false);
    setGeneratedPrompt("");
    setHistoryId("");
    setArticleTitleIdeas([]);
    setArticleOutline([]);
    setGeneratedArticleMarkdown("");
    setArticleModel("");
    setArticleError("");
    setStep(2);
    setResultTab("prompt");

    try {
      if (!apiBase) throw new Error("NEXT_PUBLIC_API_BASE is not set");
      if (!deviceId) throw new Error("deviceId is not ready");
      const res = await fetch(`${apiBase}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayloadV10()),
      });

      if (!res.ok) {
        const body = await readErrorBody(res);
        const hint = statusHint(res.status);
        throw new Error(
          [
            "API Error",
            `URL: ${res.url}`,
            `Status: ${res.status} ${res.statusText}`,
            body ? `Body:\n${body}` : "",
            hint,
          ]
            .filter(Boolean)
            .join("\n")
        );
      }

      const data = await res.json();
      setGeneratedPrompt(data.generatedPrompt ?? "");
      setHistoryId(data.historyId ?? "");
      setNotice("生成しました。履歴にも保存されています。");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOverwrite = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (!apiBase) throw new Error("NEXT_PUBLIC_API_BASE is not set");
      if (!deviceId) throw new Error("deviceId is not ready");
      if (!historyId) throw new Error("historyId is missing");
      const res = await fetch(`${apiBase}/history/${historyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, generatedPrompt }),
      });
      if (!res.ok) {
        const body = await readErrorBody(res);
        const hint = statusHint(res.status);
        throw new Error(
          [
            "Save Error",
            `URL: ${res.url}`,
            `Status: ${res.status} ${res.statusText}`,
            body ? `Body:\n${body}` : "",
            hint,
          ]
            .filter(Boolean)
            .join("\n")
        );
      }
      setDirty(false);
      setIsEditing(false);
      setNotice("上書き保存しました。");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setNotice("コピーしました。");
    window.setTimeout(() => {
      setCopied(false);
      setNotice("");
    }, 1500);
  };

  const handleCopyArticle = async () => {
    await navigator.clipboard.writeText(generatedArticleMarkdown);
    setNotice("記事本文をコピーしました。");
    window.setTimeout(() => setNotice(""), 1500);
  };

  const handleGenerateArticle = async () => {
    setArticleLoading(true);
    setArticleError("");
    setNotice("");
    setArticleTitleIdeas([]);
    setArticleOutline([]);
    setGeneratedArticleMarkdown("");
    setArticleModel("");
    setResultTab("article");

    try {
      if (!generatedPrompt.trim()) {
        throw new Error("先にプロンプトを生成してください。");
      }
      const res = await fetch("/api/article/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: generatedPrompt }),
      });
      if (!res.ok) {
        const body = await readErrorBody(res);
        throw new Error(
          [
            "Article Generate Error",
            `Status: ${res.status} ${res.statusText}`,
            body ? `Body:\n${body}` : "",
          ]
            .filter(Boolean)
            .join("\n")
        );
      }
      const data = await res.json();
      setArticleTitleIdeas(Array.isArray(data.titleIdeas) ? data.titleIdeas : []);
      setArticleOutline(Array.isArray(data.outline) ? data.outline : []);
      setGeneratedArticleMarkdown(data.articleMarkdown ?? "");
      setArticleModel(data.model ?? "");
      setNotice("記事本文を生成しました。");
    } catch (e: unknown) {
      setArticleError(e instanceof Error ? e.message : "Failed to generate article");
    } finally {
      setArticleLoading(false);
    }
  };

  const stepDone = [
    !!theme.trim(),
    canGenerate || !!generatedPrompt,
    !!generatedPrompt,
  ];

  const basicStep = (
    <section className={styles.card}>
      <div className={styles.sectionLabel}>Step 1 / 3</div>
      <h2 className={styles.sectionTitle}>基本設定</h2>
      <p className={styles.sectionSub}>
        テーマ、記事の型、目的、読者、文体を先に固定します。
      </p>

      <Field label="記事テーマ" required>
        <AutoResizeTextarea
          className={styles.input}
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="例: note が継続できない原因と解決策"
          minHeight={60}
        />
      </Field>

      <div className={styles.divider} />

      <Field label="記事の型">
        <div className={styles.typeGrid}>
          {ARTICLE_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              className={`${styles.typeCard} ${
                articleType === type.id ? styles.typeCardActive : ""
              }`}
              onClick={() => setArticleType(type.id)}
            >
              <span className={styles.typeIcon}>{type.icon}</span>
              <span className={styles.typeTitle}>{type.title}</span>
              <span className={styles.typeDesc}>{type.description}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="主目的">
        <div className={styles.goalRow}>
          {PRIMARY_GOALS.map((goal) => (
            <button
              key={goal.slug}
              type="button"
              className={`${styles.goalButton} ${
                primaryGoal === goal.slug ? styles.goalButtonActive : ""
              }`}
              onClick={() => setPrimaryGoal(goal.slug)}
            >
              {goal.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="想定読者" optional>
        <div className={styles.chipRow}>
          {TARGET_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`${styles.chip} ${
                targetTags.includes(tag) ? styles.chipActive : ""
              }`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
        <AutoResizeTextarea
          className={styles.input}
          value={targetDetail}
          onChange={(e) => setTargetDetail(e.target.value)}
          placeholder="より具体的な読者像があれば入力"
          minHeight={60}
        />
      </Field>

      <Field label="権威性" hint="経験、実績、数字など" optional>
        <AutoResizeTextarea
          className={styles.input}
          value={authority}
          onChange={(e) => setAuthority(e.target.value)}
          placeholder="例: 30記事検証 / PVの変化 / 実務経験"
          minHeight={60}
        />
      </Field>

      <Field label="文体">
        <div className={styles.styleGrid}>
          {STYLE_PRESET_OPTIONS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`${styles.styleCard} ${
                stylePreset === preset.value ? styles.styleCardActive : ""
              }`}
              onClick={() => setStylePreset(preset.value)}
            >
              <span className={styles.styleName}>{preset.title}</span>
              <span className={styles.styleDesc}>{preset.description}</span>
            </button>
          ))}
        </div>
      </Field>

      <div className={styles.navRow}>
        <button
          className={styles.primaryButton}
          onClick={() => setStep(1)}
          disabled={!theme.trim()}
        >
          次へ: 記事素材を入力
        </button>
      </div>
    </section>
  );

  const materialStep = (
    <section className={styles.card}>
      <div className={styles.sectionLabel}>Step 2 / 3</div>
      <h2 className={styles.sectionTitle}>記事素材</h2>
      <p className={styles.sectionSub}>
        選んだ型に合わせて素材を入力します。必須項目を埋めると生成できます。
      </p>

      <div className={styles.subSection}>
        {articleType === "problem" && (
          <>
            <BulletListInput
              label="解決する問題"
              value={pProblem}
              onChange={setPProblem}
              required
              hint="読者が困っていること、悩み"
              placeholder="例: note を続けたいのに3日で止まる"
            />
            <BulletListInput
              label="あなたのエピソード"
              value={pEpisode}
              onChange={setPEpisode}
              placeholder="例: 自分も最初の10本で手が止まった"
            />
            <BulletListInput
              label="問題の原因"
              value={pCause}
              onChange={setPCause}
              placeholder="例: テーマ決めと構成作りを同時にやっている"
            />
            <BulletListInput
              label="解決手段"
              value={pSolutions}
              onChange={setPSolutions}
              required
              placeholder="例: 先に型を決めて素材だけ集める"
            />
            <Field label="今日やる行動" required>
              <AutoResizeTextarea
                className={styles.input}
                value={pTodayAction}
                onChange={(e) => setPTodayAction(e.target.value)}
                placeholder="例: まず記事テーマを3つ書き出す"
                minHeight={60}
              />
            </Field>
          </>
        )}

        {articleType === "experience" && (
          <>
            <BulletListInput
              label="出来事"
              value={eEvent}
              onChange={setEEvent}
              required
              placeholder="例: 30日連続で投稿した"
            />
            <BulletListInput
              label="感情・状況"
              value={eFeelings}
              onChange={setEFeelings}
              required
              placeholder="例: 最初は毎日不安だった"
            />
            <BulletListInput
              label="気づき"
              value={eInsight}
              onChange={setEInsight}
              placeholder="例: 完璧さより投稿の型が大事だった"
            />
            <BulletListInput
              label="学び"
              value={eLearnings}
              onChange={setELearnings}
              required
              placeholder="例: 先に結論を書くと迷いにくい"
            />
            <Field label="読者への問い" optional>
              <AutoResizeTextarea
                className={styles.input}
                value={eQuestion}
                onChange={(e) => setEQuestion(e.target.value)}
                placeholder="例: あなたが続かない理由は何ですか？"
                minHeight={60}
              />
            </Field>
            <Field label="メッセージ" required>
              <AutoResizeTextarea
                className={styles.input}
                value={eMessage}
                onChange={(e) => setEMessage(e.target.value)}
                placeholder="例: 小さく始めれば継続は作れる"
                minHeight={60}
              />
            </Field>
          </>
        )}

        {articleType === "experiment" && (
          <>
            <Field label="仮説" required>
              <AutoResizeTextarea
                className={styles.input}
                value={xHypothesis}
                onChange={(e) => setXHypothesis(e.target.value)}
                placeholder="例: 記事の型を固定すると投稿が続く"
                minHeight={60}
              />
            </Field>
            <BulletListInput
              label="やったこと"
              value={xDid}
              onChange={setXDid}
              required
              placeholder="例: 3つの型だけで10本書いた"
            />
            <BulletListInput
              label="結果・現状"
              value={xResult}
              onChange={setXResult}
              required
              placeholder="例: 投稿頻度が週1から週3になった"
            />
            <BulletListInput
              label="考察"
              value={xDiscussion}
              onChange={setXDiscussion}
              required
              placeholder="例: 迷う工程が減って作業時間が短くなった"
            />
            <BulletListInput
              label="次にやること"
              value={xNextAction}
              onChange={setXNextAction}
              placeholder="例: タイトル型も固定する"
            />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowOptional((v) => !v)}
        className={`${styles.optionalToggle} ${
          showOptional ? styles.optionalToggleOpen : ""
        }`}
      >
        <span>任意項目を追加</span>
        <span className={styles.optionalText}>根拠、背景、失敗例など</span>
        <span className={styles.optionalArrow}>v</span>
      </button>

      {showOptional && (
        <div className={styles.optionalBody}>
          <BulletListInput
            label="背景"
            value={optBackground}
            onChange={setOptBackground}
            placeholder="例: 副業として note を始めた"
          />
          {articleType === "problem" && (
            <>
              <BulletListInput
                label="根拠"
                value={optEvidence}
                onChange={setOptEvidence}
                placeholder="例: 50記事投稿で検証した"
              />
              <BulletListInput
                label="失敗例"
                value={optFailures}
                onChange={setOptFailures}
                placeholder="例: AIに丸投げすると薄い記事になった"
              />
            </>
          )}
          {articleType === "experience" && (
            <>
              <BulletListInput
                label="データ"
                value={optData}
                onChange={setOptData}
                placeholder="例: PV500、保存数20"
              />
              <BulletListInput
                label="失敗"
                value={optFailureDetails}
                onChange={setOptFailureDetails}
                placeholder="例: テーマを広げすぎて読者がぼやけた"
              />
            </>
          )}
          {articleType === "experiment" && (
            <>
              <BulletListInput
                label="比較"
                value={optCompare}
                onChange={setOptCompare}
                placeholder="例: 以前は1本に3時間かかっていた"
              />
              <BulletListInput
                label="失敗例"
                value={optXFailures}
                onChange={setOptXFailures}
                placeholder="例: 型を細かくしすぎると窮屈だった"
              />
              <BulletListInput
                label="想定外"
                value={optUnexpected}
                onChange={setOptUnexpected}
                placeholder="例: コメントが増えた"
              />
            </>
          )}
        </div>
      )}

      <div className={styles.navRow}>
        <button className={styles.ghostButton} onClick={() => setStep(0)}>
          戻る
        </button>
        <button
          className={styles.primaryButton}
          onClick={handleGenerate}
          disabled={!canGenerate || loading}
        >
          {loading ? "生成中..." : "プロンプト生成"}
        </button>
      </div>
      {error && <pre className={styles.errorBox}>{error}</pre>}
    </section>
  );

  const resultStep = (
    <section className={styles.card}>
      <div className={styles.sectionLabel}>Step 3 / 3</div>
      <h2 className={styles.sectionTitle}>生成結果</h2>

      {loading && (
        <div className={styles.skeletonBox}>
          <div className={styles.skeletonText}>生成中です。数秒かかります。</div>
          <div className={styles.skeletonLine} />
          <div className={styles.skeletonLineShort} />
          <div className={styles.skeletonLineTiny} />
        </div>
      )}

      {!loading && !generatedPrompt && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>+</div>
          <p>まだ生成されていません。</p>
          <button className={styles.secondaryButton} onClick={() => setStep(1)}>
            素材を入力する
          </button>
        </div>
      )}

      {!loading && generatedPrompt && (
        <div className={styles.resultPanel}>
          <div className={styles.resultToolbar}>
            <button
              className={styles.secondaryButton}
              onClick={() => setIsEditing((v) => !v)}
            >
              {isEditing ? "編集を終了" : "編集する"}
            </button>
            <button
              className={`${styles.secondaryButton} ${
                copied ? styles.copiedFlash : ""
              }`}
              onClick={handleCopy}
            >
              {copied ? "コピー済み" : "コピー"}
            </button>
            <button
              className={styles.externalButton}
              onClick={() => window.open("https://chat.openai.com", "_blank")}
            >
              ChatGPT
            </button>
            <button
              className={styles.externalButton}
              onClick={() => window.open("https://gemini.google.com", "_blank")}
            >
              Gemini
            </button>
            <span className={styles.toolbarSpacer} />
            <button
              className={styles.greenButton}
              onClick={handleGenerateArticle}
              disabled={articleLoading || !generatedPrompt.trim()}
            >
              {articleLoading ? "生成中..." : "記事本文を生成"}
            </button>
            <button
              className={styles.secondaryButton}
              onClick={handleSaveOverwrite}
              disabled={!canSave}
            >
              {saving ? "保存中..." : "上書き保存"}
            </button>
          </div>

          <textarea
            className={`${styles.resultTextarea} ${
              isEditing ? styles.resultEditable : styles.resultReadonly
            }`}
            value={generatedPrompt}
            readOnly={!isEditing}
            onChange={(e) => {
              setGeneratedPrompt(e.target.value);
              setDirty(true);
            }}
          />

          <div className={styles.resultMeta}>
            historyId: {historyId || "-"} / deviceId:{" "}
            {deviceId ? `${deviceId.slice(0, 8)}...` : "..."} / templateId:
            note-v10
          </div>

          {notice && <div className={styles.noticeBox}>{notice}</div>}
          {error && <pre className={styles.errorBox}>{error}</pre>}
          {articleError && <pre className={styles.errorBox}>{articleError}</pre>}

          {(articleLoading || generatedArticleMarkdown) && (
            <div className={styles.articlePanel}>
              <div className={styles.tabBar}>
                <button
                  className={`${styles.tab} ${
                    resultTab === "prompt" ? styles.tabActive : ""
                  }`}
                  onClick={() => setResultTab("prompt")}
                >
                  プロンプト
                </button>
                <button
                  className={`${styles.tab} ${
                    resultTab === "article" ? styles.tabActive : ""
                  }`}
                  onClick={() => setResultTab("article")}
                >
                  記事本文
                </button>
              </div>

              {articleLoading && (
                <div className={styles.skeletonBox}>
                  <div className={styles.skeletonText}>記事本文を生成中です。</div>
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLineShort} />
                  <div className={styles.skeletonLineTiny} />
                </div>
              )}

              {!articleLoading && generatedArticleMarkdown && resultTab === "article" && (
                <>
                  <div className={styles.articleToolbar}>
                    <button
                      className={styles.secondaryButton}
                      onClick={handleCopyArticle}
                    >
                      記事本文をコピー
                    </button>
                    <span className={styles.resultMeta}>
                      article model: {articleModel || "unknown"}
                    </span>
                  </div>
                  <div className={styles.articleGrid}>
                    <div className={styles.articleInfoCard}>
                      <h3 className={styles.articleInfoTitle}>タイトル案</h3>
                      {articleTitleIdeas.length > 0 ? (
                        <ul className={styles.articleInfoList}>
                          {articleTitleIdeas.map((title, idx) => (
                            <li key={idx}>{title}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className={styles.articleInfoEmpty}>タイトル案はありません。</p>
                      )}
                    </div>
                    <div className={styles.articleInfoCard}>
                      <h3 className={styles.articleInfoTitle}>構成案</h3>
                      {articleOutline.length > 0 ? (
                        <ol className={styles.articleInfoList}>
                          {articleOutline.map((heading, idx) => (
                            <li key={idx}>{heading}</li>
                          ))}
                        </ol>
                      ) : (
                        <p className={styles.articleInfoEmpty}>構成案はありません。</p>
                      )}
                    </div>
                  </div>
                  <div className={styles.articleBodyGrid}>
                    <div>
                      <h3 className={styles.articleInfoTitle}>Markdown</h3>
                      <textarea
                        className={styles.resultTextarea}
                        value={generatedArticleMarkdown}
                        onChange={(e) => setGeneratedArticleMarkdown(e.target.value)}
                      />
                    </div>
                    <div>
                      <h3 className={styles.articleInfoTitle}>プレビュー</h3>
                      <MarkdownPreview markdown={generatedArticleMarkdown} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className={styles.navRow}>
        <button className={styles.ghostButton} onClick={() => setStep(1)}>
          素材に戻る
        </button>
        {!loading && !generatedPrompt && (
          <button
            className={styles.primaryButton}
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            プロンプト生成
          </button>
        )}
      </div>
    </section>
  );

  return (
    <>
      {showSplash && (
        <div className={styles.splash}>
          <div className={styles.splashIcon}>
            <Image
              src="/favicon.png"
              alt=""
              width={80}
              height={80}
              priority
              className={styles.splashImage}
            />
          </div>
          <svg className={styles.splashTitle} viewBox="0 0 620 90" role="img">
            <text x="310" y="62" textAnchor="middle">
              Note Prompt Builder
            </text>
          </svg>
          <div className={styles.splashSub}>記事のプロンプトを構造から作る</div>
        </div>
      )}

      <main className={`${styles.page} ${showSplash ? "" : styles.pageVisible}`}>
        <div className={styles.container}>
          <header className={styles.header}>
            <div>
              <div className={styles.brandRow}>
                <div className={styles.logoBadge}>N</div>
                <h1 className={styles.appTitle}>Note Prompt Builder</h1>
                <span className={styles.appBadge}>BETA</span>
              </div>
              <p className={styles.headerSubtitle}>
                記事の型と素材を整理して、AI へのプロンプト精度を上げるツール
              </p>
            </div>
            <div className={styles.headerActions}>
              {generatedPrompt && (
                <button className={styles.headerPrimary} onClick={() => setStep(2)}>
                  生成結果を見る
                </button>
              )}
              <Link href="/history" className={styles.headerLink}>
                履歴
              </Link>
            </div>
          </header>

          <div className={styles.stepBar}>
            {STEPS.map((label, index) => (
              <button
                key={label}
                type="button"
                className={`${styles.stepItem} ${
                  step === index ? styles.stepItemActive : ""
                } ${stepDone[index] && step !== index ? styles.stepItemDone : ""}`}
                onClick={() => setStep(index as Step)}
              >
                <span className={styles.stepNum}>
                  {stepDone[index] && step !== index ? "OK" : index + 1}
                </span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {step === 0 && basicStep}
          {step === 1 && materialStep}
          {step === 2 && resultStep}
        </div>
      </main>
    </>
  );
}
