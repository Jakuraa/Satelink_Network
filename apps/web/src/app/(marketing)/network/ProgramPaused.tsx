// Phase 7 — replaces the old node-operator earnings pages (claims C1–C6). The program is paused;
// these routes stay reachable for old links but are noindex and out of the nav and the sitemap.
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { OPERATOR_PROGRAM_PAUSED } from "@/lib/operator-program";

export function ProgramPaused() {
  return (
    <section className="mx-auto max-w-[1000px] px-4 py-16 sm:px-6">
      <SectionHeader eyebrow="Node operators" title="Program paused" lede={OPERATOR_PROGRAM_PAUSED} align="left" />
      <p className="mt-6 max-w-[70ch] text-sl-text-muted">
        No new operators are being onboarded, nothing accrues to operators, and no operator is owed or
        promised any payment. If the program resumes, the{" "}
        <Link href="/network/operator-terms" className="underline">Node Operator Terms</Link> will be updated first.
      </p>
      <p className="mt-4 max-w-[70ch] text-sl-text-muted">
        Satelink today is <Link href="/trading-agent" className="underline">Satelink Trading AI</Link>.
      </p>
    </section>
  );
}
