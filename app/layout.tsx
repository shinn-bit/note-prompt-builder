import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://note-prompt-builder.vercel.app"),

  title: "Note Prompt Builder",
  description:
    "note記事作成用のプロンプトを生成・保存・編集できるWebアプリ",

  applicationName: "Note Prompt Builder",

  openGraph: {
    title: "Note Prompt Builder",
    description:
      "note記事作成用のプロンプトを生成・保存・編集できるWebアプリ",
    url: "https://note-prompt-builder.vercel.app",
    siteName: "Note Prompt Builder",
    locale: "ja_JP",
    type: "website",
    images: [
      {
        url: "/ogp.png",
        width: 1200,
        height: 630,
        alt: "Note Prompt Builder",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Note Prompt Builder",
    description:
      "note記事作成用のプロンプトを生成・保存・編集できるWebアプリ",
    images: ["/ogp.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}