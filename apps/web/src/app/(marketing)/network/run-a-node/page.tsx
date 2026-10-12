// /network/run-a-node — the node operator program is paused (Phase 7). Was: operator earnings copy.
import type { Metadata } from "next";
import { buildMetadata } from "@satelink/seo";
import { ProgramPaused } from "../ProgramPaused";

export const metadata: Metadata = {
  ...buildMetadata({ title: "Node operator program paused", description: "The node operator program is paused. Operator payouts are not active.", path: "/network/run-a-node" }),
  robots: { index: false, follow: true },
};

export default function Page() {
  return <ProgramPaused />;
}
