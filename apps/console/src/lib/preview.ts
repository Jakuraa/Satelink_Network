// Release A preview (local only): flag, server-side API client and shared types for the task engine pages.
// The flag is OFF unless SATELINK_PREVIEW=1 — production console behaviour is unchanged.
import { notFound } from "next/navigation";
import { apiFetch, type ApiResult } from "./api";
import { authCookieHeader } from "./session";

export function previewEnabled(): boolean {
  return process.env.SATELINK_PREVIEW === "1";
}

export function requirePreview(): void {
  if (!previewEnabled()) notFound();
}

/** Server-side call to the preview task API with the user's session (and the console CSRF header). */
export async function taskApi<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<ApiResult<T>> {
  const cookie = await authCookieHeader();
  return apiFetch<T>(`/v1${path}`, { cookie, method: init.method || "GET", body: init.body, headers: { "X-Satelink-Console": "1" } });
}

export * from "./preview-shared";
