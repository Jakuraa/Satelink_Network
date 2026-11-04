import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { requirePreview } from "@/lib/preview";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = { title: "Welcome · Satelink" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  requirePreview();
  const session = await getSession();
  if (!session) redirect("/sign-in?next=%2Fonboarding");
  return (
    <main className="flex min-h-screen items-start justify-center bg-sl-bg px-4 py-10 text-[14px] text-sl-text">
      <div className="w-full max-w-xl space-y-5">
        <header>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-sl-text-subtle">Satelink AI Assistance · Preview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Welcome, {session.user.name || session.user.email}</h1>
        </header>
        <OnboardingForm />
      </div>
    </main>
  );
}
