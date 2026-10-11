// Internal / unfinished surfaces (Phase 7): /builder*, /distributor*, /design, /styleguide.
// Production (VERCEL_ENV=production) answers 404; every other environment serves them with
// X-Robots-Tag noindex. They are never in the sitemap and are disallowed in robots.ts.
// Edge-safe (imported by middleware).

export const INTERNAL_SURFACE = /^\/(builder|distributor)(\/|$)|^\/(design|styleguide)\/?$/;

export function isInternalSurface(pathname: string): boolean {
  return INTERNAL_SURFACE.test(pathname);
}

export function isProductionDeploy(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "production";
}
