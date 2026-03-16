"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "./page.module.css";

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
    <div className={styles.sectionCard}>
      <h3 className={styles.sectionCardTitle}>{title}</h3>
      <div className={styles.sectionCardBody}>{children}</div>
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
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldValue}>
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
  const list = Array.isArray(values)
    ? values.filter((v) => String(v).trim())
    : [];

  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.listValue}>
        {list.length > 0 ? (
          <ul>
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
        <ReadonlyField
          label="記事の型"
          value={articleTypeLabel(articleType)}
        />
        <ReadonlyField
          label="主目的"
          value={goalLabel(inputs?.primaryGoal ?? "")}
        />
        <ReadonlyList label="想定読者タグ" values={targets?.tags ?? []} />
        <ReadonlyField
          label="想定読者（追記）"
          value={targets?.detail ?? ""}
        />
        <ReadonlyField label="権威性" value={inputs?.authority ?? ""} />
        <ReadonlyField label="文体" value={inputs?.stylePreset ?? ""} />
      </SectionCard>

      {articleType === "problem" && (
        <>
          <SectionCard title="記事材料（問題解決）">
            <ReadonlyList
              label="解決する問題"
              values={materials?.problem?.problem ?? []}
            />
            <ReadonlyList
              label="あなたのエピソード"
              values={materials?.problem?.episode ?? []}
            />
            <ReadonlyList
              label="問題の原因"
              values={materials?.problem?.cause ?? []}
            />
            <ReadonlyList
              label="解決手段"
              values={materials?.problem?.solutions ?? []}
            />
            <ReadonlyField
              label="今日やる行動"
              value={materials?.problem?.todayAction ?? ""}
            />
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
            <ReadonlyList
              label="出来事"
              values={materials?.experience?.event ?? []}
            />
            <ReadonlyList
              label="感情・状況"
              values={materials?.experience?.feelingsOrSituation ?? []}
            />
            <ReadonlyList
              label="気づき"
              values={materials?.experience?.insight ?? []}
            />
            <ReadonlyList
              label="学び"
              values={materials?.experience?.learnings ?? []}
            />
            <ReadonlyField
              label="問い"
              value={materials?.experience?.question ?? ""}
            />
            <ReadonlyField
              label="メッセージ"
              value={materials?.experience?.message ?? ""}
            />
          </SectionCard>

          <SectionCard title="任意項目">
            <ReadonlyList label="データ" values={optional?.data ?? []} />
            <ReadonlyList
              label="失敗詳細"
              values={optional?.failureDetails ?? []}
            />
            <ReadonlyList label="背景" values={optional?.background ?? []} />
          </SectionCard>
        </>
      )}

      {articleType === "experiment" && (
        <>
          <SectionCard title="記事材料（実験ログ）">
            <ReadonlyField
              label="仮説"
              value={materials?.experiment?.hypothesis ?? ""}
            />
            <ReadonlyList
              label="やったこと"
              values={materials?.experiment?.did ?? []}
            />
            <ReadonlyList
              label="結果"
              values={materials?.experiment?.result ?? []}
            />
            <ReadonlyList
              label="考察"
              values={materials?.experiment?.discussion ?? []}
            />
            <ReadonlyList
              label="次にやること"
              values={materials?.experiment?.nextAction ?? []}
            />
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
      <ReadonlyField
        label="権威性・一次情報"
        value={inputs?.authority ?? ""}
      />
      <ReadonlyField label="エピソード" value={inputs?.episodes ?? ""} />
      <ReadonlyField
        label="キーワード"
        value={Array.isArray(inputs?.keywords) ? inputs.keywords.join(", ") : ""}
      />
      <ReadonlyField
        label="参考リンク"
        value={
          Array.isArray(inputs?.referenceLinks)
            ? inputs.referenceLinks.join("\n")
            : ""
        }
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
        const url = `${base}/history/${historyId}?deviceId=${encodeURIComponent(
          deviceId
        )}`;

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
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <h1 className={styles.title}>履歴詳細</h1>
            <p className={styles.subtitle}>
              保存された入力内容と生成結果を確認できます。
              v10の履歴では、型ごとの材料も分けて表示します。
            </p>
          </div>

          <Link href="/history" className={styles.linkButton}>
            ← 履歴へ戻る
          </Link>
        </header>

        {error && <pre className={styles.errorBox}>{error}</pre>}

        {!error && !data && (
          <div className={styles.loadingBox}>
            <div className={styles.loadingText}>読み込み中...</div>
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonLine} style={{ width: "84%" }} />
            <div className={styles.skeletonLine} style={{ width: "68%" }} />
          </div>
        )}

        {!error && data && (
          <>
            <section className={styles.heroCard}>
              <h2 className={styles.heroTitle}>{data.title || "untitled"}</h2>
              <p className={styles.heroText}>
                この履歴で入力した情報と、生成されたプロンプトの内容を確認できます。
              </p>
              <div className={styles.metaRow}>
                <span className={styles.metaBadge}>
                  {isV10 ? "v10" : isV9 ? "v9" : "unknown"}
                </span>
                <span className={styles.metaText}>{data.createdAt}</span>
              </div>
            </section>

            <div className={styles.mainCard}>
              <section className={styles.cardSection}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>入力内容</h2>
                  <p className={styles.sectionDescription}>
                    プロンプト生成時に使われた入力情報です。
                  </p>
                </div>

                {isV10 && renderV10Inputs(inputs)}
                {isV9 && renderV9Inputs(inputs)}

                {!isV10 && !isV9 && inputs && (
                  <SectionCard title="入力内容">
                    <pre className={styles.rawBox}>
                      {JSON.stringify(inputs, null, 2)}
                    </pre>
                  </SectionCard>
                )}
              </section>

              <section className={styles.cardSection}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>生成結果</h2>
                  <p className={styles.sectionDescription}>
                    保存されているプロンプト全文です。
                  </p>
                </div>

                <div className={styles.resultCard}>
                  <textarea
                    readOnly
                    value={data.generatedPrompt}
                    className={styles.resultArea}
                  />
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}