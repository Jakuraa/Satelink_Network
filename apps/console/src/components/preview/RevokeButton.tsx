"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "./taskClient";

export function RevokeButton({ connectorId }: { connectorId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} data-testid={`revoke-${connectorId}`}
      onClick={async () => { setBusy(true); await post(`connections/${connectorId}/revoke`, {}); setBusy(false); router.refresh(); }}
      className="inline-flex h-9 items-center rounded-md border border-sl-border px-3 text-[13px] font-medium hover:border-sl-warn disabled:opacity-60">
      {busy ? "Revoking…" : "Revoke access"}
    </button>
  );
}
