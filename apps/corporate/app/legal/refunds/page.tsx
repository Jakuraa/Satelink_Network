import type { Metadata } from "next";
import { company, registeredOfficeLine } from "@/content/company";
import { LegalPage } from "@/components/LegalLayout";

// DRAFT — NOT FOR PUBLICATION until the founder comments "approved" on the PR
// and a qualified Indian legal/CA professional has reviewed it for the Consumer
// Protection (E-Commerce) Rules, 2020. Checkout completion stays blocked
// (apps/api/src/payments/refund_policy.mjs) until this URL returns 200.

export const metadata: Metadata = {
  title: "Refunds and cancellations",
  description: "When Jakuraa refunds a payment, how to ask for a refund, and how long it takes.",
};

// Founder to confirm the numbers below before publication.
const UNUSED_CREDIT_WINDOW_DAYS = 30;
const INVESTIGATION_BUSINESS_DAYS = 7;
const PROCESSING_BUSINESS_DAYS = 7;

export default function Refunds() {
  return (
    <LegalPage title="Refunds and cancellations" current="/legal/refunds">
      <p>
        This policy covers payments made to {company.legalName} (&quot;Jakuraa&quot;, &quot;we&quot;) for Satelink
        services, including Satelink RPC credits and Satelink Trading AI subscriptions. It explains when we refund you,
        how to ask, and how long it takes.
      </p>
      <p>
        <strong>In short:</strong> charged twice or without permission - full refund. Our service failed - you get back
        the affected part. Unused credits - refundable for {UNUSED_CREDIT_WINDOW_DAYS} days. Used credits and the current
        subscription period - not refundable.
      </p>

      <h2>Charges we always refund</h2>
      <ul>
        <li>
          <strong>Duplicate charges.</strong> If you were charged more than once for the same purchase, we refund every
          extra charge in full.
        </li>
        <li>
          <strong>Charges you did not authorise.</strong> If a payment was made without your permission, we refund it in
          full once we confirm it was unauthorised.
        </li>
      </ul>

      <h2>Service failures and outages</h2>
      <p>
        If our service is unavailable or does not work as described for reasons within our control, we refund the
        affected part of your payment, in proportion to the time or calls affected - for example, the share of a
        subscription period during which the service was down, or the credits used by calls that failed on our side.
      </p>

      <h2>Unused prepaid credits</h2>
      <ul>
        <li>
          You can ask for a refund of credits you have not used within {UNUSED_CREDIT_WINDOW_DAYS} days of buying them.
        </li>
        <li>We refund the unused amount less any fee our payment provider charged us and does not return.</li>
        <li>Credits you have already used are not refundable.</li>
      </ul>

      <h2>Subscriptions</h2>
      <ul>
        <li>You can cancel at any time. Cancelling stops the next renewal.</li>
        <li>
          We do not refund the current period after you cancel, unless the law requires it or the service failed as
          described above.
        </li>
      </ul>

      <h2>Crypto payments</h2>
      <p>
        If you paid in a crypto asset (for example USDT or USDC), we refund in the same asset to the address the payment
        came from, less the blockchain network fee (&quot;gas&quot;) for sending it. We cannot refund to a different address or in a different asset.
      </p>

      <h2>Chargebacks</h2>
      <p>
        If you raise a chargeback or payment dispute, we may restrict your account while we investigate. We do not
        confiscate balances that we have verified as yours: if the investigation finds in your favour, your account and
        balance are restored; if it finds the chargeback was improper, we may close the account - and we still return
        any balance we verified as yours, under the rules on this page.
      </p>

      <h2>How to ask for a refund</h2>
      <ol>
        <li>
          Email <a href={`mailto:${company.email}?subject=Refund%20request`}>{company.email}</a> with the subject
          &quot;Refund request&quot;.
        </li>
        <li>
          Include the email or wallet address on the account, the date and amount, and the payment reference (order ID,
          invoice number or transaction hash). Tell us why you are asking.
        </li>
        <li>We may ask for more evidence if we need it to confirm the payment belongs to you.</li>
      </ol>

      <h2>How long it takes</h2>
      <ul>
        <li>We acknowledge your request and finish our investigation within {INVESTIGATION_BUSINESS_DAYS} business days.</li>
        <li>
          If we approve a refund, we send it within {PROCESSING_BUSINESS_DAYS} business days of approval. Your bank or
          card issuer may take longer to show it; crypto refunds arrive once the network confirms the transfer.
        </li>
        <li>If we decline, we tell you why. You can escalate to our <a href="/legal/grievance">grievance officer</a>.</li>
      </ul>

      <h2>Contact</h2>
      <ul>
        <li>{company.legalName}</li>
        <li>CIN: {company.cin}</li>
        <li>GSTIN: {company.gstin}</li>
        <li>Registered office: {registeredOfficeLine()}</li>
        <li>
          Email: <a href={`mailto:${company.email}`}>{company.email}</a>
        </li>
      </ul>
    </LegalPage>
  );
}
