"use client";

import { useEffect, useState } from "react";
import { post } from "./taskClient";

export type DevKey = { key_id: string; name: string; prefix: string; scopes: string[]; rate_limit_per_min: number; created_at: string; last_used_at: string | null; revoked_at: string | null; status: "active" | "revoked"; requests_total: string; requests_today: string };
const SCOPES = ["tasks:create", "tasks:read", "tasks:approve", "receipts:read", "usage:read"] as const;
// Deterministic UTC text: identical on the server render and in the browser (no hydration mismatch).
const when = (s: string | null) => (s ? `${new Date(s).toISOString().slice(0, 16).replace("T", " ")} UTC` : "never");

async function reload(): Promise<DevKey[] | null> {
  const r = await fetch("/api/console/tasks/developer/keys", { cache: "no-store" }).catch(() => null);
  return r?.ok ? ((await r.json()) as { keys: DevKey[] }).keys : null;
}

export function DeveloperKeysPanel({ initial }: { initial: DevKey[] }) {
  const [keys, setKeys] = useState(initial);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([...SCOPES]);
  const [secret, setSecret] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null); setSecret(null);
    const r = await post<{ key: { secret: string } }>("developer/keys", { name, scopes });
    setBusy(false);
    if (!r.ok) { setErr(r.error.message); return; }
    setSecret(r.data.key.secret); setName("");
    setKeys((await reload()) ?? keys);
  }
  async function revoke(id: string) {
    const r = await post(`developer/keys/${id}/revoke`, {});
    if (!r.ok) setErr(r.error.message);
    setKeys((await reload()) ?? keys);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="rounded-md border border-sl-border bg-sl-surface p-3 text-[13px]" aria-labelledby="new-key">
        <h2 id="new-key" className="mb-2 font-medium text-sl-text">Create a key</h2>
        <label className="block text-sl-text-muted" htmlFor="key-name">Name</label>
        <input id="key-name" data-testid="key-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)}
          className="mt-1 h-9 w-full max-w-sm rounded-md border border-sl-border bg-transparent px-2 text-sl-text" />
        <fieldset className="mt-3">
          <legend className="text-sl-text-muted">Scopes</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {SCOPES.map((s) => (
              <label key={s} className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={scopes.includes(s)} data-testid={`scope-${s}`}
                  onChange={(e) => setScopes((cur) => (e.target.checked ? [...cur, s] : cur.filter((x) => x !== s)))} />
                <code>{s}</code>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={!ready || busy || !name.trim() || scopes.length === 0} data-testid="create-key"
          className="mt-3 inline-flex h-9 items-center rounded-md bg-sl-accent px-3 font-medium text-sl-accent-ink hover:bg-sl-accent-strong disabled:opacity-60">
          {busy ? "Creating…" : "Create key"}
        </button>
        {err && <p role="alert" className="mt-2">{err}</p>}
      </form>

      {secret && (
        <div role="status" className="rounded-md border border-sl-accent/50 p-3 text-[13px]" data-testid="new-key-secret">
          <p className="font-medium text-sl-text">Copy this key now — it is shown only once. Satelink stores only a hash.</p>
          <code className="mt-1 block break-all rounded bg-sl-bg px-2 py-1" data-testid="secret-value">{secret}</code>
        </div>
      )}

      {keys.length === 0 ? (
        <p className="text-[13px] text-sl-text-muted" data-testid="keys-empty">No keys yet.</p>
      ) : (
        <ul className="space-y-3" data-testid="keys-list">
          {keys.map((k) => (
            <li key={k.key_id} className="rounded-md border border-sl-border bg-sl-surface p-3 text-[13px]" data-testid={`key-${k.name}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium text-sl-text">{k.name}</h3>
                  <p className="break-all text-sl-text-muted"><code>{k.prefix}…</code> · {k.scopes.join(", ")}</p>
                </div>
                <span data-testid="key-status" className="text-sl-text-muted">{k.status}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                <div><dt className="text-sl-text-subtle">Requests today</dt><dd data-testid="key-requests-today">{k.requests_today}</dd></div>
                <div><dt className="text-sl-text-subtle">Requests total</dt><dd data-testid="key-requests-total">{k.requests_total}</dd></div>
                <div><dt className="text-sl-text-subtle">Rate limit</dt><dd>{k.rate_limit_per_min}/min</dd></div>
                <div><dt className="text-sl-text-subtle">Last used</dt><dd data-testid="key-last-used">{when(k.last_used_at)}</dd></div>
              </dl>
              {k.status === "active" && (
                <button type="button" onClick={() => revoke(k.key_id)} data-testid={`revoke-key-${k.name}`}
                  className="mt-2 inline-flex h-9 items-center rounded-md border border-sl-border px-3 font-medium hover:border-sl-warn">Revoke</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
