import type { Metadata } from "next";
import Link from "next/link";
import { company, principles, registeredOfficeLine, timeline } from "@/content/company";
import { ArrowLink, Container, DefinitionList, PageHero, SectionHeading } from "@/components/Page";

export const metadata: Metadata = {
  title: "Company",
  description: `About ${company.legalName} (formerly ${company.formerName}) - history, principles and governance.`,
};

export default function CompanyPage() {
  return (
    <>
      <PageHero
        eyebrow="Company"
        title="A company built to last, and honest about where it is."
        lede={
          <p>
            {company.legalName} (formerly {company.formerName}) was incorporated in Coimbatore on {company.incorporatedDisplay}.
            Today it builds Satelink, whose flagship product is Satelink Trading AI, and holds registrations for trade,
            international trade and industrial manufacturing.
          </p>
        }
      />

      <section aria-labelledby="history" className="border-t border-stone-1 py-20">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading id="history" title="History" />
            <Link
              href="/history"
              className="font-mono text-xs text-green hover:underline uppercase tracking-wider"
            >
              Explore Complete 2019 - 2026 Archive & Timeline →
            </Link>
          </div>
          <ol className="relative mt-12 space-y-10 border-l border-stone-2 pl-8 sm:ml-40">
            {timeline.map((t) => (
              <li key={t.title} className="relative">
                <span aria-hidden="true" className="absolute -left-[37px] top-2 h-2.5 w-2.5 rounded-full border-2 border-green bg-ivory" />
                <p className="text-sm font-medium text-amber-ink sm:absolute sm:-left-48 sm:top-1 sm:w-32 sm:text-right">{t.when}</p>
                <h3 className="font-serif text-2xl">{t.title}</h3>
                <p className="mt-2 max-w-xl leading-relaxed text-stone-4">{t.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 rounded-xl border border-stone-1 bg-ivory-2/60 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-serif text-lg text-ink">Institutional History & Corporate Archive</h4>
              <p className="text-sm text-stone-4 mt-1">Read the complete operational story of Falcor Power Tools, Wholesale Syndicate supermarket, crypto mining rigs, and the road to Satelink.</p>
            </div>
            <Link
              href="/history"
              className="shrink-0 rounded-full bg-ink px-5 py-2.5 font-sans text-xs font-medium text-ivory hover:bg-stone-4 transition-colors"
            >
              View History Timeline
            </Link>
          </div>
        </Container>
      </section>

      <section aria-labelledby="principles" className="border-t border-stone-1 bg-ivory-2 py-20">
        <Container>
          <SectionHeading id="principles" title="Principles" />
          <div className="mt-12 grid gap-10 sm:grid-cols-2">
            {principles.map((p) => (
              <div key={p.title}>
                <h3 className="font-serif text-2xl">{p.title}</h3>
                <p className="mt-3 max-w-md leading-relaxed text-stone-4">{p.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section aria-labelledby="governance" className="py-20">
        <Container>
          <SectionHeading
            id="governance"
            title="Governance"
            lede="Jakuraa is a private company limited by shares, governed by its board of directors under the Companies Act, 2013 and its Articles of Association."
          />
          <div className="mt-10 max-w-3xl">
            <DefinitionList
              rows={[
                ["Legal name", company.legalName],
                ["Former name", company.formerName],
                ["Corporate Identity Number", company.cin],
                ["Incorporated", company.incorporatedDisplay],
                ["Registered office", registeredOfficeLine()],
              ]}
            />
          </div>
          <div className="mt-8 flex flex-wrap gap-6">
            <ArrowLink href="/company/leadership">Leadership</ArrowLink>
            <ArrowLink href="/legal/company-information">Full company information</ArrowLink>
          </div>
          <p className="mt-10 max-w-2xl text-sm text-stone-3">
            Looking for Satelink, our technology business? Visit <Link href="/technology" className="link-u">Technology</Link>.
          </p>
        </Container>
      </section>
    </>
  );
}
