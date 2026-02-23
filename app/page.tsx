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

export default function Home() {
  const [theme, setTheme] = useState("");
  const [target, setTarget] = useState("");
  const [goal, setGoal] = useState("");
  const [stylePreset, setStylePreset] = useState("casual");

  const [conclusion, setConclusion] = useState("");
  const [structurePlan, setStructurePlan] = useState("");
  const [authority, setAuthority] = useState("");
  const [episodes, setEpisodes] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [referenceLinksText, setReferenceLinksText] = useState("");
  const [lengthPreset, setLengthPreset] = useState("medium");
  const [ngRules, setNgRules] = useState("");

  const [deviceId, setDeviceId] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");

  // ✅ generate結果の履歴ID（上書き保存に必要）
  const [historyId, setHistoryId] = useState<string>("");

  // ✅ UX states
  const [loading, setLoading] = useState(false); // generate中
  const [saving, setSaving] = useState(false); // 上書き保存中
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // ✅ edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE ?? "", []);

  const formLocked = loading || saving;

  const canGenerate =
    !formLocked && theme.trim() && target.trim() && goal.trim();

  const canSave =
    !formLocked && !!historyId && !!generatedPrompt.trim() && isEditing && dirty;

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    setIsEditing(false);
    setDirty(false);

    // 生成開始時点では結果を一旦空に（スケルトン表示にする）
    setGeneratedPrompt("");
    setHistoryId("");

    try {
      if (!apiBase) throw new Error("NEXT_PUBLIC_API_BASE is not set");
      if (!deviceId) throw new Error("deviceId is not ready");

      const keywords = keywordsText
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 10);

      const referenceLinks = referenceLinksText
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 10);

      const res = await fetch(`${apiBase}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          target,
          goal,
          conclusion,
          authority,
          structurePlan,
          episodes,
          keywords,
          referenceLinks,
          stylePreset,
          lengthPreset,
          ngRules,
          meta: {
            deviceId,
            templateId: "note-v9.0",
            version: "0.1.0",
          },
        }),
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

  // ✅ 上書き保存（PUT /history/{historyId}）
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
        body: JSON.stringify({
          deviceId,
          generatedPrompt,
        }),
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
        <h1>Note Prompt Builder</h1>
        <Link href="/history">履歴を見る →</Link>
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
        {/* ✅ 生成中ロック：フォーム全体 */}
        <div
          style={{
            display: "grid",
            gap: 20,
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
              placeholder="例：AWS SAA合格までにやったこと／noteを継続できない原因と対策"
            />
          </div>

          <div>
            <label>想定読者（必須）</label>
            <textarea
              style={textareaSmall}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="例：大学生のエンジニア志望／note初心者／AWS学習者"
            />
          </div>

          <div>
            <label>記事の目的（必須）</label>
            <textarea
              style={textareaSmall}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="例：読了後に今日から実行できるToDoが3つわかる状態にする"
            />
          </div>

          <div>
            <label>結論（任意）</label>
            <textarea
              style={textareaStyle}
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              placeholder={`例：
継続できない原因は「やる気不足」ではなく、
設計ミスだった。
継続は感情ではなく仕組みで作れる。`}
            />
          </div>

          <div>
            <label>構成案（任意）</label>
            <textarea
              style={textareaStyle}
              value={structurePlan}
              onChange={(e) => setStructurePlan(e.target.value)}
              placeholder={`例：
1. はじめに：2週間投稿できなかった事実
2. 結論：継続できない原因は仕組み不足
3. なぜ続かなかったのか（3つの理由）
4. 再始動のためにやった具体策
5. 30分投稿テンプレ公開
6. まとめ：今日からやること`}
            />
          </div>

          <div>
            <label>キーワード（カンマ区切り・最大10）</label>
            <input
              style={inputStyle}
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="例：note, AWS, 継続"
            />
          </div>

          <div>
            <label>文体プリセット</label>
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

          <div>
            <label>入れたいエピソード（任意）</label>
            <textarea
              style={textareaStyle}
              value={episodes}
              onChange={(e) => setEpisodes(e.target.value)}
            />
          </div>
        </div>

        {/* ✅ ボタン類はロック対象外にしてもいいが、今回は誤操作防止でdisabled */}
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
          {loading ? "生成中..." : "プロンプト生成"}
        </button>

        {/* ✅ 通知 */}
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

        {/* ✅ エラー */}
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

        {/* ✅ 生成結果エリア（スケルトン/編集/保存） */}
        <div style={{ marginTop: 20 }}>
          <h2 style={{ marginBottom: 10 }}>生成結果</h2>

          {/* スケルトン（最低限） */}
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
              まだ生成結果がありません。フォームを入力して「プロンプト生成」を押してください。
            </p>
          )}

          {!loading && generatedPrompt && (
            <>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <button
                  onClick={() => {
                    // 編集OFFに戻すときは dirty を残す（保存してないなら警告したいが、まずは単純化）
                    setIsEditing((v) => !v);
                  }}
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
                historyId: {historyId || "（未生成）"} / deviceId: {deviceId || "..."}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}