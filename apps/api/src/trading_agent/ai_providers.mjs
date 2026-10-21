// Composition root for LLM providers (Phase 6 item 3). Lives OUTSIDE agent/** on purpose: the agent
// layer may not import SDKs, env or credential loaders (Stage 12 import-boundary lint). The caller
// passes API keys obtained from its secret loader; nothing here reads process.env.
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicProvider } from './agent/providers/anthropic.mjs';
import { GroqProvider } from './agent/providers/groq.mjs';
import { OpenRouterProvider } from './agent/providers/openrouter.mjs';
import { TieredModelRouter } from './agent/tiered_router.mjs';

/**
 * @param {{ anthropicApiKey?: string, groqApiKey?: string, openrouterApiKey?: string, fetch?: typeof fetch, routes?: object }} keys
 * OpenRouter is registered when its key is given but is not in DEFAULT_TIER_ROUTES: a route that uses it
 * must be passed in `routes` (a routing change is a new router config version, and its models are unpriced).
 */
export function createTieredRouter({ anthropicApiKey, groqApiKey, openrouterApiKey, fetch = globalThis.fetch, routes } = {}) {
  const providers = {};
  if (anthropicApiKey) providers.anthropic = new AnthropicProvider({ apiKey: anthropicApiKey, Anthropic });
  if (groqApiKey) providers.groq = new GroqProvider({ apiKey: groqApiKey, fetch });
  if (openrouterApiKey) providers.openrouter = new OpenRouterProvider({ apiKey: openrouterApiKey, fetch, appTitle: 'Satelink' });
  return new TieredModelRouter({ providers, ...(routes ? { routes } : {}) });
}
