import type { Metadata } from "next";
import { TaHeader } from "@/components/trading-agent/Parts";

export const metadata: Metadata = { title: "Log in — Satelink Trading AI" };

export default function Page() {
  return (
    <>
      <TaHeader title="Log in" lede="Satelink accounts sign in at the console. Satelink Trading AI is not switched on for any account yet." />
      <a className="text-sl-accent underline" href="https://console.satelink.network/sign-in">Go to the console sign-in</a>
    </>
  );
}
