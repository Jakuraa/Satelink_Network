"use client";

import { useEffect, useState } from "react";
import { post } from "./taskClient";

// Starts the OAuth 2.1 + PKCE flow (the verifier stays on the API) and sends the browser to the provider's consent page.
export function ConnectButton({ connectorId, returnTo, label = "Connect" }: { connectorId: string; returnTo: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" disabled={!ready || busy} data-testid={`connect-${connectorId}`}
        onClick={async () => {
          setBusy(true); setErr(null);
          const r = await post<{ authorize_url: string }>(`connections/${connectorId}/start`, { return_to: returnTo });
          if (r.ok) window.location.href = r.data.authorize_url; else { setBusy(false); setErr(r.error.message); }
        }}
        className="inline-flex h-9 items-center rounded-md bg-sl-accent px-3 text-[13px] font-medium text-sl-accent-ink hover:bg-sl-accent-strong disabled:opacity-60">
        {busy ? "Opening…" : label}
      </button>
      {err && <span role="alert" className="text-[12px]">{err}</span>}
    </span>
  );
}
