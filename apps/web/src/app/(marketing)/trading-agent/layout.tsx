// Satelink Trading AI public pages (Stage 26, made public in Phase 7). Every page frame carries the
// not-advice, independence and status disclosures (components/trading-agent/Parts.tsx).
import { TaFrame } from "@/components/trading-agent/Parts";

export default function TradingAgentLayout({ children }: { children: React.ReactNode }) {
  return <TaFrame>{children}</TaFrame>;
}
