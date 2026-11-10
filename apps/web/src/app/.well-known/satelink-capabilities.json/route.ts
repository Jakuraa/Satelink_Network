// GET /.well-known/satelink-capabilities.json — Satelink AI Assistance capabilities, generated from the registry
// (scripts/preview/generate-public-capabilities.mjs; a test fails if it goes stale). Preview: simulated, no charges.
import { NextResponse } from "next/server";
import PREVIEW from "@/content/preview-capabilities.generated.json";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(PREVIEW, { headers: { "cache-control": "public, max-age=300, s-maxage=300" } });
}
