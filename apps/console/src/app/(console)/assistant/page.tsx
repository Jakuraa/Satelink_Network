import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { AssistantChat } from "@/components/preview/AssistantChat";
import { apiFetch } from "@/lib/api";
import { requirePreview } from "@/lib/preview";

export const metadata: Metadata = { title: "Assistant · Satelink" };
export const dynamic = "force-dynamic";

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ prompt?: string }> }) {
  requirePreview();
  // The API reports whether it routes through a live model or the fixture (no key) — the console never guesses.
  const h = await apiFetch<{ model_badge: string | null }>("/health");
  const prompt = String((await searchParams).prompt || "").slice(0, 2000); // prefill only — never auto-sent
  return (
    <>
      <PageHeader title="Assistant" lede="Say what you want done. You approve every quote before anything happens." />
      <AssistantChat badge={h.ok ? h.data.model_badge : null} initialPrompt={prompt} />
    </>
  );
}
