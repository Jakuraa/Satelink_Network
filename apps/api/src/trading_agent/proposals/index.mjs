// Proposal review queue (Phase 6 item 13).
export const DOMAIN = 'proposals';
export const TABLES = Object.freeze(['trading_proposals', 'trading_proposal_events']);
export { ProposalService } from './service.mjs';
export { InMemoryProposalStore, PgProposalStore } from './store.mjs';
export { createAssistant, validateIntent } from './assistant.mjs';
