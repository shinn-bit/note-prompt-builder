"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchHistory, fetchHistoryDetail } from "@/src/lib/api";
import styles from "./page.module.css";

type ArticleType = "problem" | "experience" | "experiment";

type HistoryItem = {
  historyId: string;
  createdAt: string;
  title: string;
  deviceId?: string;
};

type HistoryDetail = {
  historyId: string;
  createdAt: string;
  title: string;
  inputs?: {
    articleType?: string;
    primaryGoal?: string;
  };
  generatedPrompt?: string;
};

const TYPE_META: Record<
  ArticleType,
  { icon: string; label: string; className: string }
> = {
  problem: { icon: "!", label: "問題解決", className: "problem" },
  experience: { icon: "*", label: "体験共有", className: "experience" },
  experiment: { icon: "#", label: "実験ログ", className: "experiment" },
};

const PER_PAGE = 10;

function getType(detail?: HistoryDetail): ArticleType | undefined {
  const articleType = detail?.inputs?.articleType;
  return articleType === "problem" ||
    articleType === "experience" ||
    articleType === "experiment"
    ? articleType
    : undefined;
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [details, setDetails] = useState<Record<string, HistoryDetail>>({});
  const [expanded, setExpanded] = useState<string>("");
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | ArticleType>("all");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchHistory(100);
        const historyItems = res.items ?? [];
        setItems(historyItems);

        const detailResults = await Promise.allSettled(
          historyItems.map((item) => fetchHistoryDetail(item.historyId))
        );
        const nextDetails: Record<string, HistoryDetail> = {};
        detailResults.forEach((result) => {
          if (result.status === "fulfilled") {
            nextDetails[result.value.item.historyId] = result.value.item;
          }
        });
        setDetails(nextDetails);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadDetail = async (historyId: string) => {
    if (details[historyId]) return;
    setDetailLoading(historyId);
    setError("");
    try {
      const res = await fetchHistoryDetail(historyId);
      setDetails((prev) => ({ ...prev, [historyId]: res.item }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load detail");
    } finally {
      setDetailLoading("");
    }
  };

  const toggleExpand = async (historyId: string) => {
    const next = expanded === historyId ? "" : historyId;
    setExpanded(next);
    if (next) await loadDetail(next);
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1800);
  };

  const handleCopy = async (prompt: string) => {
    await navigator.clipboard.writeText(prompt);
    showNotice("コピーしました。");
  };

  const counts = useMemo(() => {
    const values = Object.values(details);
    return {
      total: items.length,
      problem: values.filter((item) => getType(item) === "problem").length,
      experience: values.filter((item) => getType(item) === "experience").length,
      experiment: values.filter((item) => getType(item) === "experiment").length,
    };
  }, [details, items.length]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const detail = details[item.historyId];
      const title = item.title || detail?.title || "untitled";
      const matchesQuery =
        !query || title.toLowerCase().includes(query.toLowerCase());
      const type = getType(detail);
      const matchesType = filterType === "all" || type === filterType;
      return matchesQuery && matchesType;
    });
  }, [details, filterType, items, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.brandRow}>
            <div className={styles.logoBadge}>N</div>
            <h1 className={styles.pageTitle}>プロンプト履歴</h1>
          </div>
          <Link href="/?skipSplash=1" className={styles.backLink}>
            作成に戻る
          </Link>
        </header>

        {!loading && !error && (
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statNum}>{counts.total}</div>
              <div className={styles.statLabel}>総生成数</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNum}>{counts.problem}</div>
              <div className={styles.statLabel}>問題解決</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNum}>{counts.experience}</div>
              <div className={styles.statLabel}>体験共有</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNum}>{counts.experiment}</div>
              <div className={styles.statLabel}>実験ログ</div>
            </div>
          </div>
        )}

        <div className={styles.searchBar}>
          <input
            className={styles.searchInput}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="タイトルで検索..."
          />
          {(["all", "problem", "experience", "experiment"] as const).map((type) => (
            <button
              key={type}
              className={`${styles.filterButton} ${
                filterType === type ? styles.filterButtonActive : ""
              }`}
              onClick={() => {
                setFilterType(type);
                setPage(1);
              }}
            >
              {type === "all" ? "すべて" : TYPE_META[type].label}
            </button>
          ))}
        </div>

        {error && <pre className={styles.errorBox}>{error}</pre>}

        {loading && (
          <div className={styles.skeletonList}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.skeletonItem}>
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLineShort} />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>+</div>
            <div className={styles.emptyTitle}>
              {query || filterType !== "all"
                ? "該当する履歴がありません"
                : "履歴がまだありません"}
            </div>
            <p className={styles.emptyDesc}>
              {query || filterType !== "all"
                ? "検索条件を変えて確認してください。"
                : "プロンプトを生成すると、ここに一覧表示されます。"}
            </p>
          </div>
        )}

        {!loading && !error && paged.length > 0 && (
          <div className={styles.historyList}>
            {paged.map((item) => {
              const detail = details[item.historyId];
              const type = getType(detail);
              const meta = type ? TYPE_META[type] : undefined;
              const isExpanded = expanded === item.historyId;
              const title = item.title || detail?.title || "untitled";

              return (
                <div key={item.historyId}>
                  <button
                    className={`${styles.historyItem} ${
                      isExpanded ? styles.historyItemExpanded : ""
                    }`}
                    onClick={() => void toggleExpand(item.historyId)}
                  >
                    <div
                      className={`${styles.itemTypeBadge} ${
                        meta ? styles[meta.className] : styles.unknown
                      }`}
                    >
                      {meta?.icon ?? "N"}
                    </div>
                    <div className={styles.itemBody}>
                      <div className={styles.itemTitle}>{title}</div>
                      <div className={styles.itemMetaRow}>
                        <span className={styles.itemDate}>{item.createdAt}</span>
                        {meta && (
                          <span
                            className={`${styles.itemTag} ${
                              styles[meta.className]
                            }`}
                          >
                            {meta.label}
                          </span>
                        )}
                        {detail?.inputs?.primaryGoal && (
                          <span className={styles.itemTag}>
                            {detail.inputs.primaryGoal}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={styles.itemArrow}>›</span>
                  </button>

                  {isExpanded && (
                    <div className={styles.itemDetail}>
                      {detailLoading === item.historyId && (
                        <div className={styles.detailLoading}>読み込み中...</div>
                      )}
                      {detail && (
                        <>
                          <div>
                            <div className={styles.detailLabel}>
                              生成プロンプト
                            </div>
                            <pre className={styles.detailPrompt}>
                              {detail.generatedPrompt || ""}
                            </pre>
                          </div>
                          <div className={styles.detailActions}>
                            <button
                              className={styles.smallButton}
                              onClick={() =>
                                void handleCopy(detail.generatedPrompt || "")
                              }
                            >
                              コピー
                            </button>
                            <button
                              className={styles.smallPrimaryButton}
                              onClick={() =>
                                window.open("https://chat.openai.com", "_blank")
                              }
                            >
                              ChatGPTで使う
                            </button>
                            <button
                              className={styles.smallPrimaryButton}
                              onClick={() =>
                                window.open("https://gemini.google.com", "_blank")
                              }
                            >
                              Geminiで使う
                            </button>
                            <span className={styles.detailId}>
                              id: {item.historyId}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageButton}
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              前へ
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`${styles.pageButton} ${
                  page === p ? styles.pageButtonActive : ""
                }`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              className={styles.pageButton}
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              次へ
            </button>
          </div>
        )}
      </div>

      {notice && <div className={styles.notice}>{notice}</div>}
    </main>
  );
}
