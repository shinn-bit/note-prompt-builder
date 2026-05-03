import { NextResponse } from "next/server";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.4-mini";

type OpenAIContentItem = {
  type?: string;
  text?: string;
};

type OpenAIOutputItem = {
  type?: string;
  content?: OpenAIContentItem[];
};

type OpenAIResponse = {
  output_text?: string;
  output?: OpenAIOutputItem[];
  usage?: unknown;
};

type ArticleGenerateResult = {
  titleIdeas: string[];
  outline: string[];
  articleMarkdown: string;
};

function extractOutputText(data: OpenAIResponse): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const parts =
    data.output
      ?.flatMap((item) => item.content ?? [])
      .filter((content) => content.type === "output_text" && content.text)
      .map((content) => content.text as string) ?? [];

  return parts.join("\n").trim();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArticleResult(text: string): ArticleGenerateResult | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  const parsed = JSON.parse(cleaned) as Partial<ArticleGenerateResult>;
  const articleMarkdown =
    typeof parsed.articleMarkdown === "string"
      ? parsed.articleMarkdown.trim()
      : "";

  if (!articleMarkdown) return null;

  return {
    titleIdeas: normalizeStringArray(parsed.titleIdeas),
    outline: normalizeStringArray(parsed.outline),
    articleMarkdown,
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    return NextResponse.json(
      { error: "prompt is required" },
      { status: 400 }
    );
  }

  const model = process.env.OPENAI_ARTICLE_MODEL || DEFAULT_MODEL;

  const openAiRes = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions:
        "You are an editor and writer for Japanese note.com articles. Follow the supplied prompt faithfully and write a polished Japanese article in Markdown. Return only valid JSON with exactly these keys: titleIdeas, outline, articleMarkdown. titleIdeas must be an array of Japanese title candidates. outline must be an array of Japanese heading/section candidates. articleMarkdown must contain only the article body in Markdown, excluding title ideas and outline notes. Do not wrap the JSON in code fences. Do not add commentary outside JSON.",
      input: prompt,
      max_output_tokens: 6000,
    }),
  });

  const data = await openAiRes.json().catch(() => null);

  if (!openAiRes.ok) {
    return NextResponse.json(
      {
        error: "OpenAI API request failed",
        status: openAiRes.status,
        details: data,
      },
      { status: openAiRes.status }
    );
  }

  const text = extractOutputText(data as OpenAIResponse);
  let result: ArticleGenerateResult | null = null;

  try {
    result = parseArticleResult(text);
  } catch {
    result = null;
  }

  if (!result) {
    return NextResponse.json(
      { error: "Failed to parse article generation result", details: data },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ...result,
    model,
    usage: (data as OpenAIResponse).usage ?? null,
  });
}
