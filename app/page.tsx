"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

const DEVICE_ID_KEY = "notePromptDeviceId";

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
    ? "（Lambdaのログ/環境変数/権限/S3キー/Dynamoを確認）"
    : status === 404
    ? "（API Gatewayのルート/ステージ/パスを確認）"
    : status === 400
    ? "（リクエストJSONの形式・必須項目を確認）"
    : status === 403
    ? "（CORS/認可/権限を確認）"
    : "";
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${styles.chip} ${active ? styles.chipActive : ""}`}
    >
      {label}
    </button>
  );
}

function BulletListInput({
  label,
  value,
  onChange,
  placeholder,
  requiredAtLeastOne,
  hint,
  tooltip,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  requiredAtLeastOne?: boolean;
  hint?: string;
  tooltip?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const setAt = (idx: number, v: string) => {
    const next = value.slice();
    next[idx] = v;
    onChange(next);
  };

  const add = () => onChange([...value, ""]);
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const nonEmptyCount = value.filter((x) => x.trim()).length;
  const showWarn = !!requiredAtLeastOne && nonEmptyCount === 0;

  return (
    <div>
      <div className={styles.fieldHeader}>
        <label className={styles.label}>{label}</label>

        {requiredAtLeastOne && (
          <span className={styles.inlineHint}>（最低1つ）</span>
        )}

        {showWarn && <span className={styles.requiredText}>入力が必要</span>}

        {tooltip && (
          <div className={styles.tooltipWrap}>
            <button
              type="button"
              className={styles.tooltipButton}
              onClick={() => setShowTooltip((v) => !v)}
              aria-label={`${label}の説明を表示`}
              title="説明を見る"
            >
              ?
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={add}
          className={styles.secondaryButton}
          style={{ marginLeft: "auto" }}
        >
          + 追加
        </button>
      </div>

      {hint && <div className={styles.fieldHint}>{hint}</div>}

      {tooltip && showTooltip && (
        <div className={styles.tooltipBox}>{tooltip}</div>
      )}

      <div className={styles.fieldGroup} style={{ marginTop: 8 }}>
        {value.map((line, idx) => (
          <div
            key={idx}
            style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}
          >
            <input
              className={styles.textInput}
              value={line}
              onChange={(e) => setAt(idx, e.target.value)}
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              className={styles.secondaryButton}
              title="削除"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailsRow({
  label,
  value,
  onChange,
  placeholder,
  hint,
  tooltip,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  tooltip?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div>
      <div className={styles.fieldHeader}>
        <label className={styles.label}>{label}</label>

        {tooltip && (
          <div className={styles.tooltipWrap}>
            <button
              type="button"
              className={styles.tooltipButton}
              onClick={() => setShowTooltip((v) => !v)}
              aria-label={`${label}の説明を表示`}
              title="説明を見る"
            >
              ?
            </button>
          </div>
        )}
      </div>

      {hint && <div className={styles.fieldHint}>{hint}</div>}

      {tooltip && showTooltip && (
        <div className={styles.tooltipBox}>{tooltip}</div>
      )}

      <input
        className={styles.textInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
type ArticleType = "problem" | "experience" | "experiment";

type PrimaryGoalSlug =
  | "action"
  | "collect_feedback"
  | "build_trust"
  | "lead_paid"
  | "fan_build";

const PRIMARY_GOALS: { slug: PrimaryGoalSlug; label: string }[] = [
  { slug: "action", label: "行動してもらう" },
  { slug: "collect_feedback", label: "感想/改善案を集める" },
  { slug: "build_trust", label: "信頼を作る" },
  { slug: "lead_paid", label: "有料/商品へ誘導" },
  { slug: "fan_build", label: "ファン化" },
];

const TARGET_TAGS = [
  "note初心者",
  "副業初心者",
  "収益化したい人",
  "継続できない人",
  "AI活用したい人",
  "学生",
  "社会人"
];

export default function HomePage() {
  const [deviceId, setDeviceId] = useState("");
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
  const [showOptional, setShowOptional] = useState(false);

  const [eEvent, setEEvent] = useState<string[]>([""]);
  const [eFeelings, setEFeelings] = useState<string[]>([""]);
  const [eInsight, setEInsight] = useState<string[]>([""]);
  const [eLearnings, setELearnings] = useState<string[]>([""]);
  const [eQuestion, setEQuestion] = useState("");
  const [eMessage, setEMessage] = useState("");

  const [optData, setOptData] = useState<string[]>([""]);
  const [optFailureDetails, setOptFailureDetails] = useState<string[]>([""]);
  const [optBackground, setOptBackground] = useState<string[]>([""]);

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

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  const formLocked = loading || saving;

  const hasAtLeastOne = (arr: string[]) => arr.some((x) => x.trim().length > 0);

  const canGenerate = (() => {
    if (formLocked) return false;
    if (!theme.trim()) return false;
    if (!articleType) return false;
    if (!primaryGoal) return false;
    if (!stylePreset) return false;

    if (articleType === "problem") {
      if (!hasAtLeastOne(pProblem)) return false;
      if (!hasAtLeastOne(pSolutions)) return false;
      if (!pTodayAction.trim()) return false;
      return true;
    }

    if (articleType === "experience") {
      if (!hasAtLeastOne(eEvent)) return false;
      if (!hasAtLeastOne(eFeelings)) return false;
      if (!hasAtLeastOne(eLearnings)) return false;
      if (!eMessage.trim()) return false;
      return true;
    }

    if (articleType === "experiment") {
      if (!xHypothesis.trim()) return false;
      if (!hasAtLeastOne(xDid)) return false;
      if (!hasAtLeastOne(xResult)) return false;
      if (!hasAtLeastOne(xDiscussion)) return false;
      return true;
    }

    return false;
  })();

  const canSave =
    !formLocked && !!historyId && !!generatedPrompt.trim() && isEditing && dirty;

  const toggleTag = (tag: string) => {
    setTargetTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const buildPayloadV10 = () => {
    const base: any = {
      theme,
      articleType,
      primaryGoal,
      targets: {
        tags: targetTags,
        detail: targetDetail.trim(),
      },
      authority: authority.trim(),
      stylePreset,
      meta: {
        deviceId,
        templateId: "note-v10",
        version: "0.2.0",
      },
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
        data: optData.filter((x) => x.trim()),
        failureDetails: optFailureDetails.filter((x) => x.trim()),
        background: optBackground.filter((x) => x.trim()),
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

    try {
      if (!apiBase) throw new Error("NEXT_PUBLIC_API_BASE is not set");
      if (!deviceId) throw new Error("deviceId is not ready");

      const payload = buildPayloadV10();

      const res = await fetch(`${apiBase}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await readErrorBody(res);
        const hint = statusHint(res.status);
        throw new Error(
          [
            `API Error`,
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
      setNotice("生成しました（履歴に保存済み）");
    } catch (e: any) {
      setError(e?.message ?? "Failed");
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
      if (!historyId) throw new Error("historyId is missing (generate first)");

      const url = `${apiBase}/history/${historyId}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, generatedPrompt }),
      });

      if (!res.ok) {
        const body = await readErrorBody(res);
        const hint = statusHint(res.status);
        throw new Error(
          [
            `Save Error`,
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
      setNotice("上書き保存しました");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    setNotice("コピーしました");
    setTimeout(() => setNotice(""), 1500);
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.brandRow}>
              <h1 className={styles.title}>Note Prompt Builder</h1>
              <span className={styles.badge}>β</span>
            </div>
            <p className={styles.subtitle}>
              note記事用のプロンプトを、型ベースで整理しながら作れるツールです。
              まずは主目的と記事材料を絞り、迷わず書き始められる状態を作ります。
            </p>
          </div>

          <div className={styles.headerActions}>
            <Link href="/history" className={styles.linkButton}>
              履歴を見る →
            </Link>
          </div>
        </header>

        <section className={styles.heroCard}>
          <h2 className={styles.heroTitle}>構造から考える、記事プロンプト作成</h2>
          <p className={styles.heroText}>
            自由記述で毎回ゼロから悩むのではなく、記事の型と材料を先に整理して、
            AIに渡すプロンプトの精度を上げることを目的にした設計です。
          </p>
        </section>

        <div className={styles.layoutGrid}>
          <div className={styles.mainCard}>
            <section className={styles.cardSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>基本設定</h2>
                <p className={styles.sectionDescription}>
                  まず記事テーマ・型・主目的・読者を決めます。ここが曖昧だと、
                  生成されるプロンプト全体の精度が落ちます。
                </p>
              </div>

              <div
                className={styles.formArea}
                style={{
                  opacity: formLocked ? 0.6 : 1,
                  pointerEvents: formLocked ? "none" : "auto",
                }}
              >
                <div>
                  <label className={styles.label}>記事テーマ（必須）</label>
                  <textarea
                    className={`${styles.textArea} ${styles.textAreaSm}`}
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="例：noteが継続できない原因／プロンプト設計のコツ"
                  />
                </div>

                <div>
                  <label className={styles.label}>記事の型（必須）</label>
                  <p className={styles.helpText}>
                    記事の流れを先に固定して、入力の負担と出力のブレを減らします。
                  </p>
                  <div className={styles.typeCardGrid}>
                    <button
                      type="button"
                      onClick={() => setArticleType("problem")}
                      className={`${styles.typeCard} ${
                        articleType === "problem" ? styles.typeCardActive : ""
                      }`}
                    >
                      <div className={styles.typeCardTitle}>問題解決型</div>
                      <div className={styles.typeCardText}>
                        課題を整理して、原因と解決策を順序立てて伝える型です。
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setArticleType("experience")}
                      className={`${styles.typeCard} ${
                        articleType === "experience" ? styles.typeCardActive : ""
                      }`}
                    >
                      <div className={styles.typeCardTitle}>体験共有型</div>
                      <div className={styles.typeCardText}>
                        出来事や感情の変化から、学びや気づきを伝える型です。
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setArticleType("experiment")}
                      className={`${styles.typeCard} ${
                        articleType === "experiment" ? styles.typeCardActive : ""
                      }`}
                    >
                      <div className={styles.typeCardTitle}>実験ログ型</div>
                      <div className={styles.typeCardText}>
                        仮説・実施・結果・考察を整理して記録する型です。
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className={styles.label}>主目的（必須・1つ）</label>
                  <p className={styles.helpText}>
                    🎯 主目的は1つに絞ると、記事の精度が上がります。
                  </p>
                  <div className={styles.goalButtonGroup}>
                    {PRIMARY_GOALS.map((g) => (
                      <button
                        key={g.slug}
                        type="button"
                        onClick={() => setPrimaryGoal(g.slug)}
                        className={`${styles.goalButton} ${
                          primaryGoal === g.slug ? styles.goalButtonActive : ""
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={styles.label}>想定読者（タグ選択 + 任意追記）</label>
                  <div className={styles.chipRow}>
                    {TARGET_TAGS.map((t) => (
                      <Chip
                        key={t}
                        label={t}
                        active={targetTags.includes(t)}
                        onClick={() => toggleTag(t)}
                      />
                    ))}
                  </div>
                  <input
                    className={styles.textInput}
                    value={targetDetail}
                    onChange={(e) => setTargetDetail(e.target.value)}
                    placeholder="任意：より具体的に（例：0〜10記事投稿済み、収益化に焦っている など）"
                  />
                </div>
                <div>
                  <div className={styles.fieldHeader}>
                    <label className={styles.label}>権威性（任意）</label>
                    <div className={styles.tooltipWrap}>
                      <button
                        type="button"
                        className={styles.tooltipButton}
                        title="説明を見る"
                        aria-label="権威性の説明を表示"
                      >
                        ?
                      </button>
                    </div>
                  </div>

                  <div className={styles.fieldHint}>経験・実績・数字など、説得力になる要素</div>

                  {/* 後で中身を書く */}
                  <div className={styles.tooltipBox} style={{ display: "none" }}>
                    TODO
                  </div>

                  <textarea
                    className={`${styles.textArea} ${styles.textAreaSm}`}
                    value={authority}
                    onChange={(e) => setAuthority(e.target.value)}
                    placeholder="例：50記事検証／PVや成約の数字／一次情報／実務経験"
                  />
                </div>

                <div>
                  <label className={styles.label}>文体</label>
                  <select
                    className={styles.select}
                    value={stylePreset}
                    onChange={(e) => setStylePreset(e.target.value)}
                  >
                    <option value="casual">casual</option>
                    <option value="logical">logical</option>
                    <option value="passionate">passionate</option>
                    <option value="friendly">friendly</option>
                    <option value="professional">professional</option>
                  </select>
                </div>
              </div>
            </section>

            <section className={styles.cardSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>記事材料</h2>
                <p className={styles.sectionDescription}>
                  型に応じて必要な材料だけを入力します。必須項目が揃っていないと、
                  実用的なプロンプトになりません。
                </p>
              </div>

              <div
                className={styles.formArea}
                style={{
                  opacity: formLocked ? 0.6 : 1,
                  pointerEvents: formLocked ? "none" : "auto",
                }}
              >
                {articleType === "problem" && (
                  <div className={styles.subCard}>
                    <h3 className={styles.subCardTitle}>記事材料（問題解決）</h3>
                    <div className={styles.fieldGroup}>
                      <BulletListInput
                        label="解決する問題"
                        value={pProblem}
                        onChange={setPProblem}
                        requiredAtLeastOne
                        hint="読者が困っていること・悩み"
                        placeholder="例：毎回ゼロから考えて疲れる"
                        tooltip={`読者が「それ自分のことだ」と感じる内容にしましょう`}
                      />
                      <BulletListInput
                        label="あなたのエピソード"
                        value={pEpisode}
                        onChange={setPEpisode}
                        hint="その問題を実際に経験した出来事"
                        placeholder="例：3日連続で記事を書こうとして挫折した"
                      />
                      <BulletListInput
                        label="問題の原因（任意）"
                        value={pCause}
                        onChange={setPCause}
                        hint="なぜその問題が起きるのか"
                        placeholder="例：ネタのストック方法がない"
                      />
                      <BulletListInput
                        label="解決手段"
                        value={pSolutions}
                        onChange={setPSolutions}
                        requiredAtLeastOne
                        hint="あなたが有効だと感じた、実際に有効だった方法"
                        placeholder="例：構造を固定する"
                      />
                      <DetailsRow
                        label="今日やる行動（必須）"
                        value={pTodayAction}
                        onChange={setPTodayAction}
                        hint="読者が今日すぐ試せること"
                        placeholder="例：型を1つ決めて見出しだけ作る"
                      />
                    </div>
                  </div>
                )}

                {articleType === "experience" && (
                  <div className={styles.subCard}>
                    <h3 className={styles.subCardTitle}>記事材料（体験共有）</h3>
                    <div className={styles.fieldGroup}>
                      <BulletListInput
                        label="出来事"
                        value={eEvent}
                        onChange={setEEvent}
                        requiredAtLeastOne
                        hint="実際に起きた出来事、体験したこと"
                        placeholder="初めてnoteを30日連続投稿した"
                      />
                      <BulletListInput
                        label="感情・状況"
                        value={eFeelings}
                        onChange={setEFeelings}
                        requiredAtLeastOne
                        hint="そのときの気持ちや自分の状況"
                        placeholder="最初は何を書けばいいか分からなかった"
                      />
                      <BulletListInput
                        label="気づき"
                        value={eInsight}
                        onChange={setEInsight}
                        hint="その瞬間に感じたこと。まだ整理されていない、直感的な発見でも構いません。"
                        placeholder="続けられないのは意志の問題ではない"
                      />
                      <BulletListInput
                        label="学び（必須）"
                        value={eLearnings}
                        onChange={setELearnings}
                        requiredAtLeastOne
                        hint="他の人にも再現できる教訓"
                        placeholder="例：継続には仕組みが必要"
                      />
                      <DetailsRow
                        label="問い（任意）"
                        value={eQuestion}
                        onChange={setEQuestion}
                        hint="読者に投げかける質問"
                        placeholder="例：あなたはなぜ続かないと思いますか？"
                        tooltip={`記事の途中や最後で使う「読者への問い」です。読者に考えさせたり共感を引き出す役割があります。`}
                      />
                      <DetailsRow
                        label="メッセージ（必須）"
                        value={eMessage}
                        onChange={setEMessage}
                        hint="あなたの体験から一番伝えたいこと"
                        placeholder="例：継続は才能ではなく設計です"
                        tooltip={`記事の結論や締めくくりに使う一文です。読者に残したい核心のメッセージを書きます。`}
                      />
                    </div>
                  </div>
                )}

                {articleType === "experiment" && (
                  <div className={styles.subCard}>
                    <h3 className={styles.subCardTitle}>記事材料（実験ログ）</h3>
                    <div className={styles.fieldGroup}>
                      <div>
                        <label className={styles.label}>仮説（必須）</label>
                        <textarea
                          className={`${styles.textArea} ${styles.textAreaSm}`}
                          value={xHypothesis}
                          onChange={(e) => setXHypothesis(e.target.value)}
                          placeholder="例：記事の型を固定すると投稿が続く"
                        />
                      </div>
                      <BulletListInput
                        label="やったこと、やっていること、これからやろうと思っていること"
                        value={xDid}
                        onChange={setXDid}
                        requiredAtLeastOne
                        placeholder="例：記事テンプレートを作成した"
                      />
                      <BulletListInput
                        label="結果、現状、見込まれる結果"
                        value={xResult}
                        onChange={setXResult}
                        requiredAtLeastOne
                        placeholder="例：投稿頻度が週1→週3になった"
                      />
                      <BulletListInput
                        label="考察"
                        value={xDiscussion}
                        onChange={setXDiscussion}
                        requiredAtLeastOne
                        hint="結果、現状、見込みの理由の分析。仮説との関係も考える"
                        placeholder="例：構造が決まると迷いが減って時間が削減できる"
                      />
                      <BulletListInput
                        label="次にやること（任意）"
                        value={xNextAction}
                        onChange={setXNextAction}
                        placeholder="例：タイトル構造を変える"
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className={styles.cardSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>任意項目</h2>
                <p className={styles.sectionDescription}>
                  数字・根拠・失敗・背景など、精度や説得力を上げたい時だけ追加します。
                </p>
              </div>

              <div
                className={styles.formArea}
                style={{
                  opacity: formLocked ? 0.6 : 1,
                  pointerEvents: formLocked ? "none" : "auto",
                }}
              >
                <div className={styles.subCard}>
                  <button
                    type="button"
                    onClick={() => setShowOptional((v) => !v)}
                    className={styles.secondaryButton}
                  >
                    {showOptional
                      ? "任意項目を閉じる"
                      : "任意項目（根拠/失敗など）を開く"}
                  </button>

                  {showOptional && (
                    <div className={styles.fieldGroup} style={{ marginTop: 16 }}>
                      {articleType === "problem" && (
                        <>
                          <BulletListInput
                            label="背景（任意）"
                            value={optBackground}
                            onChange={setOptBackground}
                            hint="この記事、あなたの前提情報"
                            placeholder="例：副業として稼ぐためにnoteを始めた、いままでAIに関する記事を書いてきた"
                          />
                          <BulletListInput
                            label="根拠（任意）"
                            value={optEvidence}
                            onChange={setOptEvidence}
                            hint="解決策が有効だと思う理由"
                            placeholder="例：この方法で50記事毎日投稿できた書いた"
                            tooltip={`データ・経験・検証結果など、「なぜこの方法が有効なのか」を補強する材料です。`}
                          />
                          <BulletListInput
                            label="失敗例（任意）"
                            value={optFailures}
                            onChange={setOptFailures}
                            hint="うまくいかなかったこと"
                            placeholder="例：AIに丸投げすると記事が薄くなった"
                            tooltip={`失敗例を書くことで、読者が同じ遠回りをしないようにできます。`}
                          />
                        </>
                      )}

                      {articleType === "experience" && (
                        <>
                          <BulletListInput
                            label="背景（任意）"
                            value={optBackground}
                            onChange={setOptBackground}
                            hint="この記事、あなたの前提情報"
                            placeholder="例：副業として稼ぐためにnoteを始めた、いままでAIに関する記事を書いてきた"
                          />
                          <BulletListInput
                            label="データ（任意）"
                            value={optData}
                            onChange={setOptData}
                            hint="数字・統計・実績など、体験を客観的に補強する情報"
                            placeholder="例：平均PV500、30記事投稿"
                          />
                          <BulletListInput
                            label="失敗（任意）"
                            value={optFailureDetails}
                            onChange={setOptFailureDetails}
                            hint="うまくいかなかった過程"
                            placeholder="例：AIに丸投げすると記事が薄くなった"
                            tooltip={`失敗例を書くことで、読者が同じ遠回りをしないようにできます。`}
                          />
                        </>
                      )}

                      {articleType === "experiment" && (
                        <>
                          <BulletListInput
                            label="背景（任意）"
                            value={optBackground}
                            onChange={setOptBackground}
                            hint="この記事、あなたの前提情報"
                            placeholder="例：副業として稼ぐためにnoteを始めた、いままでAIに関する記事を書いてきた"
                          />
                          <BulletListInput
                            label="比較（任意）"
                            value={optCompare}
                            onChange={setOptCompare}
                            hint="他の方法、考えとの違い"
                            placeholder="例：一から記事を書く方法"
                            tooltip={'他の方法や以前の状態と比較して、結果の違いを書きます'}
                          />
                          <BulletListInput
                            label="失敗例（任意）"
                            value={optXFailures}
                            onChange={setOptXFailures}
                            hint="うまくいかなかった試み"
                            placeholder="例：AIに丸投げすると記事が薄くなった"
                            tooltip={`失敗例を書くことで、読者が同じ遠回りをしないようにできます。`}
                          />
                          <BulletListInput
                            label="想定外（任意）"
                            value={optUnexpected}
                            onChange={setOptUnexpected}
                            hint="予想外の発見、気づき"
                            placeholder="例：記事の書く時間が半分になった"
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className={styles.cardSection}>
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={styles.primaryButton}
              >
                {loading ? "生成中..." : "プロンプト生成"}
              </button>

              {notice && <div className={styles.noticeBox}>{notice}</div>}

              {error && <pre className={styles.errorBox}>{error}</pre>}
            </section>

            <section className={styles.cardSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>生成結果</h2>
                <p className={styles.sectionDescription}>
                  生成されたプロンプトはそのままコピーできます。必要なら編集して上書き保存してください。
                </p>
              </div>

              {loading && (
                <div className={styles.skeletonBox}>
                  <div className={styles.skeletonText}>生成中…（数秒かかります）</div>
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLine} style={{ width: "88%" }} />
                  <div className={styles.skeletonLine} style={{ width: "72%" }} />
                </div>
              )}

              {!loading && !generatedPrompt && (
                <p className={styles.sectionDescription}>
                  まだ生成結果がありません。入力して「プロンプト生成」を押してください。
                </p>
              )}

              {!loading && generatedPrompt && (
                <div className={styles.resultCard}>
                  <div className={styles.resultToolbar}>
                    <button
                      onClick={() => setIsEditing((v) => !v)}
                      className={styles.secondaryButton}
                    >
                      {isEditing ? "編集を終了" : "編集モード"}
                    </button>

                    <button
                      onClick={handleCopy}
                      disabled={!generatedPrompt.trim()}
                      className={styles.secondaryButton}
                    >
                      コピー
                    </button>

                    <div className={styles.resultToolbarSpacer} />

                    <button
                      onClick={handleSaveOverwrite}
                      disabled={!canSave}
                      className={styles.successButton}
                      title={
                        !historyId
                          ? "先に生成して履歴IDを作ってください"
                          : !isEditing
                          ? "編集モードをONにしてください"
                          : !dirty
                          ? "編集内容がありません"
                          : ""
                      }
                    >
                      {saving ? "保存中..." : "上書き保存"}
                    </button>
                  </div>

                  <textarea
                    className={styles.resultAreaSoft}
                    value={generatedPrompt}
                    readOnly={!isEditing}
                    onChange={(e) => {
                      setGeneratedPrompt(e.target.value);
                      setDirty(true);
                    }}
                  />

                  <div className={styles.resultMeta}>
                    historyId: {historyId || "（未生成）"} / deviceId: {deviceId || "..."} /
                    templateId: note-v10
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}