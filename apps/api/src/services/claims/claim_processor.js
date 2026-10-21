import { ethers } from 'ethers';
import { logger } from '../../monitoring/logger.js';

/**
 * Pull Model Claim Processor
 * Generates EIP-712 signed messages for node operators to claim rewards.
 * Node operators submit the signature to ClaimsContract.claim() and pay their own gas.
 */

const CLAIM_SIGNATURE_EXPIRY_HOURS = 48;
const MIN_CLAIM_THRESHOLD_USDT = 1.0;

/**
 * Generate an EIP-712 signed claim message for a node operator.
 * The operator submits this signature to the ClaimsContract to claim rewards.
 * @param {string} nodeId - Node identifier
 * @param {string} walletAddress - Destination wallet (checksummed)
 * @param {import('pg').Pool} pool - PostgreSQL pool
 * @returns {Promise<object>} Signed claim data
 */
export async function generateClaimSignature(nodeId, walletAddress, pool) {
    // Defence in depth (W1): every caller, mounted or not, refuses while settlement is in
    // dry-run. Anything other than the exact string '0' counts as dry-run.
    if (process.env.SETTLEMENT_DRY_RUN !== '0') {
        throw new Error('settlement_dry_run: claim signing is disabled');
    }
    const client = await pool.connect();
    let broken;

    try {
        // Ensure claims table exists (before the pending-claim check reads it). Two first-ever
        // concurrent creates can collide in the catalog (23505 / 42P07 / 42710): the table exists then.
        await client.query(`
            CREATE TABLE IF NOT EXISTS claims (
                claim_id TEXT PRIMARY KEY,
                node_id TEXT NOT NULL,
                wallet TEXT NOT NULL,
                amount_usdt NUMERIC(18,8) NOT NULL,
                signature TEXT NOT NULL,
                nonce BIGINT NOT NULL,
                expiry BIGINT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                tx_hash TEXT,
                created_at BIGINT NOT NULL,
                updated_at BIGINT,
                claimed_at BIGINT
            )
        `).catch((e) => { if (!['23505', '42P07', '42710'].includes(e.code)) throw e; });

        // One signature per unpaid balance (W1 follow-up). The contract only rejects a reused
        // nonce, and every signing mints a fresh nonce, so two signatures over the same
        // earnings are both redeemable. Rules:
        // - Earnings match the node id OR the wallet, so the identifier set {nodeId, wallet}
        //   (lowercased) is locked — one advisory lock per identifier, sorted (no deadlock) —
        //   and an open claim on ANY identifier blocks (a wallet passed as a node id too).
        // - Refused while any claim is 'pending', expired ones included: nothing records an
        //   on-chain redemption automatically, so it must be reconciled first.
        // - The signed amount is exactly the rows reserved here (UNPAID → CLAIMING); completion
        //   flips only those to CLAIMED, so earnings accrued after signing are never swept.
        // - No revenue_events_v2 fallback: it re-signed a node's lifetime revenue after every
        //   reconciliation (nothing consumed it). No reserved earnings → nothing claimable.
        const ids = [...new Set([nodeId, walletAddress].filter(Boolean).map((x) => String(x).toLowerCase()))].sort();
        await client.query('BEGIN');
        for (const id of ids) {
            await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`claims:id:${id}`]);
        }
        const pending = await client.query(
            `SELECT claim_id FROM claims
             WHERE (lower(node_id) = ANY($1::text[]) OR lower(wallet) = ANY($1::text[])) AND status = 'pending' LIMIT 1`,
            [ids]
        );
        if (pending.rows.length > 0) {
            const err = new Error(`claim_pending_reconciliation: claim ${pending.rows[0].claim_id} must be reconciled before a new signature`);
            err.code = 'claim_pending_reconciliation';
            throw err;
        }

        // Reserve exactly what this signature pays (rolled back with everything else on error).
        const reserved = await client.query(
            `WITH r AS (
                UPDATE epoch_earnings SET status = 'CLAIMING'
                 WHERE lower(wallet_or_node_id) = ANY($1::text[]) AND status = 'UNPAID'
                 RETURNING amount_usdt
             )
             SELECT trunc(COALESCE(SUM(amount_usdt), 0), 6)::text AS claimable FROM r -- never round a payout up
            `,
            [ids]
        );
        const claimable = parseFloat(reserved.rows[0]?.claimable || 0);

        if (claimable < MIN_CLAIM_THRESHOLD_USDT) {
            throw new Error(`Minimum ${MIN_CLAIM_THRESHOLD_USDT} USDT required. Available: ${claimable.toFixed(6)}`);
        }

        // 2. Get signer key
        const signerKey = process.env.SETTLEMENT_EVM_SIGNER_PRIVATE_KEY;
        if (!signerKey) {
            throw new Error('SETTLEMENT_EVM_SIGNER_PRIVATE_KEY not configured');
        }

        const claimsContractAddress = process.env.CLAIMS_CONTRACT_ADDRESS;
        if (!claimsContractAddress) {
            throw new Error('CLAIMS_CONTRACT_ADDRESS not configured');
        }

        const signer = new ethers.Wallet(signerKey);

        // 3. Generate EIP-712 typed data
        const domain = {
            name: 'SatelinkClaims',
            version: '1',
            chainId: 137, // Polygon mainnet
            verifyingContract: claimsContractAddress
        };

        const types = {
            Claim: [
                { name: 'nodeId', type: 'string' },
                { name: 'wallet', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'expiry', type: 'uint256' }
            ]
        };

        const nonce = Date.now();
        const expiry = Math.floor(Date.now() / 1000) + (CLAIM_SIGNATURE_EXPIRY_HOURS * 60 * 60);
        const amountWei = ethers.parseUnits(claimable.toFixed(6), 6); // USDT has 6 decimals

        const value = {
            nodeId,
            wallet: walletAddress,
            amount: amountWei,
            nonce: BigInt(nonce),
            expiry: BigInt(expiry)
        };

        // 4. Sign the typed data
        const signature = await signer.signTypedData(domain, types, value);

        // 5. Store pending claim with signature + expiry
        const claimId = `claim_${nodeId}_${nonce}`;
        const now = Math.floor(Date.now() / 1000);


        await client.query(
            `INSERT INTO claims (claim_id, node_id, wallet, amount_usdt, signature, nonce, expiry, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
             ON CONFLICT (claim_id) DO UPDATE SET
                signature = EXCLUDED.signature,
                nonce = EXCLUDED.nonce,
                expiry = EXCLUDED.expiry,
                updated_at = EXCLUDED.created_at`,
            [claimId, nodeId, walletAddress, claimable, signature, nonce, expiry, now]
        );
        await client.query('COMMIT');

        logger.info({
            claimId,
            nodeId,
            wallet: walletAddress,
            amount: claimable,
            expiry: new Date(expiry * 1000).toISOString()
        }, 'CLAIM_SIGNATURE: generated EIP-712 signature for pull model');

        return {
            ok: true,
            claimId,
            amount: claimable,
            amountWei: amountWei.toString(),
            signature,
            nonce,
            expiry,
            expiryDate: new Date(expiry * 1000).toISOString(),
            contractAddress: claimsContractAddress,
            instructions: 'Submit this signature to ClaimsContract.claim() on Polygon. You pay gas.',
            polygonscanContract: `https://polygonscan.com/address/${claimsContractAddress}`
        };

    } catch (err) {
        // A failed ROLLBACK leaves the connection unusable: destroy it instead of pooling it.
        await client.query('ROLLBACK').catch((rbErr) => { broken = rbErr; });
        throw err;
    } finally {
        client.release(broken);
    }
}

/**
 * Mark a claim as completed after on-chain verification.
 * @param {string} claimId - Claim identifier
 * @param {string} txHash - Transaction hash
 * @param {import('pg').Pool} pool - PostgreSQL pool
 */
export async function markClaimCompleted(claimId, txHash, pool) {
    const client = await pool.connect();
    const now = Math.floor(Date.now() / 1000);

    try {
        await client.query('BEGIN');

        // Get claim details
        const claimResult = await client.query(
            'SELECT node_id, wallet, amount_usdt FROM claims WHERE claim_id = $1 AND status = $2',
            [claimId, 'pending']
        );

        if (claimResult.rows.length === 0) {
            throw new Error('Claim not found or already processed');
        }

        const claim = claimResult.rows[0];

        // Update claim status
        await client.query(
            `UPDATE claims SET status = 'completed', tx_hash = $1, claimed_at = $2
             WHERE claim_id = $3`,
            [txHash, now, claimId]
        );

        // Mark exactly the earnings this claim reserved (CLAIMING) as CLAIMED — never rows that
        // accrued after signing (those stay UNPAID for the next claim).
        await client.query(
            `UPDATE epoch_earnings SET status = 'CLAIMED'
             WHERE lower(wallet_or_node_id) = ANY($1::text[]) AND status = 'CLAIMING'`,
            [[claim.node_id, claim.wallet].filter(Boolean).map((x) => String(x).toLowerCase())]
        );

        await client.query('COMMIT');

        logger.info({
            claimId,
            txHash,
            nodeId: claim.node_id,
            amount: claim.amount_usdt
        }, 'CLAIM_COMPLETED: on-chain claim verified');

        return { ok: true, claimId, txHash };

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * On-chain facts about a claim signature, read from ClaimsContract (read-only).
 * Throws on any RPC/config problem: callers fail closed.
 */
export function createClaimChainReader({ rpcUrl = process.env.POLYGON_RPC_URL, contract = process.env.CLAIMS_CONTRACT_ADDRESS } = {}) {
    return {
        async usedNonce(nonce) {
            if (!rpcUrl || !contract) throw new Error('chain_unconfigured');
            const provider = new ethers.JsonRpcProvider(rpcUrl, 137, { staticNetwork: true });
            const c = new ethers.Contract(contract, ['function usedNonces(uint256) view returns (bool)'], provider);
            return Boolean(await c.usedNonces(BigInt(nonce)));
        },
        async chainTime() {
            if (!rpcUrl) throw new Error('chain_unconfigured');
            const provider = new ethers.JsonRpcProvider(rpcUrl, 137, { staticNetwork: true });
            const block = await provider.getBlock('latest');
            return Number(block.timestamp);
        },
    };
}

/**
 * Staff-only: void a pending claim whose signature can no longer be redeemed, releasing the
 * earnings it reserved (CLAIMING -> UNPAID) so a new claim can be signed.
 * Safe only when BOTH hold on-chain: the signature has expired (chain time, since
 * ClaimsContract.claim() checks block.timestamp < expiry) AND its nonce was never used. Any
 * chain error refuses (fail closed). A redeemed nonce must be completed, never voided.
 * @returns {Promise<{ok: true, claimId: string, released: string} | {ok: false, http: number, error: string}>}
 */
export async function voidClaim(claimId, pool, { chain = createClaimChainReader() } = {}) {
    const client = await pool.connect();
    let broken;
    try {
        await client.query('BEGIN');
        const found = await client.query(
            `SELECT claim_id, node_id, wallet, nonce, expiry, status FROM claims WHERE claim_id = $1 FOR UPDATE`,
            [claimId]
        );
        const claim = found.rows[0];
        if (!claim) { await client.query('ROLLBACK'); return { ok: false, http: 404, error: 'claim_not_found' }; }
        if (claim.status !== 'pending') { await client.query('ROLLBACK'); return { ok: false, http: 409, error: `claim_${claim.status}` }; }

        let chainNow, used;
        try {
            chainNow = await chain.chainTime();
            used = await chain.usedNonce(claim.nonce);
        } catch {
            await client.query('ROLLBACK');
            return { ok: false, http: 503, error: 'chain_unavailable' };
        }
        if (!(chainNow >= Number(claim.expiry))) {
            await client.query('ROLLBACK');
            return { ok: false, http: 409, error: 'claim_not_expired' };
        }
        if (used) {
            await client.query('ROLLBACK');
            return { ok: false, http: 409, error: 'claim_redeemed_on_chain' };
        }

        const ids = [claim.node_id, claim.wallet].filter(Boolean).map((x) => String(x).toLowerCase());
        await client.query(`UPDATE claims SET status = 'void', updated_at = $2 WHERE claim_id = $1`, [claimId, Math.floor(Date.now() / 1000)]);
        const released = await client.query(
            `WITH r AS (
                UPDATE epoch_earnings SET status = 'UNPAID'
                 WHERE lower(wallet_or_node_id) = ANY($1::text[]) AND status = 'CLAIMING'
                 RETURNING amount_usdt
             ) SELECT COALESCE(SUM(amount_usdt), 0)::text AS released FROM r`,
            [ids]
        );
        await client.query('COMMIT');
        logger.info({ claimId, released: released.rows[0].released }, 'CLAIM_VOID: expired, unredeemed claim voided');
        return { ok: true, claimId, released: released.rows[0].released };
    } catch (err) {
        await client.query('ROLLBACK').catch((rbErr) => { broken = rbErr; });
        throw err;
    } finally {
        client.release(broken);
    }
}

/**
 * Get pending claims for a wallet.
 * @param {string} walletAddress - Wallet address
 * @param {import('pg').Pool} pool - PostgreSQL pool
 */
export async function getPendingClaims(walletAddress, pool) {
    const result = await pool.query(
        `SELECT claim_id, node_id, wallet, amount_usdt, signature, nonce, expiry, created_at
         FROM claims
         WHERE wallet = $1 AND status = 'pending' AND expiry > $2
         ORDER BY created_at DESC`,
        [walletAddress, Math.floor(Date.now() / 1000)]
    );

    return result.rows;
}

export default {
    voidClaim,
    generateClaimSignature,
    markClaimCompleted,
    getPendingClaims
};
