// Verify a customer-submitted tx hash against an on-chain invoice (Wave 1.8).
// Reads the receipt from the chain (never trusts the client): sums ERC-20 Transfer logs
// emitted by the invoice's token contract TO the invoice address. A tx that sends the
// wrong token, to another address, or on another chain simply has no matching log.
import { PaymentError } from './contract.mjs';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const topicAddr = (t) => `0x${String(t).slice(-40)}`.toLowerCase();

/**
 * @param provider  { getTransactionReceipt(hash), getBlockNumber(), getBlock(n) } (ethers v6 JsonRpcProvider shape)
 * @returns { found, from, amountRaw, confirmations, blockNumber, blockTime, logIndex }
 */
export async function verifyInvoiceTransfer(provider, { txHash, token, to }) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash ?? '')) throw new PaymentError('INVALID', 'txHash must be 0x + 64 hex');
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return { found: false, reason: 'not_found_or_pending' };
  if (receipt.status !== 1 && receipt.status !== 1n) return { found: false, reason: 'reverted' };
  let amount = 0n; let from = null; let logIndex = null;
  for (const log of receipt.logs ?? []) {
    if (String(log.address).toLowerCase() !== token.toLowerCase()) continue;
    if ((log.topics?.[0] ?? '').toLowerCase() !== TRANSFER_TOPIC) continue;
    if (topicAddr(log.topics[2]) !== to.toLowerCase()) continue;
    amount += BigInt(log.data);
    from = from ?? topicAddr(log.topics[1]);
    logIndex = logIndex ?? Number(log.index ?? log.logIndex ?? 0);
  }
  if (amount === 0n) return { found: false, reason: 'no_matching_transfer' };
  const head = await provider.getBlockNumber();
  const block = await provider.getBlock(receipt.blockNumber).catch(() => null);
  return {
    found: true, from, amountRaw: amount.toString(), logIndex,
    blockNumber: Number(receipt.blockNumber), confirmations: Math.max(0, Number(head) - Number(receipt.blockNumber) + 1),
    blockTime: block?.timestamp ? new Date(Number(block.timestamp) * 1000).toISOString() : null,
  };
}
