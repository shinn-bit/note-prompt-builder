"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchHistory } from "@/src/lib/api";
import styles from "./page.module.css";

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
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <h1 className={styles.title}>履歴</h1>
            <p className={styles.subtitle}>
              生成したプロンプトの一覧です。タイトルと作成日時から確認でき、
              詳細ページでは入力内容と生成結果を見返せます。
            </p>
          </div>

          <Link href="/" className={styles.linkButton}>
            ← 戻る
          </Link>
        </header>

        <section className={styles.heroCard}>
          <h2 className={styles.heroTitle}>生成したプロンプトをあとから確認</h2>
          <p className={styles.heroText}>
            過去に作成したプロンプトの流れを見返しながら、どの入力でどの出力になったかを確認できます。
            タイトルをクリックすると詳細ページへ移動します。
          </p>
        </section>

        <div className={styles.mainCard}>
          <section className={styles.cardSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>保存済みの履歴</h2>
              <p className={styles.sectionDescription}>
                新しいものから順に表示されます。
              </p>
            </div>

            {error && <pre className={styles.errorBox}>{error}</pre>}

            {!error && loading && (
              <div className={styles.loadingBox}>
                <div className={styles.loadingText}>読み込み中...</div>
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLine} style={{ width: "84%" }} />
                <div className={styles.skeletonLine} style={{ width: "68%" }} />
              </div>
            )}

            {showEmpty && (
              <div className={styles.emptyState}>
                履歴がありません。トップページでプロンプト生成すると履歴が保存されます。
              </div>
            )}

            {showList && (
              <ul className={styles.list}>
                {items.map((it) => (
                  <li key={it.historyId}>
                    <Link
                      href={`/history/${it.historyId}`}
                      className={styles.itemCard}
                    >
                      <h3 className={styles.itemTitle}>
                        {it.title || "untitled"}
                      </h3>
                      <div className={styles.itemMeta}>{it.createdAt}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}