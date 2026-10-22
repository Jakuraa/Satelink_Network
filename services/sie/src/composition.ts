// Composition root for SIE providers. Feature-flagged OFF: nothing is built unless
// SIE_OPENROUTER_ENABLED=1 AND OPENROUTER_API_KEY is present. No route calls this yet (decision S-1).
// The caller passes its env object and fetch; this module never touches process.env itself.
import { OpenRouterProvider, type FetchLike, type OpenRouterOptions } from './infrastructure/openrouter.js';

export interface SieEnv {
  readonly SIE_OPENROUTER_ENABLED?: string | undefined;
  readonly OPENROUTER_API_KEY?: string | undefined;
}

export function createOpenRouterProvider(
  env: SieEnv,
  deps: { fetch: FetchLike } & Omit<OpenRouterOptions, 'apiKey' | 'fetch'>,
): OpenRouterProvider | null {
  if (env.SIE_OPENROUTER_ENABLED !== '1') return null;
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenRouterProvider({ ...deps, apiKey });
}
