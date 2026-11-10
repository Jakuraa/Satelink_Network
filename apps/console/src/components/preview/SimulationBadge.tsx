// The ONE simulation marker (R10). Rendered on every order, payment, quote, reservation and receipt surface.
// data-testid lets Playwright assert it on every such screen.
export function SimulationBadge({ label = "SIMULATED — NO MONEY MOVED", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <span
      data-testid="simulation-badge"
      className="inline-flex items-center gap-1.5 rounded border border-sl-warn/60 bg-sl-warn/10 px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide text-sl-text"
      title="Preview: this is a simulation. No money moves and nothing is purchased."
    >
      <span aria-hidden className="size-1.5 rounded-full bg-sl-warn" />
      {compact ? "Simulated" : label}
    </span>
  );
}
