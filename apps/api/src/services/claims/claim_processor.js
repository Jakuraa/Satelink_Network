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
        // nonce, and every signing mints a fresh nonce, so two signatures over the same UNPAID
        // earnings are both redeemable. Serialise per node and refuse while ANY claim for the
        // node is still 'pending' — expired ones too: nothing records an on-chain redemption
        // automatically (markClaimCompleted has no caller), so an expired pending claim may
        // already have been paid. It must be reconciled (completed, or voided after checking
        // usedNonces(nonce) on-chain) before a new signature is issued.
        await client.query('BEGIN');
        // Earnings match the node OR the wallet, so both are locked (always node, then wallet:
        // a fixed order cannot deadlock) and both are checked for an open claim.
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`claims:node:${nodeId}`]);
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`claims:wallet:${String(walletAddress).toLowerCase()}`]);
        const pending = await client.query(
            `SELECT claim_id FROM claims
             WHERE (node_id = $1 OR lower(wallet) = lower($2)) AND status = 'pending' LIMIT 1`,
            [nodeId, walletAddress]
        );
        if (pending.rows.length > 0) {
            const err = new Error(`claim_pending_reconciliation: claim ${pending.rows[0].claim_id} must be reconciled before a new signature`);
            err.code = 'claim_pending_reconciliation';
            throw err;
        }

        // 1. Try epoch_earnings first (preferred path)
        const earningsResult = await client.query(
            `SELECT COALESCE(SUM(amount_usdt), 0) as claimable
             FROM epoch_earnings
             WHERE (wallet_or_node_id = $1 OR wallet_or_node_id = $2)
             AND status = 'UNPAID'`,
            [nodeId, walletAddress]
        );

        let claimable = parseFloat(earningsResult.rows[0]?.claimable || 0);
        let usedFallback = false;

        // 2. If epoch_earnings empty, fallback to revenue_events_v2 direct sum
        if (claimable < 0.01) {
            const revResult = await client.query(
                `SELECT COALESCE(SUM(amount_usdt) * 0.5, 0) as claimable
                 FROM revenue_events_v2
                 WHERE node_id = $1
                   AND is_test_data = false`,
                [nodeId]
            );
            claimable = parseFloat(revResult.rows[0]?.claimable || 0);
            usedFallback = true;
            console.log(`[CLAIM] epoch_earnings empty, using revenue_events_v2 fallback: $${claimable.toFixed(6)}`);
        }

        if (claimable < MIN_CLAIM_THRESHOLD_USDT) {
            throw new Error(`Minimum ${MIN_CLAIM_THRESHOLD_USDT} USDT required. Available: ${claimable.toFixed(6)}`);
        }

        if (usedFallback) {
            console.log(`[CLAIM] Generating signature for $${claimable.toFixed(6)} via revenue_events_v2 fallback`);
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
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
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

        // Mark earnings as CLAIMED
        await client.query(
            `UPDATE epoch_earnings SET status = 'CLAIMED'
             WHERE (wallet_or_node_id = $1 OR wallet_or_node_id = $2)
             AND status = 'UNPAID'`,
            [claim.node_id, claim.wallet]
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
    generateClaimSignature,
    markClaimCompleted,
    getPendingClaims
};
