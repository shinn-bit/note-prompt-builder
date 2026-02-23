"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchHistory } from "@/src/lib/api";

type HistoryItem = { historyId: string; createdAt: string; title: string };

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchHistory(30);
        setItems(res.items ?? []);
      } catch (e: any) {
        setError(e?.message ?? "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const showEmpty = !loading && !error && items.length === 0;
  const showList = !loading && !error && items.length > 0;

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <h1>履歴</h1>
        <Link href="/">← 戻る</Link>
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

      {!error && loading && (
        <p style={{ opacity: 0.7, marginTop: 12 }}>読み込み中...</p>
      )}

      {showEmpty && (
        <p style={{ opacity: 0.7, marginTop: 12 }}>
          履歴がありません。トップページでプロンプト生成すると履歴が保存されます。
        </p>
      )}

      {showList && (
        <ul style={{ paddingLeft: 18, marginTop: 12 }}>
          {items.map((it) => (
            <li key={it.historyId} style={{ marginBottom: 12 }}>
              <Link href={`/history/${it.historyId}`}>{it.title}</Link>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{it.createdAt}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}