import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { company } from "@/content/company";
import { CorporateFAQView } from "@/components/CorporateFAQView";

export const metadata: Metadata = {
  title: "Frequently Asked Questions - Jakuraa",
  description:
    "Official corporate and technology FAQ for Jakuraa Commercial Private Limited, parent company and operator of the Satelink Network.",
};

const CORPORATE_FAQS = [
  {
    category: "Corporate Institution",
    question: "What is Jakuraa Commercial Private Limited?",
    answer:
      "Jakuraa Commercial Private Limited is an Indian corporate technology company incorporated in 2019 in Coimbatore, Tamil Nadu (CIN: U51909TZ2019PTC032488). The company architects autonomous software, computing infrastructure, and machine-commerce platforms across physical and digital domains. Satelink is its flagship technology platform.",
  },
  {
    category: "Corporate Institution",
    question: "Where is Jakuraa headquartered and registered?",
    answer:
      "Jakuraa's registered office is located at 12, Palamalai Road, Samichettipalayam, Coimbatore, Tamil Nadu 641047, India. All statutory registrations (GSTIN, DGFT IEC) are maintained in full compliance with Indian corporate law.",
  },
  {
    category: "Corporate Institution",
    question: "What is the relationship between Jakuraa and Satelink?",
    answer:
      "Jakuraa Commercial Private Limited is the parent operating company, technology publisher, and legal entity behind Satelink. Satelink is Jakuraa's flagship product platform for AI-agent assistance and machine-commerce infrastructure.",
  },
  {
    category: "Satelink Platform",
    question: "What does the Satelink Platform do?",
    answer:
      "Satelink provides programmatic infrastructure for software agents to discover, evaluate, access, meter, and pay for supported digital services. It operates production Polygon PoS RPC gateways, HTTP 402 keyless payment rails on Base, and metered API endpoints.",
  },
  {
    category: "Satelink Platform",
    question: "What is the status of Satelink Trading AI?",
    answer:
      "Satelink Trading AI is in controlled paper-trading beta. Live trade execution is not yet available. AI models propose actions within deterministic risk limits and signed mandates, but Satelink never takes custody of customer funds and withdrawals are never enabled.",
  },
  {
    category: "Technology & Systems",
    question: "How do Jakuraa's systems ensure deterministic safety?",
    answer:
      "Jakuraa designs software around hard mathematical and deterministic constraints: AI models propose actions, but deterministic risk rules, signed mandates, and automated kill switches strictly decide what executes. Actions that fail any rule fail closed immediately.",
  },
  {
    category: "Technology & Systems",
    question: "What blockchains do your production systems touch?",
    answer:
      "Our live production infrastructure interacts with two verified networks: Polygon PoS (chain ID 137) for JSON-RPC traffic and smart contract revenue settlement via RevenueVaultV2, and Base L2 (chain ID 8453) for keyless HTTP 402 micropayments in USDC.",
  },
  {
    category: "Trust & Statutory",
    question: "How can I contact Jakuraa for institutional or legal inquiries?",
    answer:
      "Official correspondence can be submitted through our Contact page or directly to contact@jakuraa.com. For statutory or grievance concerns, our Grievance Officer can be reached via /legal/grievance.",
  },
];

export default function CorporateFAQPage() {
  return (
    <div className="bg-ivory text-ink min-h-screen py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Contextual Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 font-mono text-xs text-stone-4">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-ink transition-colors">
                Home
              </Link>
            </li>
            <li>/</li>
            <li className="text-green font-medium">FAQ</li>
          </ol>
        </nav>

        {/* Page Header */}
        <div className="border-b border-stone-2 pb-10">
          <span className="font-mono text-xs uppercase tracking-wider text-green font-semibold">
            Institutional Information &amp; Systems Architecture
          </span>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl font-normal tracking-tight text-ink">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-sans text-stone-4 leading-relaxed">
            Essential facts regarding Jakuraa Commercial Private Limited, our corporate origin, governance, deterministic systems architecture, and the Satelink platform.
          </p>
        </div>

        {/* Interactive Corporate FAQ View */}
        <div className="mt-12">
          <CorporateFAQView items={CORPORATE_FAQS} />
        </div>

        {/* Corporate Trust Strip */}
        <div className="mt-20 rounded-2xl border border-stone-2 bg-stone-1/40 p-8">
          <div className="grid gap-6 md:grid-cols-3 font-mono text-xs text-stone-4">
            <div>
              <span className="block font-semibold uppercase text-ink">Corporate Entity</span>
              <p className="mt-1">{company.legalName}</p>
              <p className="text-[11px] text-stone-3">CIN: {company.cin}</p>
            </div>
            <div>
              <span className="block font-semibold uppercase text-ink">Registered Office</span>
              <p className="mt-1">{company.registeredOffice.locality}, {company.registeredOffice.region}</p>
              <p className="text-[11px] text-stone-3">{company.registeredOffice.country}</p>
            </div>
            <div>
              <span className="block font-semibold uppercase text-ink">Official Direct Contact</span>
              <p className="mt-1 font-sans">{company.email}</p>
              <Link href="/contact" className="text-green underline mt-0.5 inline-block">
                Submit inquiry &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
