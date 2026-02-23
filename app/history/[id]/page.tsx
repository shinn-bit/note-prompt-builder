"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type HistoryDetail = {
  historyId: string;
  createdAt: string;
  title: string;
  generatedPrompt: string;
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
              body ? `Body:\n${body}` : ""
            ]
              .filter(Boolean)
              .join("\n")
          );
        }

        const json = await res.json();
        // APIの返しが {item: {...}} 形式でも吸収
        const item = json?.item ?? json;

        setData({
          historyId: item.historyId ?? historyId,
          createdAt: item.createdAt ?? "",
          title: item.title ?? "",
          generatedPrompt: item.generatedPrompt ?? ""
        });
      } catch (e: any) {
        setError(e?.message ?? "Failed");
      }
    })();
  }, [historyId]);

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
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
            marginBottom: 16
          }}
        >
          {error}
        </pre>
      )}

      {!error && !data && <p style={{ opacity: 0.7 }}>読み込み中...</p>}

      {!error && data && (
        <>
          <h2 style={{ marginTop: 16 }}>{data.title || "untitled"}</h2>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 16 }}>
            {data.createdAt}
          </div>

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
              lineHeight: 1.5
            }}
          />
        </>
      )}
    </main>
  );
}