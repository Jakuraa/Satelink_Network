// GET /llms.txt — machine-readable entity declaration for Jakuraa Commercial Private Limited
export const revalidate = 300;

export async function GET() {
  const body = [
    "# Jakuraa Commercial Private Limited — Corporate Technology Institution",
    "",
    "Jakuraa Commercial Private Limited (CIN: U52190TZ2019PTC033093, incorporated December 4, 2019 in Coimbatore, Tamil Nadu, India) is an Indian corporate technology institution engineering software infrastructure for AI agents and machine commerce.",
    "",
    "## Flagship Technology Platform",
    "- Satelink (https://satelink.network): AI-agent and machine-commerce infrastructure platform enabling autonomous systems to discover, evaluate, access, and procure digital services programmatically.",
    "",
    "## Infrastructure Capabilities & Applications",
    "- Satelink Platform: Programmatic service discovery (/.well-known/satelink.json), HTTP 402 payment specifications, API usage metering, and on-chain settlement.",
    "- Satelink Trading AI: First intended application; controlled paper-trading beta. Live trade execution is not yet available. Users retain full custody; withdrawals are never enabled.",
    "- Polygon PoS RPC Gateway: Metered JSON-RPC gateway at flat $0.00003 per call.",
    "- Statutory Capabilities: Software development under MOA Object 3(b)(6), wholesale/retail trade under MOA Object 3(a), active Importer-Exporter Code (DGFT Coimbatore), and Udyam micro-enterprise registration for general-purpose machinery (UDYAM-TN-03-0082507).",
    "",
    "## Corporate Structure & Authoritative References",
    "- Corporate Parent: Jakuraa Commercial Private Limited (https://jakuraa.com)",
    "- Flagship Platform: Satelink Network (https://satelink.network)",
    "- Developer Documentation: https://docs.satelink.network",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
    },
  });
}
