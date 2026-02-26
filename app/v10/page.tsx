"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  fontSize: 15,
  marginTop: 6,
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 110,
  resize: "vertical",
};

const textareaSmall: React.CSSProperties = {
  ...textareaStyle,
  minHeight: 70,
};

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

// ---------- UI parts ----------
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
      style={{
        padding: "8px 10px",
        borderRadius: 999,
        border: "1px solid " + (active ? "#2563eb" : "#d1d5db"),
        background: active ? "#eff6ff" : "white",
        color: active ? "#1d4ed8" : "#111827",
        cursor: "pointer",
        fontSize: 13,
      }}
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
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  requiredAtLeastOne?: boolean;
}) {
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
      <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
        <label style={{ fontWeight: 600 }}>{label}</label>
        {requiredAtLeastOne && (
          <span style={{ fontSize: 12, opacity: 0.7 }}>（最低1つ）</span>
        )}
        {showWarn && (
          <span style={{ fontSize: 12, color: "#b91c1c" }}>入力が必要</span>
        )}
        <button
          type="button"
          onClick={add}
          style={{
            marginLeft: "auto",
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "white",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          + 追加
        </button>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
        {value.map((line, idx) => (
          <div key={idx} style={{ display: "flex", gap: 10 }}>
            <input
              style={{ ...inputStyle, marginTop: 0 }}
              value={line}
              onChange={(e) => setAt(idx, e.target.value)}
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              style={{
                padding: "0 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "white",
                cursor: "pointer",
                fontSize: 13,
                height: 44,
                marginTop: 6,
              }}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label>{label}</label>
      <input
        style={inputStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

// ---------- types ----------
type ArticleType = "problem" | "experience" | "experiment";

type PrimaryGoalSlug =
  | "action" // 行動してもらう
  | "collect_feedback" // コメント/改善案をもらう
  | "build_trust" // 信頼/権威性の形成
  | "lead_paid" // 有料記事/商品導線
  | "fan_build"; // ファン化

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
  "個人開発者",
  "学生",
];

// ---------- main ----------
export default function V10Page() {
  // common
  const [deviceId, setDeviceId] = useState("");
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE ?? "", []);

  const [theme, setTheme] = useState("");
  const [articleType, setArticleType] = useState<ArticleType>("problem");
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoalSlug>("action");

  // targets: tags + optional detail
  const [targetTags, setTargetTags] = useState<string[]>([]);
  const [targetDetail, setTargetDetail] = useState("");

  // optional authority
  const [authority, setAuthority] = useState("");
  const [stylePreset, setStylePreset] = useState("casual");

  // materials: problem
  const [pProblem, setPProblem] = useState<string[]>([""]);
  const [pEpisode, setPEpisode] = useState<string[]>([""]);
  const [pCause, setPCause] = useState<string[]>([""]);
  const [pSolutions, setPSolutions] = useState<string[]>([""]);
  const [pTodayAction, setPTodayAction] = useState("");

  // optional: problem
  const [optEvidence, setOptEvidence] = useState<string[]>([""]);
  const [optFailures, setOptFailures] = useState<string[]>([""]);
  const [showOptional, setShowOptional] = useState(false);

  // materials: experience
  const [eEvent, setEEvent] = useState<string[]>([""]);
  const [eFeelings, setEFeelings] = useState<string[]>([""]);
  const [eInsight, setEInsight] = useState<string[]>([""]);
  const [eLearnings, setELearnings] = useState<string[]>([""]);
  const [eQuestion, setEQuestion] = useState("");
  const [eMessage, setEMessage] = useState("");

  // optional: experience
  const [optData, setOptData] = useState<string[]>([""]);
  const [optFailureDetails, setOptFailureDetails] = useState<string[]>([""]);
  const [optBackground, setOptBackground] = useState<string[]>([""]);

  // materials: experiment
  const [xHypothesis, setXHypothesis] = useState("");
  const [xDid, setXDid] = useState<string[]>([""]);
  const [xResult, setXResult] = useState<string[]>([""]);
  const [xDiscussion, setXDiscussion] = useState<string[]>([""]);
  const [xNextAction, setXNextAction] = useState<string[]>([""]);

  // optional: experiment
  const [optCompare, setOptCompare] = useState<string[]>([""]);
  const [optUnexpected, setOptUnexpected] = useState<string[]>([""]);
  const [optXFailures, setOptXFailures] = useState<string[]>([""]);

  // output + history
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [historyId, setHistoryId] = useState<string>("");

  // UX
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  const formLocked = loading || saving;

  const hasAtLeastOne = (arr: string[]) => arr.some((x) => x.trim().length > 0);

  // canGenerate: minimal strict (型別必須)
  const canGenerate = (() => {
    if (formLocked) return false;
    if (!theme.trim()) return false;
    if (!articleType) return false;
    if (!primaryGoal) return false;
    if (!stylePreset) return false;

    if (articleType === "problem") {
      if (!hasAtLeastOne(pProblem)) return false;
      if (!hasAtLeastOne(pEpisode)) return false;
      if (!hasAtLeastOne(pSolutions)) return false;
      if (!pTodayAction.trim()) return false;
      return true;
    }
    if (articleType === "experience") {
      if (!hasAtLeastOne(eEvent)) return false;
      if (!hasAtLeastOne(eFeelings)) return false;
      if (!hasAtLeastOne(eInsight)) return false;
      if (!hasAtLeastOne(eLearnings)) return false;
      if (!eQuestion.trim()) return false;
      if (!eMessage.trim()) return false;
      return true;
    }
    if (articleType === "experiment") {
      if (!xHypothesis.trim()) return false;
      if (!hasAtLeastOne(xDid)) return false;
      if (!hasAtLeastOne(xResult)) return false;
      if (!hasAtLeastOne(xDiscussion)) return false;
      if (!hasAtLeastOne(xNextAction)) return false;
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
      authority: authority.trim(), // 任意（空文字でもOK）
      stylePreset,
      meta: {
        deviceId,
        templateId: "note-v10",
        version: "0.2.0",
      },
    };

    // materials + optional (型別)
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
    <main style={{ padding: 32, maxWidth: 960, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
          <h1 style={{ margin: 0 }}>Note Prompt Builder</h1>
          <span style={{ opacity: 0.7 }}>v10</span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Link href="/">v9へ →</Link>
          <Link href="/history">履歴 →</Link>
        </div>
      </header>

      <div
        style={{
          background: "#f9fafb",
          padding: 24,
          borderRadius: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
          marginTop: 24,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 18,
            opacity: formLocked ? 0.6 : 1,
            pointerEvents: formLocked ? "none" : "auto",
          }}
        >
          <div>
            <label>記事テーマ（必須）</label>
            <textarea
              style={textareaSmall}
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="例：noteが継続できない原因／プロンプト設計のコツ"
            />
          </div>

          <div>
            <label>記事の型（必須）</label>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {(["problem", "experience", "experiment"] as ArticleType[]).map(
                (t) => (
                  <Chip
                    key={t}
                    label={
                      t === "problem"
                        ? "問題解決"
                        : t === "experience"
                        ? "体験共有"
                        : "実験ログ"
                    }
                    active={articleType === t}
                    onClick={() => setArticleType(t)}
                  />
                )
              )}
            </div>
          </div>

          <div>
            <label>主目的（必須・1つ）</label>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              🎯 主目的は1つに絞ると、記事の精度が上がります。
            </div>
            <select
              style={{ ...inputStyle, backgroundColor: "white" }}
              value={primaryGoal}
              onChange={(e) => setPrimaryGoal(e.target.value as PrimaryGoalSlug)}
            >
              {PRIMARY_GOALS.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>想定読者（タグ選択 + 任意追記）</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {TARGET_TAGS.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  active={targetTags.includes(t)}
                  onClick={() => toggleTag(t)}
                />
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <input
                style={inputStyle}
                value={targetDetail}
                onChange={(e) => setTargetDetail(e.target.value)}
                placeholder="任意：より具体的に（例：0〜10記事投稿済み、収益化に焦っている など）"
              />
            </div>
          </div>

          <div>
            <label>権威性（任意）</label>
            <textarea
              style={textareaSmall}
              value={authority}
              onChange={(e) => setAuthority(e.target.value)}
              placeholder="例：50記事検証／PVや成約の数字／一次情報／実務経験"
            />
          </div>

          <div>
            <label>文体</label>
            <select
              style={{ ...inputStyle, backgroundColor: "white" }}
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

          {/* ---------- Materials by type ---------- */}
          {articleType === "problem" && (
            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>記事材料（問題解決）</div>

              <div style={{ display: "grid", gap: 16 }}>
                <BulletListInput
                  label="解決する問題"
                  value={pProblem}
                  onChange={setPProblem}
                  requiredAtLeastOne
                  placeholder="例：毎回ゼロから考えて疲れる"
                />
                <BulletListInput
                  label="あなたのエピソード"
                  value={pEpisode}
                  onChange={setPEpisode}
                  requiredAtLeastOne
                  placeholder="例：3日で投稿が止まった"
                />
                <BulletListInput
                  label="問題の原因（任意）"
                  value={pCause}
                  onChange={setPCause}
                  placeholder="例：型が決まっていない"
                />
                <BulletListInput
                  label="解決手段"
                  value={pSolutions}
                  onChange={setPSolutions}
                  requiredAtLeastOne
                  placeholder="例：構造を固定する"
                />
                <DetailsRow
                  label="今日やる行動（必須）"
                  value={pTodayAction}
                  onChange={setPTodayAction}
                  placeholder="例：型を1つ決めて見出しだけ作る"
                />
              </div>
            </div>
          )}

          {articleType === "experience" && (
            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>記事材料（体験共有）</div>

              <div style={{ display: "grid", gap: 16 }}>
                <BulletListInput label="出来事" value={eEvent} onChange={setEEvent} requiredAtLeastOne />
                <BulletListInput label="感情・状況" value={eFeelings} onChange={setEFeelings} requiredAtLeastOne />
                <BulletListInput label="気づき" value={eInsight} onChange={setEInsight} requiredAtLeastOne />
                <BulletListInput label="学び" value={eLearnings} onChange={setELearnings} requiredAtLeastOne />
                <DetailsRow label="問い（必須）" value={eQuestion} onChange={setEQuestion} placeholder="例：なぜ続けられなかったのか？" />
                <DetailsRow label="メッセージ（必須）" value={eMessage} onChange={setEMessage} placeholder="例：継続は才能じゃなく設計" />
              </div>
            </div>
          )}

          {articleType === "experiment" && (
            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>記事材料（実験ログ）</div>

              <div style={{ display: "grid", gap: 16 }}>
                <div>
                  <label style={{ fontWeight: 600 }}>仮説（必須）</label>
                  <textarea
                    style={textareaSmall}
                    value={xHypothesis}
                    onChange={(e) => setXHypothesis(e.target.value)}
                    placeholder="例：主目的を1つに絞ると生成精度が上がる"
                  />
                </div>
                <BulletListInput label="やったこと" value={xDid} onChange={setXDid} requiredAtLeastOne />
                <BulletListInput label="結果" value={xResult} onChange={setXResult} requiredAtLeastOne />
                <BulletListInput label="考察" value={xDiscussion} onChange={setXDiscussion} requiredAtLeastOne />
                <BulletListInput label="次にやること" value={xNextAction} onChange={setXNextAction} requiredAtLeastOne />
              </div>
            </div>
          )}

          {/* ---------- Optional (collapsible) ---------- */}
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: 16 }}>
            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "white",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {showOptional ? "任意項目を閉じる" : "任意項目（根拠/失敗など）を開く"}
            </button>

            {showOptional && (
              <div style={{ marginTop: 14, display: "grid", gap: 16 }}>
                {articleType === "problem" && (
                  <>
                    <BulletListInput label="根拠（任意）" value={optEvidence} onChange={setOptEvidence} />
                    <BulletListInput label="失敗例（任意）" value={optFailures} onChange={setOptFailures} />
                  </>
                )}

                {articleType === "experience" && (
                  <>
                    <BulletListInput label="データ（任意）" value={optData} onChange={setOptData} />
                    <BulletListInput label="失敗詳細（任意）" value={optFailureDetails} onChange={setOptFailureDetails} />
                    <BulletListInput label="背景（任意）" value={optBackground} onChange={setOptBackground} />
                  </>
                )}

                {articleType === "experiment" && (
                  <>
                    <BulletListInput label="比較（任意）" value={optCompare} onChange={setOptCompare} />
                    <BulletListInput label="失敗（任意）" value={optXFailures} onChange={setOptXFailures} />
                    <BulletListInput label="想定外（任意）" value={optUnexpected} onChange={setOptUnexpected} />
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          style={{
            padding: "14px",
            borderRadius: 12,
            background: canGenerate ? "#2563eb" : "#9ca3af",
            color: "white",
            border: "none",
            fontSize: 16,
            cursor: canGenerate ? "pointer" : "not-allowed",
            marginTop: 18,
            width: "100%",
          }}
        >
          {loading ? "生成中..." : "プロンプト生成（v10）"}
        </button>

        {notice && (
          <div
            style={{
              marginTop: 12,
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              padding: 12,
              borderRadius: 12,
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}
          >
            {notice}
          </div>
        )}

        {error && (
          <pre
            style={{
              marginTop: 12,
              color: "#991b1b",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              padding: 12,
              borderRadius: 12,
              whiteSpace: "pre-wrap",
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            {error}
          </pre>
        )}

        <div style={{ marginTop: 20 }}>
          <h2 style={{ marginBottom: 10 }}>生成結果</h2>

          {loading && (
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 14,
                background: "white",
              }}
            >
              <div style={{ opacity: 0.7 }}>生成中…（数秒かかります）</div>
              <div style={{ marginTop: 10, height: 12, background: "#f3f4f6", borderRadius: 8 }} />
              <div style={{ marginTop: 8, height: 12, background: "#f3f4f6", borderRadius: 8, width: "88%" }} />
              <div style={{ marginTop: 8, height: 12, background: "#f3f4f6", borderRadius: 8, width: "72%" }} />
            </div>
          )}

          {!loading && !generatedPrompt && (
            <p style={{ opacity: 0.7 }}>
              まだ生成結果がありません。入力して「プロンプト生成（v10）」を押してください。
            </p>
          )}

          {!loading && generatedPrompt && (
            <>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <button
                  onClick={() => setIsEditing((v) => !v)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    background: "white",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  {isEditing ? "編集を終了" : "編集モード"}
                </button>

                <button
                  onClick={handleCopy}
                  disabled={!generatedPrompt.trim()}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    background: "white",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  コピー
                </button>

                <button
                  onClick={handleSaveOverwrite}
                  disabled={!canSave}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: canSave ? "#16a34a" : "#9ca3af",
                    color: "white",
                    cursor: canSave ? "pointer" : "not-allowed",
                    fontSize: 14,
                    marginLeft: "auto",
                  }}
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
                style={{ ...textareaStyle, minHeight: 360, background: "white" }}
                value={generatedPrompt}
                readOnly={!isEditing}
                onChange={(e) => {
                  setGeneratedPrompt(e.target.value);
                  setDirty(true);
                }}
              />

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                historyId: {historyId || "（未生成）"} / deviceId: {deviceId || "..."} / templateId: note-v10
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}