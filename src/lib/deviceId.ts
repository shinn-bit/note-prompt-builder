// src/lib/deviceId.ts
export const DEVICE_ID_KEY = "notePromptDeviceId";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    // SSR中は触れない。呼ぶ側で client-only にする
    return "";
  }

  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing && existing.length >= 8) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}
