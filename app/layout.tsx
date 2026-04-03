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

  title: "Note Prompt Builder｜note記事のプロンプト自動生成アプリ",
  description:
    "note記事作成を効率化するプロンプト自動生成ツール。操作はシンプル、構成はお任せ。あなたは記事の中身だけに集中できます。",

  applicationName: "Note Prompt Builder",

  verification: {
    google: "Y0AcPbEtxQeoB8hxoucUuJzEK44aEPOUSsXKrWOme98",
  },

  openGraph: {
    title: "Note Prompt Builder｜note記事のプロンプト自動生成アプリ",
    description:
      "note記事作成を効率化するプロンプト自動生成ツール。操作はシンプル、構成はお任せ。あなたは記事の中身だけに集中できます。",
    url: "https://note-prompt-builder.vercel.app",
    siteName: "Note Prompt Builder",
    locale: "ja_JP",
    type: "website",
    images: [
      {
        url: "/ogp.png",
        width: 1200,
        height: 630,
        alt: "Note Prompt Builder｜note記事のプロンプト自動生成アプリ",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Note Prompt Builder｜note記事のプロンプト自動生成アプリ",
    description:
      "note記事作成を効率化するプロンプト自動生成ツール。操作はシンプル、構成はお任せ。あなたは記事の中身だけに集中できます。",
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