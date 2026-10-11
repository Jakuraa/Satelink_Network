import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { publishedPeople } from '@/content/people';
import { Container, PageHero, ArrowLink } from '@/components/Page';
import { getMediaByCategory } from '@/content/media';

export const metadata: Metadata = {
  title: 'Founder & Leadership | Jakuraa',
  description:
    'Leadership and operational governance at Jakuraa: Pradeep Jakuraa (Founder, Systems Architect & Managing Director) and corporate directors.',
};

export default function LeadershipPage() {
  const people = publishedPeople();
  const founder = people.find((p) => p.name === 'Pradeep Jakuraa');
  const directors = people.filter((p) => p.name !== 'Pradeep Jakuraa');
  const founderMedia = getMediaByCategory('founder');

  return (
    <>
      <PageHero
        eyebrow="Company"
        title="Leadership & Governance"
        lede="The operators, systems architects, and statutory directors responsible for Jakuraa."
      />

      <Container className="pb-24">
        {/* Founder Spotlight: FOUNDER / SYSTEMS BUILDER / OPERATOR */}
        {founder && (
          <section className="mb-20 rounded-2xl border border-stone-1 bg-ivory-2/40 p-8 sm:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-5 relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-stone-2 bg-stone-1/30 shadow-md">
                <Image
                  src={founder.image || '/media/founder/pradeep-jakuraa-portrait-primary.jpg'}
                  alt={founder.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
                <div className="absolute bottom-3 left-3 right-3 rounded bg-ink/80 px-3 py-2 text-ivory backdrop-blur-sm">
                  <p className="font-serif text-sm font-medium">{founder.name}</p>
                  <p className="font-mono text-[11px] text-stone-3">
                    Founder / Systems Builder / Operator
                  </p>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-6">
                <div>
                  <span className="font-mono text-xs uppercase tracking-wider text-green">
                    FOUNDER & SYSTEMS ARCHITECT
                  </span>
                  <h2 className="mt-2 font-serif text-3xl sm:text-4xl text-ink">
                    {founder.name}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-stone-3">
                    {founder.role}
                  </p>
                </div>

                <p className="font-serif text-lg leading-relaxed text-stone-4">
                  {founder.bio}
                </p>

                <div className="space-y-3 font-sans text-sm leading-relaxed text-stone-4">
                  <p>
                    Pradeep founded Jakuraa in 2019, steering the enterprise through physical industrial
                    ventures, wholesale distribution, hardware compute clusters, and consumer retail
                    before synthesizing these lessons into Satelink: an autonomous machine commerce
                    infrastructure platform.
                  </p>
                  <p>
                    He directs system engineering, protocol specifications, and business operations,
                    maintaining that enduring technology institutions must combine technical depth
                    with the disciplined accountability of physical commerce.
                  </p>
                </div>

                {/* Operations Gallery */}
                <div className="pt-4 border-t border-stone-1">
                  <span className="font-mono text-xs uppercase tracking-wider text-stone-3 mb-3 block">
                    Operating History & Facility Documentation
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {founderMedia.slice(1, 5).map((m) => (
                      <div
                        key={m.id}
                        className="group relative aspect-[4/3] overflow-hidden rounded border border-stone-1 bg-stone-1/20"
                      >
                        <Image
                          src={m.localPath}
                          alt={m.alt}
                          fill
                          sizes="(max-width: 640px) 50vw, 25vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <span className="absolute bottom-1 left-1 rounded bg-ink/70 px-1.5 py-0.5 font-mono text-[9px] text-ivory">
                          {m.context}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-4">
                  <Link
                    href="/history"
                    className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-xs font-mono font-medium text-ivory hover:bg-stone-4 transition-colors"
                  >
                    <span>View 7-Year History Timeline</span>
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                  <a
                    href="https://satelink.network"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-stone-2 px-6 py-2.5 text-xs font-mono font-medium text-ink hover:border-ink hover:bg-ivory-2 transition-colors"
                  >
                    <span>Satelink Platform</span>
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Operating Principles & Systems Architecture */}
        <section className="mb-20">
          <div className="mb-8">
            <span className="font-mono text-xs uppercase tracking-wider text-stone-3">
              OPERATING PHILOSOPHY
            </span>
            <h3 className="mt-1 font-serif text-2xl text-ink">
              Core Institutional Principles
            </h3>
            <p className="mt-1 font-sans text-sm text-stone-4">
              The operational convictions synthesized from seven years of physical trade and software engineering.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-stone-1 bg-ivory p-6 shadow-sm">
              <span className="font-mono text-xs font-semibold text-green uppercase tracking-wider">
                01 / PHYSICAL GROUNDING
              </span>
              <h4 className="mt-2 font-serif text-lg text-ink">
                Tested Against Economic Reality
              </h4>
              <p className="mt-2 font-sans text-sm leading-relaxed text-stone-4">
                Systems architecture must not remain abstract speculation. Every protocol we build is tested against the harsh discipline of unit margins, inventory liabilities, and counter settlements.
              </p>
            </div>

            <div className="rounded-xl border border-stone-1 bg-ivory p-6 shadow-sm">
              <span className="font-mono text-xs font-semibold text-green uppercase tracking-wider">
                02 / DETERMINISTIC CLEARING
              </span>
              <h4 className="mt-2 font-serif text-lg text-ink">
                Autonomous Settlement Rails
              </h4>
              <p className="mt-2 font-sans text-sm leading-relaxed text-stone-4">
                Human-mediated commerce creates settlement bottlenecks and credit float drag. Autonomous software systems require sub-second, programmatic payment clearing directly inside HTTP requests.
              </p>
            </div>

            <div className="rounded-xl border border-stone-1 bg-ivory p-6 shadow-sm">
              <span className="font-mono text-xs font-semibold text-green uppercase tracking-wider">
                03 / CONTINUOUS EXECUTION
              </span>
              <h4 className="mt-2 font-serif text-lg text-ink">
                Institutional Independence
              </h4>
              <p className="mt-2 font-sans text-sm leading-relaxed text-stone-4">
                Operating cash flow from real-world divisions built a culture of financial self-reliance. We build technology designed for durability across decades, not quarterly hype cycles.
              </p>
            </div>
          </div>
        </section>

        {/* Operations & Team Archive */}
        <section className="mb-20">
          <div className="mb-8">
            <span className="font-mono text-xs uppercase tracking-wider text-stone-3">
              FIELD OPERATIONS ARCHIVE
            </span>
            <h3 className="mt-1 font-serif text-2xl text-ink">
              Operations & Field Collaboration
            </h3>
            <p className="mt-1 font-sans text-sm text-stone-4">
              Documentary records of technical collaboration, facility rollouts, and hardware operations across Western Tamil Nadu.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-xl border border-stone-1 bg-ivory p-3 shadow-sm">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded bg-stone-1/20">
                <Image
                  src="/media/team/jakuraa-team-office-collaboration-03.webp"
                  alt="Team collaboration in commercial workspace"
                  fill
                  sizes="(max-width: 640px) 100vw, 25vw"
                  className="object-cover"
                />
              </div>
              <div className="mt-3">
                <span className="font-mono text-[10px] text-stone-3">2020 / Head Office</span>
                <h5 className="font-serif text-sm font-medium text-ink">Facility Planning & Systems Review</h5>
                <p className="mt-1 font-sans text-xs text-stone-4">
                  Collaborative technical review during facility expansion in Coimbatore.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-stone-1 bg-ivory p-3 shadow-sm">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded bg-stone-1/20">
                <Image
                  src="/media/team/jakuraa-team-facility-operations-05.webp"
                  alt="Facility operations team coordinating during logistics shift"
                  fill
                  sizes="(max-width: 640px) 100vw, 25vw"
                  className="object-cover"
                />
              </div>
              <div className="mt-3">
                <span className="font-mono text-[10px] text-stone-3">2021 / Logistics Hub</span>
                <h5 className="font-serif text-sm font-medium text-ink">On-Site Logistics Briefing</h5>
                <p className="mt-1 font-sans text-xs text-stone-4">
                  Facility operators coordinating daily field logistics and dispatches.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-stone-1 bg-ivory p-3 shadow-sm">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded bg-stone-1/20">
                <Image
                  src="/media/team/jakuraa-team-desk-collaboration-06.webp"
                  alt="Operators reviewing commercial schedules at office desk"
                  fill
                  sizes="(max-width: 640px) 100vw, 25vw"
                  className="object-cover"
                />
              </div>
              <div className="mt-3">
                <span className="font-mono text-[10px] text-stone-3">2020 / Operations Desk</span>
                <h5 className="font-serif text-sm font-medium text-ink">Commercial Schedule Planning</h5>
                <p className="mt-1 font-sans text-xs text-stone-4">
                  Technical operators synchronizing procurement and dispatch schedules.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-stone-1 bg-ivory p-3 shadow-sm">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded bg-stone-1/20">
                <Image
                  src="/media/team/jakuraa-team-evening-operating-08.webp"
                  alt="Team members during an evening operational session"
                  fill
                  sizes="(max-width: 640px) 100vw, 25vw"
                  className="object-cover"
                />
              </div>
              <div className="mt-3">
                <span className="font-mono text-[10px] text-stone-3">2020 / Operations Center</span>
                <h5 className="font-serif text-sm font-medium text-ink">Extended Shift Operations</h5>
                <p className="mt-1 font-sans text-xs text-stone-4">
                  Late-hour operational coordination during commercial rollout.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Board of Directors */}
        <section>
          <div className="mb-8">
            <span className="font-mono text-xs uppercase tracking-wider text-stone-3">
              STATUTORY GOVERNANCE
            </span>
            <h3 className="mt-1 font-serif text-2xl text-ink">
              Board of Directors
            </h3>
            <p className="mt-1 font-sans text-sm text-stone-4">
              Registered corporate directors under the Ministry of Corporate Affairs, Government of India.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {directors.map((p) => (
              <div
                key={p.name}
                className="rounded-xl border border-stone-1 bg-ivory p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-xl text-ink">{p.name}</h4>
                  <span className="rounded bg-stone-1 px-2 py-0.5 font-mono text-xs text-stone-4">
                    {p.role}
                  </span>
                </div>
                {p.bio && (
                  <p className="mt-3 font-sans text-sm leading-relaxed text-stone-4">
                    {p.bio}
                  </p>
                )}
                <div className="mt-4 border-t border-stone-1 pt-3 text-xs font-mono text-stone-3">
                  Status: Active Statutory Director
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-16 border-t border-stone-1 pt-8 flex flex-wrap justify-between items-center gap-4">
          <ArrowLink href="/legal/company-information">
            View full statutory company filings and registration details
          </ArrowLink>
          <Link href="/history" className="text-xs font-mono text-stone-4 hover:text-ink">
            Explore 2019 - 2026 History Archive →
          </Link>
        </div>
      </Container>
    </>
  );
}
