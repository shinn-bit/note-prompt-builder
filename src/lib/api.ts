// src/lib/api.ts
import { getOrCreateDeviceId } from "./deviceId";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

if (!API_BASE) {
  // ビルド時に気づけるように
  console.warn("NEXT_PUBLIC_API_BASE is not set");
}

export type GenerateInput = {
  theme: string;
  target: string;
  goal: string;
  stylePreset: "casual" | "logical" | "passionate" | "friendly" | "professional";
  conclusion?: string;
  authority?: string;
  structurePlan?: string;
  episodes?: string;
  keywords?: string[];
  referenceLinks?: string[];
  lengthPreset?: "short" | "medium" | "long";
  ngRules?: string;
};

export async function generatePrompt(input: GenerateInput) {
  const deviceId = getOrCreateDeviceId();

  const payload = {
    ...input,
    meta: {
      deviceId,
      templateId: "note-v9.0"
    }
  };

  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`generate failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<{ historyId: string; createdAt: string; generatedPrompt: string }>;
}

export async function fetchHistory(limit = 30) {
  const deviceId = getOrCreateDeviceId();

  const url = new URL(`${API_BASE}/history`);
  url.searchParams.set("deviceId", deviceId);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), { method: "GET" });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`history failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<{
    items: { historyId: string; createdAt: string; title: string; deviceId: string }[];
  }>;
}

export async function fetchHistoryDetail(historyId: string) {
  const res = await fetch(`${API_BASE}/history/${historyId}`, { method: "GET" });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`history detail failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<{
    item: {
      historyId: string;
      createdAt: string;
      title: string;
      deviceId: string;
      inputs: any;
      generatedPrompt: string;
    };
  }>;
}
