import type { Metadata } from "next";
import { Suspense } from "react";
import { accountsEnabled, me, type AccountKey } from "@/lib/account";
import { getActiveKey, getKeys, fingerprint } from "@/lib/keys";
import { apiFetch, type ConsoleSummary } from "@/lib/api";
import { date, int, usd } from "@/lib/format";
import { Badge, Empty, Panel, Table } from "@/components/ui";
import { ConnectKey, CreateKey, RowActions } from "@/components/KeyActions";
import { AccountKeyRow, CreateAccountKey, LinkAccountKey, MigrateBanner } from "@/components/AccountKeys";
import { loadTradingDiscovery } from "@/lib/trading";
import { DevelopersWorkspace } from "@/components/DevelopersWorkspace";

export const metadata: Metadata = {
  title: "API & Developers · Satelink Trading AI",
  description: "API keys, cURL examples, schemas, and SDK integration for Satelink Trading AI.",
};

export const dynamic = "force-dynamic";

export default async function DevelopersPage() {
  const discovery = await loadTradingDiscovery();

  let keyManagementSlot: React.ReactNode = null;

  if (accountsEnabled()) {
    const [res, browserKeys] = await Promise.all([me<AccountKey[]>("/keys"), getKeys()]);
    keyManagementSlot = (
      <div className="space-y-4">
        {browserKeys.length > 0 && <MigrateBanner count={browserKeys.length} />}
        <Panel
          title={res.ok ? `Connected Account Keys (${res.data.length})` : "Keys"}
          action={<CreateAccountKey />}
        >
          {!res.ok ? (
            <Empty title="Couldn't load your keys" body="The account service didn't answer. Refresh in a moment." />
          ) : res.data.length === 0 ? (
            <Empty
              title="No API keys yet"
              body="Create an API key to invoke paper simulations and AI agent endpoints."
            />
          ) : (
            <Table head={["Key", "Name", "Tier", "Credits", "Daily cap", "Last used", ""]} numeric={[3, 4]}>
              {res.data.map((k) => (
                <AccountKeyRow key={k.id} k={k} />
              ))}
            </Table>
          )}
        </Panel>

        <Panel title="Link an existing key" className="mt-4">
          <LinkAccountKey />
        </Panel>
      </div>
    );
  } else {
    const [keys, active] = await Promise.all([getKeys(), getActiveKey()]);
    const rows = await Promise.all(
      keys.map(async (k) => ({ k, s: await apiFetch<ConsoleSummary>("/v1/console/summary", { key: k.k }) })),
    );

    keyManagementSlot = (
      <div className="space-y-4">
        <Panel
          title={`Connected Keys (${keys.length}/10)`}
          action={
            <Suspense>
              <CreateKey />
            </Suspense>
          }
        >
          {keys.length === 0 ? (
            <Empty title="No keys yet" body="Create a free key, or connect a key you already use." />
          ) : (
            <Table head={["Key", "Label", "Tier", "Plan", "Credits", "Calls this month", "Added", ""]} numeric={[4, 5]}>
              {rows.map(({ k, s }) => (
                <tr key={k.k}>
                  <td className="font-mono">
                    {fingerprint(k.k)} {k.k === active?.k && <Badge tone="good">active</Badge>}
                  </td>
                  <td>{k.label}</td>
                  <td>{s.ok ? s.data.data.tier ?? "none" : <span className="text-sl-down">unavailable</span>}</td>
                  <td className="capitalize">{s.ok ? s.data.data.plan : ""}</td>
                  <td className="text-right">{s.ok ? usd(s.data.data.balanceUsd, 4) : ""}</td>
                  <td className="text-right">{s.ok && s.data.data.usage ? int(s.data.data.usage.callsThisMonth) : ""}</td>
                  <td>{date(k.addedAt)}</td>
                  <td>
                    <RowActions fp={fingerprint(k.k)} active={k.k === active?.k} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>

        <Panel title="Connect an existing key" className="mt-4">
          <ConnectKey />
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <DevelopersWorkspace discovery={discovery} keyManagementSlot={keyManagementSlot} />
    </div>
  );
}
