// Generic task-step workload adapter on #609's RoutingKernel (Release A; one engine, R1).
// Every registry capability whose provider has a configured connector executes through this adapter:
// the kernel journals each phase, memoizes it under `<txId>:<PHASE>` and passes `<txId>:EXECUTE` as the
// idempotency key, so a crash + resubmit can never produce a second supplier effect.
// No money moves in the kernel (quote.cost is 0, settlement is withheld); simulated money lives in
// sim_ledger.js and is captured only after verification.

import { WorkloadAdapter, SettlementMode, ExecutionSafety } from '../vnext/kernel/interfaces.js';

export const TASK_STEP_WORKLOAD = 'task.step';

export class TaskStepAdapter extends WorkloadAdapter {
  /** connectorFor(providerId) → connector with executeStep(); resolved from the registry by the service. */
  constructor({ connectorFor }) { super(); this.connectorFor = connectorFor; }
  capabilities() { return { key: TASK_STEP_WORKLOAD, resourceTypes: ['task_step'], settlementMode: SettlementMode.POST, executionSafety: ExecutionSafety.IDEMPOTENT }; }
  async discover() { return []; }
  async quote(_req, s) { return { cost: '0', unit: 'uUSD', supplierId: s.supplierId }; }
  async execute(req, s, ctx) {
    const connector = this.connectorFor(s.supplierId);
    if (!connector) throw new Error(`[connector_missing] no connector for provider ${s.supplierId}`);
    let data;
    try { data = await connector.executeStep({ inputs: req.payload.inputs, offer: req.payload.offer, idempotencyKey: ctx.idemKey, principal: req.payer }); } catch (e) {
      // Kernel failure reasons use #609's "[code] detail" convention (parseReason); keep the connector's code.
      throw new Error(`[${String(e?.code || 'execution_failed').toLowerCase()}] ${e?.message || 'step failed'}`);
    }
    return { kind: 'task_step_result', capability_id: req.payload.capability_id, provider_id: s.supplierId, data };
  }
}
