import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プロンプト履歴一覧 | Note Prompt Builder",
  description:
    "これまでに生成したnote記事用プロンプトの履歴を確認・再利用できます。",
};

export default function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
