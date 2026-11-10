// Browser-side calls to the console proxy (same origin → the guard's origin check passes).
import type { Task } from "@/lib/preview-shared";

export type ApiError = { code: string; message: string; retryable: boolean; correlation_id?: string };
export async function post<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  try {
    const r = await fetch(`/api/console/tasks/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.ok !== false) return { ok: true, data: j as T };
    return { ok: false, error: j?.error && typeof j.error === "object" ? j.error : { code: String(j?.error || r.status), message: j?.message || "Request failed.", retryable: r.status >= 500 } };
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "Network error — check that the preview API is running.", retryable: true } };
  }
}
export async function getTask(id: string): Promise<Task | null> {
  const r = await fetch(`/api/console/tasks/tasks/${id}`, { cache: "no-store" }).catch(() => null);
  if (!r?.ok) return null;
  return ((await r.json()) as { task: Task }).task;
}
export const newKey = (prefix: string) => `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

/** Exact micro-USD string → "0.000123" (BigInt, never a float — R4). */
export function formatMicros(minor: string | number | undefined): string {
  const m = BigInt(String(minor ?? "0").replace(/[^0-9]/g, "") || "0");
  return `${m / 1_000_000n}.${(m % 1_000_000n).toString().padStart(6, "0")}`;
}
