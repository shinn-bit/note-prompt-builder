"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type HistoryInputs = any;

type HistoryDetail = {
  historyId: string;
  createdAt: string;
  title: string;
  generatedPrompt: string;
  inputs: HistoryInputs | null;
};

const DEVICE_ID_KEY = "notePromptDeviceId";

function getDeviceId(): string {
  const id = localStorage.getItem(DEVICE_ID_KEY);
  return id && id.length >= 8 ? id : "anonymous";
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

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 20,
        marginBottom: 18,
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 14 }}>{title}</h3>
      <div style={{ display: "grid", gap: 14 }}>{children}</div>
    </div>
  );
}

function ReadonlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div
        style={{
          width: "100%",
          minHeight: 44,
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid #d1d5db",
          background: "#f9fafb",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}
      >
        {value?.trim() ? value : "（未入力）"}
      </div>
    </div>
  );
}

function ReadonlyList({
  label,
  values,
}: {
  label: string;
  values?: string[];
}) {
  const list = Array.isArray(values) ? values.filter((v) => String(v).trim()) : [];

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid #d1d5db",
          background: "#f9fafb",
          lineHeight: 1.6,
        }}
      >
        {list.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {list.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        ) : (
          "（未入力）"
        )}
      </div>
    </div>
  );
}

function goalLabel(slug: string) {
  const map: Record<string, string> = {
    action: "行動してもらう",
    knowhow: "ノウハウを伝える",
    organize: "問題を整理してあげる",
    reduce_anxiety: "不安を減らす",
    empathy: "共感を得る",
    trust: "信頼を獲得する",
    fan: "ファン化する",
    discussion: "議論・反応を集める",
    paid_lead: "有料記事/メンバーシップに誘導する",
    try_product: "プロダクト/ツールを試してもらう",
    collect_feedback: "感想/改善案を集める",
    build_trust: "信頼を作る",
    lead_paid: "有料/商品へ誘導",
    fan_build: "ファン化",
  };
  return map[slug] ?? slug ?? "（未設定）";
}

function articleTypeLabel(type: string) {
  if (type === "problem") return "問題解決";
  if (type === "experience") return "体験共有";
  if (type === "experiment") return "実験ログ";
  return type || "（未設定）";
}

function renderV10Inputs(inputs: any) {
  const articleType = inputs?.articleType ?? "";
  const targets = inputs?.targets ?? {};
  const materials = inputs?.materials ?? {};
  const optional = inputs?.optional ?? {};

  return (
    <>
      <SectionCard title="基本情報">
        <ReadonlyField label="記事テーマ" value={inputs?.theme ?? ""} />
        <ReadonlyField label="記事の型" value={articleTypeLabel(articleType)} />
        <ReadonlyField label="主目的" value={goalLabel(inputs?.primaryGoal ?? "")} />
        <ReadonlyList label="想定読者タグ" values={targets?.tags ?? []} />
        <ReadonlyField label="想定読者（追記）" value={targets?.detail ?? ""} />
        <ReadonlyField label="権威性" value={inputs?.authority ?? ""} />
        <ReadonlyField label="文体" value={inputs?.stylePreset ?? ""} />
      </SectionCard>

      {articleType === "problem" && (
        <>
          <SectionCard title="記事材料（問題解決）">
            <ReadonlyList label="解決する問題" values={materials?.problem?.problem ?? []} />
            <ReadonlyList label="あなたのエピソード" values={materials?.problem?.episode ?? []} />
            <ReadonlyList label="問題の原因" values={materials?.problem?.cause ?? []} />
            <ReadonlyList label="解決手段" values={materials?.problem?.solutions ?? []} />
            <ReadonlyField label="今日やる行動" value={materials?.problem?.todayAction ?? ""} />
          </SectionCard>

          <SectionCard title="任意項目">
            <ReadonlyList label="根拠" values={optional?.evidence ?? []} />
            <ReadonlyList label="失敗例" values={optional?.failures ?? []} />
          </SectionCard>
        </>
      )}

      {articleType === "experience" && (
        <>
          <SectionCard title="記事材料（体験共有）">
            <ReadonlyList label="出来事" values={materials?.experience?.event ?? []} />
            <ReadonlyList label="感情・状況" values={materials?.experience?.feelingsOrSituation ?? []} />
            <ReadonlyList label="気づき" values={materials?.experience?.insight ?? []} />
            <ReadonlyList label="学び" values={materials?.experience?.learnings ?? []} />
            <ReadonlyField label="問い" value={materials?.experience?.question ?? ""} />
            <ReadonlyField label="メッセージ" value={materials?.experience?.message ?? ""} />
          </SectionCard>

          <SectionCard title="任意項目">
            <ReadonlyList label="データ" values={optional?.data ?? []} />
            <ReadonlyList label="失敗詳細" values={optional?.failureDetails ?? []} />
            <ReadonlyList label="背景" values={optional?.background ?? []} />
          </SectionCard>
        </>
      )}

      {articleType === "experiment" && (
        <>
          <SectionCard title="記事材料（実験ログ）">
            <ReadonlyField label="仮説" value={materials?.experiment?.hypothesis ?? ""} />
            <ReadonlyList label="やったこと" values={materials?.experiment?.did ?? []} />
            <ReadonlyList label="結果" values={materials?.experiment?.result ?? []} />
            <ReadonlyList label="考察" values={materials?.experiment?.discussion ?? []} />
            <ReadonlyList label="次にやること" values={materials?.experiment?.nextAction ?? []} />
          </SectionCard>

          <SectionCard title="任意項目">
            <ReadonlyList label="比較" values={optional?.compare ?? []} />
            <ReadonlyList label="失敗" values={optional?.failures ?? []} />
            <ReadonlyList label="想定外" values={optional?.unexpected ?? []} />
          </SectionCard>
        </>
      )}
    </>
  );
}

function renderV9Inputs(inputs: any) {
  return (
    <SectionCard title="入力内容（v9）">
      <ReadonlyField label="記事テーマ" value={inputs?.theme ?? ""} />
      <ReadonlyField label="想定読者" value={inputs?.target ?? ""} />
      <ReadonlyField label="記事の目的" value={inputs?.goal ?? ""} />
      <ReadonlyField label="結論" value={inputs?.conclusion ?? ""} />
      <ReadonlyField label="構成案" value={inputs?.structurePlan ?? ""} />
      <ReadonlyField label="権威性・一次情報" value={inputs?.authority ?? ""} />
      <ReadonlyField label="エピソード" value={inputs?.episodes ?? ""} />
      <ReadonlyField
        label="キーワード"
        value={Array.isArray(inputs?.keywords) ? inputs.keywords.join(", ") : ""}
      />
      <ReadonlyField
        label="参考リンク"
        value={Array.isArray(inputs?.referenceLinks) ? inputs.referenceLinks.join("\n") : ""}
      />
      <ReadonlyField label="文体" value={inputs?.stylePreset ?? ""} />
      <ReadonlyField label="文字数感" value={inputs?.lengthPreset ?? ""} />
      <ReadonlyField label="NG事項" value={inputs?.ngRules ?? ""} />
    </SectionCard>
  );
}

export default function HistoryDetailPage() {
  const params = useParams();
  const historyId = params?.id as string;

  const [data, setData] = useState<HistoryDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE;
        if (!base) throw new Error("NEXT_PUBLIC_API_BASE is not set");
        if (!historyId) throw new Error("historyId is missing");

        const deviceId = getDeviceId();
        const url = `${base}/history/${historyId}?deviceId=${encodeURIComponent(deviceId)}`;

        const res = await fetch(url);
        if (!res.ok) {
          const body = await readErrorBody(res);
          throw new Error(
            [
              "History Detail API Error",
              `URL: ${url}`,
              `Status: ${res.status} ${res.statusText}`,
              body ? `Body:\n${body}` : "",
            ]
              .filter(Boolean)
              .join("\n")
          );
        }

        const json = await res.json();
        const item = json?.item ?? json;

        setData({
          historyId: item.historyId ?? historyId,
          createdAt: item.createdAt ?? "",
          title: item.title ?? "",
          generatedPrompt: item.generatedPrompt ?? "",
          inputs: item.inputs ?? null,
        });
      } catch (e: any) {
        setError(e?.message ?? "Failed");
      }
    })();
  }, [historyId]);

  const inputs = data?.inputs ?? null;
  const templateId = inputs?.meta?.templateId ?? "";
  const isV10 = templateId === "note-v10" || templateId === "note-v10.0";
  const isV9 = templateId === "note-v9.0";

  return (
    <main style={{ maxWidth: 980, margin: "40px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>履歴詳細</h1>
        <Link href="/history">← 戻る</Link>
      </div>

      {error && (
        <pre
          style={{
            background: "#fef2f2",
            color: "#7f1d1d",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #fecaca",
            whiteSpace: "pre-wrap",
            fontSize: 13,
            lineHeight: 1.4,
            marginBottom: 16,
          }}
        >
          {error}
        </pre>
      )}

      {!error && !data && <p style={{ opacity: 0.7 }}>読み込み中...</p>}

      {!error && data && (
        <>
          <h2 style={{ marginTop: 16 }}>{data.title || "untitled"}</h2>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 20 }}>{data.createdAt}</div>

          {isV10 && renderV10Inputs(inputs)}
          {isV9 && renderV9Inputs(inputs)}

          {!isV10 && !isV9 && inputs && (
            <SectionCard title="入力内容">
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {JSON.stringify(inputs, null, 2)}
              </pre>
            </SectionCard>
          )}

          <SectionCard title="生成結果">
            <textarea
              readOnly
              value={data.generatedPrompt}
              style={{
                width: "100%",
                minHeight: 360,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #d1d5db",
                fontSize: 14,
                lineHeight: 1.5,
                background: "#fff",
              }}
            />
          </SectionCard>
        </>
      )}
    </main>
  );
}