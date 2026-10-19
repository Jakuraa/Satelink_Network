# India regulatory questions: Jakuraa Commercial Pvt Ltd / Satelink

> **This is research, not legal or tax advice.** It was prepared to frame questions for an Indian fintech lawyer
> and a Chartered Accountant (CA). Nothing here clears any activity. When this document says "likely", it means
> "the most plausible reading, which a professional must confirm".

## 0. Inspection record

| Item | Value |
|---|---|
| Date | 2026-10-15 |
| Method | Web search plus fetches of primary sources where reachable: rbi.org.in notification pages, sebi.gov.in circular PDFs (text extracted with `pdftotext`), the cbic.gov.in IGST Act text, and an RBI FEMA PDF (via a CA mirror). Gaps were filled from law-firm and trade commentary, which is marked **[commentary]**. Read-only repo review covered `docs/legal/MARKET_DATA_TERMS.md`, `docs/platform/*` and `apps/corporate/content/company.ts`. |
| Not fetched / blocked | incometaxindia.gov.in returned 403; I did not open the egazette PDFs or the full text of the PPI, PA or PMLA notifications. Their content is reported from commentary that cites them. I did not read the Income-tax Act, 2025 text, so new section numbers are **[commentary]**. |
| Limitations | Statutes change. Several key instruments took effect within the last 30 days (FEMA export regulations from 1 Oct 2026; the 9-month realisation period from 1 Oct 2026). I had no access to Jakuraa's MoA, GST registration certificate, LUT filings, bank (AD) relationship or contracts. I did not check how any regulator treats Jakuraa specifically. |
| Repo reconciliation | Prior docs already flag (a) FEMA/tax/GST review for an INR-to-USDT rail (`DECISIONS_2026-10-12.md` l.37) and (b) PMLA/FIU, s.194S and GST questions on crypto refunds (`CHECKOUT_UNBLOCK_PREP.md` L5, L6). Neither doc has an answer. `MARKET_DATA_TERMS.md` Q7 already asks the SEBI RA/IA question. **This document supersedes none of these; it adds to them.** |

Company facts used (from `apps/corporate/content/company.ts`): CIN `U52190TZ2019PTC033093` (Tamil Nadu ROC), GSTIN `33AADCF9341B1Z1`, IEC issued by DGFT Coimbatore, grievance officer **name = null**.

---

## 1. Summary table

| # | Activity | Risk | Launch now / partner / defer | Advice needed |
|---|---|---|---|---|
| A | RPC/API SaaS sold for **fiat (card/wire) to foreign customers** | Low | **Launch now** (with LUT, export invoices, EDF and 9-month realisation) | CA (routine) |
| B | Same, sold to **Indian customers** | Low | Launch now (charge 18% GST) | CA (routine) |
| C | **x402 USDC on Base / USDT vault receipts** for services | **HIGH** | **Defer scaling, or restructure** pending opinion. Today's volume is near zero. | Lawyer (FEMA + PMLA) **and** CA (GST, income tax) |
| D | Card payments via **Dodo Payments (MoR)** | Low–Med | Use a partner (MoR or an RBI-authorised PA-CB) | CA (who is the "recipient" for GST) |
| E | **Prepaid API credits** (own services only) | Low–Med | Launch now *if* credits are usable only for Jakuraa's own services, are not transferable and are refunded only to source | Lawyer (PPI) |
| F | **API procurement / resale** of third-party APIs | Med | Launch only as **principal reseller** (buy in own name, resell in own name). **Do not** operate as a marketplace paying third parties out of customer balances | Lawyer (PPI/PA) + CA (RCM, s.195 TDS) |
| G | **Node-operator payouts (50/30/20) in USDT** | **HIGH** | **Defer.** Keep `SETTLEMENT_DRY_RUN=1` | Lawyer (PMLA VDA SP, PSS Act) + CA (TDS on VDA in kind, GST) |
| H | **Trading AI for Indian equities (Upstox copilot)** | **HIGH** | **Defer** public/retail launch. Possible later via an exchange-empanelled algo-provider route and/or an RA-registered partner | SEBI lawyer |
| I | **Trading AI: crypto (Binance)** | Med–High | Defer real-money use. Paper/backtest only. Do not custody or route funds | Lawyer (PMLA, FEMA/LRS for users) |
| J | **Trading AI: US equities (Alpaca)** for Indian users | Med | Defer for Indian residents. Possible for non-Indian users subject to US rules | Lawyer (FEMA/LRS, SEBI association rules) |
| K | **Performance / backtest claims** in marketing | **HIGH** if aimed at Indian securities | Do not publish return claims for Indian securities | SEBI lawyer |
| L | **Market data** (NSE/BSE, crypto exchanges) | Med–High | Defer redistribution without licences (see MARKET_DATA_TERMS.md) | Lawyer (licensing) |
| M | **Consumer Protection (E-Commerce) Rules** | Med | Fix now: name the grievance officer and publish refund terms. Amendment Rules 2026 take effect 1 Jan 2027 | Lawyer (light) |
| N | **DPDP Act / SPDI / CERT-In** | Med | Now: SPDI privacy policy and CERT-In log retention. DPDP duties apply by 13 May 2027 | Lawyer (privacy) |
| O | **Companies Act s.12 disclosures** on satelink.network | Low | Fix now | Company Secretary (CS) |
| P | **Third-party supplier contracts** | Med | Ongoing | Lawyer |

---

## 2. Detailed sections

### Topic 1: Ordinary SaaS and software export

**Activity.** Satelink sells pay-per-call RPC API access to developers and AI agents worldwide.

#### 1.1 GST: export of services and zero rating

- **Source:** IGST Act 2017 s.2(6), from the CBIC tax repository (https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_IGST_Act/active/chapteri/section2_v1.00.html, accessed 2026-10-15).
- **Confirmed (verbatim s.2(6)).** A supply is an "export of services" when:
  - (i) the supplier is located in India;
  - (ii) the recipient is located outside India;
  - (iii) the place of supply is outside India;
  - (iv) "the payment for such service has been received by the supplier of service in **convertible foreign exchange** or in Indian rupees wherever permitted by the Reserve Bank of India"; and
  - (v) supplier and recipient are not merely establishments of a distinct person.
- Exports are zero-rated (IGST s.16). Supplying without paying IGST requires a Letter of Undertaking (LUT) (CGST Rules r.96A). Otherwise the supplier pays IGST and claims a refund.
- **Confirmed (OIDAR).** s.2(17) OIDAR was widened by Finance Act 2023 (from 1 Oct 2023): the "essentially automated / minimal human intervention" condition was removed **[commentary, consistent with the CBIC text showing an omission marker]**. RPC API access is very likely OIDAR.
  - Place of supply for OIDAR is the **location of the recipient** (IGST s.13(12)).
  - The Explanation to s.13(12) lists indicators (billing address, card issuer country, IP address, bank account location, and others); two non-contradictory indicators settle the location.
- **Confirmed (domestic vs foreign).**
  - The special OIDAR regime in IGST s.14 (non-taxable online recipients) applies to suppliers located **outside** India. It does not apply to Jakuraa.
  - For Jakuraa, a sale to an Indian customer is a normal taxable supply at 18%. A sale to a foreign customer (B2B or B2C) is an export only if all five s.2(6) conditions are met.
- **Confirmed (intermediary change).** Finance Act 2026 omitted IGST s.13(8)(b) (intermediary place of supply) from 30 Mar 2026 (https://www.grantthornton.in/insights/articles/gst-on-intermediary-services/ **[commentary]**). This matters if API procurement is ever characterised as intermediary.
- **Uncertain / HIGH RISK.**
  - **Crypto receipts likely fail condition (iv).** USDC or USDT is not "convertible foreign exchange" received through the banking channel. If that reading holds, x402 and vault sales to foreign customers are **not** exports. IGST at 18% would then be payable on their value, with interest, and possibly penalty if unpaid. The consideration is in kind (a VDA), so value is the open-market value (CGST s.15 / valuation rules).
  - **Recipient location for anonymous wallet payers** often cannot be evidenced. That defeats conditions (ii) and (iii) and the s.13(12) indicators even for fiat. Payers who are actually in India (some of the traffic is) are domestic supplies.
- **Invoicing.**
  - Issue a tax invoice under CGST Rules r.46 / export invoice per r.46 proviso, endorsed "supply meant for export under LUT without payment of IGST".
  - E-invoicing applies only above the AATO threshold (₹5 cr); confirm with the CA.
  - Per-call micro-sales need a consolidated or periodic invoicing approach that the CA approves.
- **Professional advice:** CA. **Status:** fiat exports can launch now; crypto-paid exports need an opinion.

#### 1.2 FEMA: export realisation, declarations, mode of receipt

- **Source:** FEMA (Export and Import of Goods and Services) Regulations, 2026, Notification FEMA 23(R)/2026-RB of 13 Jan 2026, **in force from 1 Oct 2026**, superseding FEMA 23(R)/2015-RB (https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=13277&Mode=0, accessed 2026-10-15). It was amended 22 Sep 2026 (from 1 Oct 2026) to shorten realisation periods (https://www.scconline.com/blog/post/2026/09/29/rbi-amends-fema-export-import-goods-services-regulations-2026/ **[commentary]**).
- **Confirmed (from the RBI page, as summarised by my fetch tool).**
  - **Reg. 3:** a services exporter must file an Export Declaration Form (EDF) for the full export value **within 30 days from the end of the month in which the invoice is raised**. Monthly consolidation is allowed. Software exports have a specific route, with STPI as a "specified authority" alongside AD banks. The SOFTEX mechanism is effectively replaced or recast by the EDF; the CA must confirm the form for SaaS/OIDAR.
  - **Reg. 5:** services proceeds must be realised **within 9 months of the invoice date** (12 months if invoiced or settled in INR); AD banks may extend.
  - **Reg. 7:** set-off is permitted.
  - The **old Master Direction "Export of Goods and Services" and its 15-month period are no longer the operative rule** for invoices from 1 Oct 2026. Earlier internal notes citing 9/15 months or SOFTEX should be rechecked.
- **Confirmed (mode of receipt).** FEMA (Manner of Receipt and Payment) Regulations 2023, reg. 3(2) (RBI FEMA 14(R)/2023-RB; text via https://www.caalley.com/rbi23/FEMA14R952AB1118F28466C951910A7D957C382.pdf, accessed 2026-10-15): receipts between a resident and a non-resident "shall, unless provided otherwise, be made through an Authorised Bank or Authorised Person", in INR or foreign currency (non-ACU countries). Reg. 4 of the 2026 export regulations points to these rules. **No provision permits receipt of export proceeds in a VDA.**
- **Uncertain / HIGH RISK.**
  - Receiving USDC on Base into a company EOA, or USDT into a Polygon vault, as payment for exported services is **not a recognised mode of realisation**.
  - Open questions: (a) whether the export is "unrealised" until the crypto is converted and the INR or FX arrives through an AD bank; (b) whether holding the crypto offshore or on-chain is itself a FEMA contravention (holding a foreign asset or "foreign currency" outside permitted routes); (c) whether compounding is needed for past receipts.
  - Commentary consensus is that crypto export receipts are not compliant **[commentary: https://solvlegal.com/blogs/accepting-crypto-payments-from-foreign-clients-what-fema-allows/]**.
- **Purpose codes.** Inward remittances carry an RBI purpose code. For computer/IT services the S08xx group is used (for example S0802 for software consultancy/implementation; the database/data-processing and online-services codes are in the same group). The CA or AD bank must assign the correct code. I did **not** verify the current code list.
- **PA-CB.**
  - Source: RBI Master Direction on Regulation of Payment Aggregators, 15 Sep 2025 (RBI/DPSS/2025-26/141; https://www.fidcindia.org.in/wp-content/uploads/2025/09/RBI-PAYMENT-AGGREGATORS-DIRECTIONS-15-09-25.pdf **[mirror]**; Cyril Amarchand / Khaitan alerts **[commentary]**).
  - PA-CB (inward) now covers cross-border current-account transactions not prohibited under FEMA. Funds sit in an Inward Collection Account with an AD Cat-I bank.
  - **For Jakuraa as merchant:** expect PA-CB KYC/KYB, invoice-level reconciliation, EDF/realisation data flowing to EDPMS, and settlement in INR. A **foreign MoR** (Dodo) changes the analysis: Jakuraa's customer may then legally be the MoR. See Topic 1.3.
- **Professional advice:** CA + AD bank; lawyer for crypto receipts. **Status:** fiat launch now; crypto rail defer or restructure.

#### 1.3 Merchant of record (Dodo Payments)

- **Confirmed (repo):** Dodo's acceptance policy prohibits "virtual asset services" and "unlicensed financial services" (`docs/platform/DECISIONS_2026-10-12.md` item 9).
- **Uncertain.** Under an MoR model the MoR buys and resells, so Jakuraa may make one B2B supply to the MoR's contracting entity. Whether that is an export depends on the MoR entity's location, payment currency and channel. This also determines who handles end-customer GST, and whether Jakuraa's invoice goes to Dodo rather than the end user.
- **Advice:** CA. **Status:** partner route (acceptable for the RPC SaaS; unlikely for the Trading AI).

---

### Topic 2: API reselling and procurement

- **GST on resale.** If Jakuraa buys API access and resells it **in its own name as principal**, its sale is an ordinary OIDAR/IT supply. GST and export treatment follow Topic 1, and input tax credit (ITC) is available on purchases.
  - If Jakuraa instead acts as an agent arranging supply between a third-party API vendor and the customer, intermediary analysis applies. Since 30 Mar 2026 the place of supply for intermediaries is the default s.13(2) (recipient location) **[commentary]**, which reduces the old export-denial problem. Commission-only models still change the GST base.
- **Import of services, RCM.** Source: IGST s.5(3) with Notification 10/2017-Integrated Tax (Rate) **[commentary: taxguru/beaconfiling summaries]**. Services imported from a supplier outside India by a **registered** Indian business are taxed under reverse charge (RCM) at 18% IGST, paid in cash and claimable as ITC. OIDAR bought by a registered business person falls under RCM, not the s.14 foreign-supplier regime.
  - **Applies to:** Jakuraa's purchases of foreign APIs, hosting (Railway, Vercel, Cloudflare), Alchemy/Ankr/drpc RPC, and similar. **If RCM has not been paid on these today, there is a past exposure. Ask the CA.**
- **Equalisation levy.** Confirmed abolished: the 2% e-commerce levy for consideration on or after 1 Aug 2024, and the 6% online-advertising levy on or after 1 Apr 2025 (Finance Act 2025 amending ss.163/165 Finance Act 2016) **[commentary: https://digitalpolicyalert.org/change/14027-abolition-of-equalisation-levy-on-digital-advertisement-services-in-finance-act-2025-no-7]**. **Not relevant going forward.**
- **TDS on payments to non-residents.** 1961 Act s.195; from 1 Apr 2026 the Income-tax Act 2025 (successor withholding provision, s.393 per **[commentary]**). The CA must check:
  - whether API-access fees are royalty or fees for technical services under the Act or the relevant DTAA (*Engineering Analysis*, SC 2021, held that pure software-licence payments are not royalty under DTAAs);
  - Form 15CA/15CB on remittances.
- **TDS on domestic purchases:** the successors to ss.194C/194J under the 2025 Act.
- **Risk:** Medium (mostly compliance hygiene). **Advice:** CA. **Status:** launch only as principal reseller, after RCM and s.195 positions are settled.

---

### Topic 3: RBI-regulated payment activities (PPI, PA, PSS Act)

- **Sources.**
  - PSS Act 2007: s.2(1)(i) defines "payment system" as a system enabling payment between payer and beneficiary through clearing, payment or settlement service. **s.4: no person other than RBI may commence or operate a payment system without RBI authorisation** (https://www.indiacode.nic.in/bitstream/123456789/2082/4/a2007-51.pdf; RBI PSS FAQ https://www.rbi.org.in/commonman/english/scripts/FAQs.aspx?Id=420).
  - RBI Master Direction on PPIs (2021, as amended).
  - **Draft** Master Direction on PPIs, 2026 (20 May 2026, not final) **[commentary: https://corporate.cyrilamarchandblogs.com/2026/06/fig-paper-no-60-…]**.
  - PA Master Direction 2025.
- **Confirmed.** Under the 2021 MD, a **closed-system PPI** is "issued by an entity for facilitating the purchase of goods and services from that entity only and do not permit cash withdrawal". Issuing it "is not classified as a payment system requiring approval / authorisation by RBI" **[commentary quoting the MD]**.
  - The 2026 draft drops the "closed system" label. It keeps the carve-out for issuance by "an entity **other than a marketplace**, solely for facilitating purchase of goods or services from such entity itself" **[commentary]**.
- **Applied to Satelink.**
  - **Prepaid API credits** usable only for Jakuraa's own services, not transferable between users, and not withdrawable fit the own-goods carve-out → *likely* no RBI authorisation needed.
    - Risks: (a) a refund of unused credits **to anything other than the source** (for example to a different wallet) looks like cash-out; (b) transferable credits; (c) credits redeemable for third-party services.
  - **API procurement where third-party API vendors are paid out of customer credit balances** (a marketplace model) would fall outside the carve-out under the 2026 draft. That is a semi-closed PPI or PA activity, which **requires authorisation** (PA net worth floor ₹15 cr per the 2025 MD **[commentary]**). Avoid it by acting as principal.
  - **Node-operator revenue share.** Collecting customer money and remitting 50% to node operators can be read as "facilitating payment between payer and beneficiary", which is payment aggregation, especially if node operators are seen as the real service providers.
    - It is defensible if Jakuraa is the sole supplier to customers and separately **buys** node services (two principal contracts, with operator payment not tied to specific customer receipts).
    - It is risky if the contract or UI says customers pay operators through Satelink. In USDT the RBI rules may not literally apply because there is no rupee or bank instrument, but **PMLA and VDA rules do** (Topic 4).
  - **Escrow:** no requirement unless Jakuraa is a PA, and Jakuraa should not become one. Do not describe the vault as escrow of customer funds.
- **Risk:** Medium (credits), High (payouts, marketplace). **Advice:** fintech lawyer. **Status:** credits launch now with tight terms; marketplace and payouts deferred.

---

### Topic 4: Virtual digital assets (tax, PMLA, FEMA)

#### 4.1 Income tax

- **Sources:** Income-tax Act 1961 ss.2(47A), 115BBH, 194S (until 31 Mar 2026). **Income-tax Act 2025 in force from 1 Apr 2026** carries these forward under new numbers **[commentary]**. Reported mappings: VDA definition in s.2(111); 194S becomes s.393(1) Table Sl. 8(vi). Finance Act 2025 added "crypto-asset" to the VDA definition from 1 Apr 2026. The CBDT notified CARF-aligned crypto-asset reporting rules on 5 Mar 2026 **[commentary: Cyril Amarchand FIG Paper 57]**. **Verify all section numbers against the 2025 Act text; incometaxindia.gov.in was blocked.**
- **Confirmed.**
  - USDC and USDT are VDAs.
  - Income from **transfer** of a VDA is taxed at 30% flat, with no deduction other than cost of acquisition and no set-off of losses (115BBH and successor).
  - 1% TDS applies on consideration paid **to a resident** for transfer of a VDA (194S and successor). There are thresholds (₹50k for specified persons, ₹10k otherwise) **[commentary]**. Where consideration is in kind, the payer must ensure tax is paid before release.
- **Applied to Satelink (uncertain; CA must opine).**
  - **Receipt of USDC/USDT for services:** the INR value at receipt is business income at normal corporate rates. That value becomes the cost of the VDA. **Each later conversion to INR or another token is a VDA transfer**: gain taxed at 30% with no loss set-off, and 1% TDS deducted by the Indian buyer or exchange.
  - **Paying node operators in USDT:** Jakuraa *transfers* a VDA in exchange for services. That (a) is a taxable transfer for Jakuraa, (b) may make the *resident* node operator the "payer of consideration in kind", technically required to ensure 1% TDS (an absurd but literal reading), and (c) is a service payment on which Jakuraa may owe TDS (194C/194J successors) on the value, paid in kind. Non-resident operators raise s.195-successor questions.
- **Risk:** High (compliance complexity, plus books in two assets). **Advice:** CA. **Status:** defer payouts; minimise crypto treasury and convert promptly through an FIU-registered Indian exchange, after CA sign-off.

#### 4.2 PMLA / FIU-IND

- **Sources:**
  - Ministry of Finance Notification S.O. 1072(E), 7 Mar 2023 (PMLA s.2(1)(sa)(vi) designated business), covering activities carried on "for or on behalf of another natural or legal person in the course of business": (i) VDA↔fiat exchange, (ii) VDA↔VDA exchange, (iii) **transfer** of VDAs, (iv) **safekeeping or administration** of VDAs or instruments enabling control over them, (v) participation in financial services related to an issuer's offer/sale of a VDA.
  - FIU-IND AML/CFT Guidelines for VDA SPs, 10 Mar 2023.
  - Sources here: PIB https://www.pib.gov.in/PressReleasePage.aspx?PRID=1991372 (Dec 2023 show-cause notices to 9 offshore VDA SPs, accessed 2026-10-15); Cyril Amarchand FIG Papers 33/39/57 **[commentary]**.
- **Confirmed.**
  - VDA SPs must register with FIU-IND as reporting entities: KYC, STR/CTR reporting, record-keeping, Travel Rule.
  - Since Sep 2025 registration involves in-person meetings, a live KYC demo, a CERT-In audit and Travel Rule evidence **[commentary]**.
  - Enforcement exists. Binance paid ₹18.82 cr and registered (2024). FIU-IND issued notices to 25 more offshore VDA SPs on 1 Oct 2025. By Mar 2026, 54 VDA SPs were registered **[commentary]**.
- **Applied to Satelink (uncertain; lawyer must opine).**
  - **Receiving USDC/USDT as payment for Jakuraa's own services** is acting *for itself*, not "on behalf of another". On the notification's wording this is *likely not* VDA SP activity. That is the commonly expressed view **[commentary]**; it is not an official FIU-IND clarification.
  - **Risk escalators that could tip Jakuraa into VDA SP status:**
    - (a) refunding unused credits **in crypto** (transfer on behalf of a customer);
    - (b) the vault holding balances **attributable to customers** that customers can withdraw (safekeeping/administration);
    - (c) **node-operator and "distribution pool" payouts** funded by customer payments (transfer on behalf of others);
    - (d) any feature that converts crypto to fiat or another token for users;
    - (e) the Trading AI holding API keys with **withdrawal** permission on users' Binance accounts ("instruments enabling control over VDAs").
- **Risk:** Medium today; **High** if payouts, crypto refunds or withdrawal-capable keys ship. **Advice:** lawyer. **Status:** defer (a)–(e). Ensure Trading AI broker keys are **trade-only, never withdraw**.

#### 4.3 FEMA

See Topic 1.2. **Uncertain and flagged:**
- receiving crypto for exports;
- holding stablecoins on-chain or offshore;
- paying foreign node operators in USDT (a payment to a non-resident outside the AD-bank channel, so a possible contravention of the Manner of Receipt and Payment Regulations reg. 3).

#### 4.4 2025–2026 policy developments

- The government's VDA **discussion paper** has been deferred repeatedly, reported shelved again in Apr 2026 amid RBI opposition **[commentary: cryptotimes.io 2026-04-01]**.
- The Parliamentary Standing Committee on Finance completed VDA evidence sessions (Sep 2026) with **no bill** **[commentary: cryptotimes.io 2026-09-16]**.
- I found **no "COINS Act" or other enacted Indian crypto statute** as of 2026-10-15. Stablecoins are treated as VDAs. The RBI's stated position is hostile to foreign-currency stablecoins.
- RBI "faster cross-border inward payments" guidelines take effect 9 Oct 2026 **[commentary]**. They improve fiat export rails, which further weakens the case for crypto receipts.

---

### Topic 5: SEBI and the Trading AI

- **Sources.**
  - SEBI circular SEBI/HO/MIRSD/MIRSD-PoD/P/CIR/2025/0000013, 4 Feb 2025, "Safer participation of retail investors in Algorithmic trading" (https://www.sebi.gov.in/legal/circulars/feb-2025/safer-participation-of-retail-investors-in-algorithmic-trading_91614.html; PDF text via https://www.cse-india.com/upload/upload/Feb_042025.pdf, accessed 2026-10-15).
  - Timeline extensions: 29 Jul 2025 to 1 Oct 2025, and SEBI/HO/MIRSD/MIRSD-PoD/P/CIR/2025/132 of 30 Sep 2025 for phased adoption, with **full implementation for all brokers by 1 Apr 2026** **[commentary + sebi.gov.in listing]**.
  - NSE FAQ on retail algos (3 Nov 2025) https://nsearchives.nseindia.com/web/sites/default/files/inline-files/FAQ_Retail%20Algo_03112025_NSE.pdf (not opened).
- **Confirmed (verbatim from the circular PDF).**
  - **Para I(a):** "brokers shall be the principal while any algo provider or fintech/vendor … shall act as its agent".
  - **I(b):** algo orders are tagged with an exchange-provided unique identifier.
  - **I(d):** brokers must not permit open APIs; access only through a vendor-client-specific API key, a static whitelisted IP, OAuth and 2FA; brokers "deal with empaneled algo providers only".
  - **III(a):** "while algo providers shall not be regulated by SEBI … any algo provider, providing the facility to place algo orders with Brokers through API, shall require to be **empaneled with Exchanges**".
  - **V:** for **black-box algos** (logic not known to the user and not replicable), the algo provider shall "**Register as a Research Analyst** and maintain a detailed research report for each such algo", and must re-register when the logic changes.
  - The orders-per-second threshold was left to the brokers' Industry Standards Forum. 10 OPS is reported **[commentary]**.
- **Confirmed (enforcement precedent).** SEBI Adjudication Order Order/JS/YK/2025-26/32256, 25 Mar 2026, "In the matter of TradeTron and other Algo Platforms" (https://www.sebi.gov.in/sebi_data/attachdocs/mar-2026/ORDER_1774428858.pdf, accessed 2026-10-15; text extracted).
  - TradeTron, a **SaaS** algo platform charging subscription fees, listed strategies with assured or past returns ("Avg Monthly Profit per lot: 25K", "win rate >70%").
  - A broker was fined ₹2 lakh under SEBI Act s.15HB for association, under **clause 4.2 of SEBI circular SEBI/HO/MIRSD/DOP/P/CIR/2022/117 (2 Sep 2022)**. That clause requires brokers to disassociate from any platform referring to past or expected returns of an algorithm. 119 brokers had API integrations with TradeTron.
  - **This is the closest analogue to Satelink Trading AI.**
- **Confirmed (association and performance claims).**
  - SEBI (Intermediaries) Regulations 2008, **reg. 16A** (inserted 29 Aug 2024): SEBI-regulated persons and their agents must not associate (money, referrals, IT-system interaction) with persons giving securities advice or recommendations, or making **return/performance claims**, unless registered or permitted.
  - The RA Regulations (Third Amendment, 16 Dec 2024) bar claims of returns or performance unless permitted by SEBI. **PaRRVA** (past risk and return verification agency) is the permitted route for verified claims by IAs, RAs and algo providers **[commentary: medianama 2025-04, scconline 2024-12-19]**.
- **IA vs RA.**
  - Under the IA Regulations 2013, "investment advice" is advice on securities/investment products for the client's benefit, including financial planning.
  - Under the RA Regulations 2014 (amended 2024), RAs give research reports and buy/sell/hold recommendations. Personalised, portfolio-specific advice for a fee is IA territory; generic signals or recommendations are RA territory **[commentary: vinodkothari.com 2024-08]**.
- **Applied to Satelink Trading AI (uncertain; SEBI lawyer must opine).**
  1. **Upstox copilot (Indian equities/F&O)**: squarely inside the framework. Placing orders via Upstox's API on users' behalf makes Satelink an "algo provider" needing **exchange empanelment**. Every strategy needs broker or exchange approval and an algo ID. AI-generated strategies whose logic users cannot see or replicate are **black-box**, so Jakuraa must **register as a Research Analyst**. AI "signals" or "copilot suggestions" on Indian securities are themselves RA/IA activity. A strategy DSL where users write fully transparent rules (white-box) is the lowest-risk design but still needs empanelment if Satelink places orders.
  2. **Backtests and paper-trading results** shown to Indian users for Indian securities count as "past performance" claims. They are prohibited unless verified through PaRRVA, and they would force Upstox to disassociate (reg. 16A; TradeTron).
  3. **Crypto (Binance):** crypto is not a "security" under SCRA s.2(h) and SEBI has said it lacks jurisdiction **[commentary]**, so SEBI RA/IA rules likely do not apply to pure crypto signals.
     - **PMLA:** Binance is FIU-registered, so users' use is lawful. Jakuraa is not a VDA SP **unless** it custodies, transfers or holds withdrawal-capable keys.
     - **FEMA/LRS for users:** remittances for margin trading abroad are prohibited **[commentary]**, so promoting **Binance futures/perps** to Indian residents is high-risk.
     - Consumer-protection advertising rules still apply.
  4. **Alpaca (US equities):** Indian residents may buy foreign listed equity under LRS (USD 250k per FY; TCS on remittances above ₹10 lakh **[commentary]**). LRS prohibits margin/leveraged trading abroad. SEBI rules do not govern US securities, but promoting overseas trading to Indian retail has drawn exchange and regulator scrutiny before (2022 exchange advisories to brokers **[commentary, not verified]**). For **non-Indian users**, US SEC/FINRA and Alpaca's own terms govern; out of scope here.
  5. **Finfluencer rules** (reg. 16A and the Jan 2025 SEBI restriction on using live market data, under 3-month lag, in "education" content **[commentary]**) affect any Satelink content marketing about Indian markets.
- **Risk:** **High** for Indian securities; Medium for crypto/US. **Advice:** SEBI lawyer. **Status:**
  - **Defer** any Indian-retail live or "copilot" feature.
  - Paper/backtest for Indian securities only in a closed private beta, with **no return claims** in public marketing.
  - Strategy logic must be user-visible (white-box) by design.
  - Broker keys must be trade-only.

---

### Topic 6: Market-data licensing (note only)

- NSE requires an agreement with NSE Data & Analytics Ltd for real-time, delayed or EOD data. **Redistribution of derived data externally requires separate agreements and fees.** Non-display usage has its own policy (https://nsearchives.nseindia.com/web/sites/default/files/inline-files/Non_Display_Policy.pdf; NSE Data Sharing & Usage Policy https://nsearchives.nseindia.com/web/sites/default/files/inline-files/NSE_Data_Sharing&Usage_Policy.pdf **[found via search, not opened]**). BSE has an equivalent regime (not checked).
- Data pulled through a user's Upstox API is licensed to that user and broker. Redisplaying or redistributing it to other users likely breaches broker and exchange terms.
- Crypto-venue terms are covered in `docs/legal/MARKET_DATA_TERMS.md`. That document's conclusions stand: OKX explicitly prohibits analytics redistribution and lists India as restricted; Bybit and Binance conflict as written.
- **Status:** defer. **Advice:** lawyer (licensing).

---

### Topic 7: Consumer Protection (E-Commerce) Rules 2020 and dark patterns

- **Sources:**
  - Consumer Protection Act 2019. s.2(7) defines "consumer" and excludes a person who obtains goods/services "for any commercial purpose".
  - Consumer Protection (E-Commerce) Rules 2020, r.4 (grievance officer to acknowledge within **48 hours** and redress within **one month**; name, contact and designation displayed; refunds within a reasonable time per RBI rules) **[commentary: legitquest, trilegal]**.
  - CCPA Guidelines for Prevention and Regulation of Dark Patterns, 30 Nov 2023, listing 13 patterns including **subscription trap, drip pricing and "SaaS billing"** (PIB https://pib.gov.in/PressReleasePage.aspx?PRID=1983994, accessed 2026-10-15).
  - CCPA self-audit advisory, 5 Jun 2025.
  - **Consumer Protection (E-Commerce) (Amendment) Rules 2026, G.S.R. 789(E), notified 9 Sep 2026, in force 1 Jan 2027**: dark-pattern compliance becomes a binding r.4 duty with an **annual self-audit and a displayed compliance certificate**, National Consumer Helpline convergence, and 30-day prior-price disclosure **[commentary: scconline 2026-09-14, lexcomply; gazette not opened]**.
- **Applicability to B2B SaaS (uncertain).** Business buyers are not "consumers" (s.2(7) commercial-purpose exclusion). However:
  - Satelink sells openly to anyone, including individual developers who may be consumers.
  - The rules apply to e-commerce entities offering to consumers in India.
  - The Trading AI is plainly B2C.
  - Lowest-regret approach: comply.
- **Repo finding.** `apps/corporate/content/company.ts` has `grievanceOfficer.name: null`. r.4 requires the **name**. `CHECKOUT_UNBLOCK_PREP.md` L1–L10 already lists the refund-policy questions.
- **Risk:** Medium. **Status:** fix now (name the officer, publish refund and cancellation terms, check the credit-expiry and auto-renew UI against "subscription trap" and "SaaS billing"). Plan the self-audit for 1 Jan 2027.

---

### Topic 8: DPDP Act 2023, DPDP Rules 2025, SPDI and CERT-In

- **Sources:**
  - DPDP Rules 2025, G.S.R. 846(E), 13 Nov 2025 (PIB https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190014; PIB PDF https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf).
  - Commencement notification G.S.R. 843(E) **[commentary]**.
- **Confirmed timeline.**
  - Rules 1, 2 and 17–21 (the Board) are in force from 13 Nov 2025.
  - Rule 4 (consent managers) takes effect **13 Nov 2026**.
  - Rules 3, 5–16, 22 and 23 (notice, consent, security, breach, rights, children) and **DPDP s.44(2) (omission of IT Act s.43A)** take effect **13 May 2027**.
  - A Jan 2026 MeitY proposal to shorten the 18 months to 12 had **not** been notified as of Sep 2026 **[commentary: mirvolegal 2026-09-20]**.
- **Interim regime.** IT Act s.43A plus the SPDI Rules 2011 still apply until 13 May 2027: privacy policy (r.4), consent for sensitive personal data (passwords, financial information), and reasonable security practices (r.8; ISO 27001 or equivalent).
- **CERT-In Directions** (No. 20(3)/2022-CERT-In, 28 Apr 2022, under IT Act s.70B(6)) **[commentary + NPS Trust mirror]**:
  - report listed incidents **within 6 hours**;
  - keep **ICT logs for a rolling 180 days within Indian jurisdiction**;
  - virtual asset service providers, exchanges and custodian wallet providers must keep KYC and transaction records for 5 years.
  - **Repo memory notes Railway HTTP logs are retained about 15 minutes.** That is a likely gap against the 180-day duty, which applies to "body corporate" generally.
- **Applied.** Satelink processes IPs, wallet addresses (personal data when linkable), emails and auth data. DPDP has extraterritorial reach to processing connected with offering services to people in India.
- **Risk:** Medium. **Status:** now: SPDI privacy policy and CERT-In log retention. By 13 May 2027: full DPDP programme. **Advice:** privacy lawyer.

---

### Topic 9: Companies Act website disclosures

- **Source:** Companies Act 2013 s.12(3)(c). Name, registered office address, CIN, phone, email and website must be printed on "all its business letters, billheads, letter papers and in all its notices and other official publications". **s.12(8)** penalty: ₹1,000/day, capped at ₹1 lakh, on the company and every officer in default **[commentary: taxguru, compliancecalendar]**.
- **Repo finding.**
  - jakuraa.com shows the CIN, GSTIN and registered office.
  - **satelink.network (`apps/web`) has no reference to Jakuraa Commercial Pvt Ltd, its CIN or its registered office** (grep 2026-10-15). Invoices and checkout pages must carry them, and so must a footer or legal page.
  - The CIN's NIC code `52190` is a retail-trade code. A **CS should confirm the MoA objects clause covers software/IT services and VDA-adjacent activity.**
- **Risk:** Low. **Status:** fix now. **Advice:** CS.

---

### Topic 10: Third-party supplier contracts (general note)

- RPC upstreams (Ankr, drpc, 1rpc, Alchemy), x402 facilitator (Coinbase CDP), MoR (Dodo), brokers (Upstox, Alpaca, Binance) and hosting (Railway, Vercel, Cloudflare) each carry terms on **resale and commercial use, acceptable use, geographic restrictions, data residency and indemnities**. Several crypto-venue terms prohibit resale outright (see MARKET_DATA_TERMS.md).
- Before "API procurement", obtain **written reseller rights** from each upstream. Also:
  - mirror upstream SLAs and limitation caps in Satelink's own customer terms;
  - confirm sub-processor and cross-border transfer clauses for DPDP;
  - note that broker API agreements (Upstox) will now impose SEBI algo-framework obligations on Satelink as the broker's **agent**, including complaint handling, audit and kill-switch cooperation.
- **Advice:** commercial lawyer.

---

## 3. Questions for professionals

### For the Indian fintech / regulatory lawyer

1. **FEMA, crypto receipts.** Is Jakuraa's receipt of USDC on Base (to a company EOA) or USDT on Polygon (to a smart-contract vault) as consideration for services exported to non-residents a contravention of FEMA (Manner of Receipt and Payment) Regulations 2023 reg. 3(2), and of FEMA (Export and Import of Goods and Services) Regulations 2026 reg. 4 and 5? If so, what is the remedy for receipts already taken (compounding, conversion and repatriation within 9 months)?
2. **FEMA, holding crypto.** Is holding stablecoins in a company-controlled wallet or contract a holding of a "foreign asset" or "foreign currency" outside permitted routes? Must they be liquidated, and through which channel (an FIU-registered Indian exchange crediting an AD bank account)?
3. **FEMA, outward USDT.** Would paying non-resident node operators in USDT breach the requirement to make payments through an Authorised Bank? Is there any compliant structure short of fiat payouts?
4. **PMLA / VDA SP.** On the wording of S.O. 1072(E) ("for or on behalf of another"), confirm that accepting stablecoins for Jakuraa's own services is not a VDA SP activity. Then, for each of these, state whether it triggers FIU-IND registration: (a) refunding unused credits in USDT/USDC; (b) customer-attributable withdrawable vault balances; (c) node-operator and "distribution pool" USDT payouts; (d) Trading-AI access to user exchange accounts via API keys (trade-only vs withdrawal-enabled).
5. **PSS Act / PPI.** Are Satelink prepaid API credits a closed-system PPI (2021 MD), or within the own-goods carve-out under the draft 2026 PPI MD? Specifically: (a) does refunding unused credits back to the source jeopardise this; (b) does letting credits buy **third-party** APIs (procurement) make Satelink a "marketplace" outside the carve-out?
6. **Payment aggregation.** Does the 50/30/20 revenue share, with customer receipts passed to node operators, constitute payment aggregation or operating a payment system under PSS Act s.4? Which contract structure (separate purchase of node services, not tied to specific receipts) avoids this?
7. **SEBI, algo provider.** Does the Upstox "copilot" (AI proposes; the user confirms each order, or orders are auto-placed) make Jakuraa an "algo provider" needing exchange empanelment under the 4 Feb 2025 circular para III? Does a user-confirm-each-order design change that? What OPS threshold applies?
8. **SEBI, RA/IA.** Are AI-generated strategies or signals on Indian securities "research services" (RA Regs 2014 as amended Dec 2024) or "investment advice" (IA Regs 2013)? Is a user-authored, fully visible strategy DSL a white-box tool outside both? Does Jakuraa need RA registration (the black-box requirement in para V)?
9. **SEBI, claims.** Can Satelink show backtest or paper-trading results on Indian securities to Indian users at all? Only after PaRRVA verification? Does showing them make Upstox (and other brokers) unable to associate with Satelink under Intermediaries reg. 16A and the 2 Sep 2022 circular clause 4.2, given the TradeTron order of 25 Mar 2026?
10. **Offshore brokers.** What are Jakuraa's exposures (FEMA abetment, SEBI, advertising rules) in offering Binance (crypto spot and futures) and Alpaca (US equities) adapters to Indian-resident users, given LRS limits and the ban on margin trading abroad? Should Indian residents be geo-blocked from those adapters?
11. **Consumer protection.** Is Jakuraa an "e-commerce entity" for RPC credits sold to businesses and machines (CPA s.2(7) commercial-purpose exclusion)? Must the grievance officer be a named individual resident in India? What changes are needed for the E-Commerce (Amendment) Rules 2026 effective 1 Jan 2027 (self-audit certificate)? (Also see CHECKOUT_UNBLOCK_PREP L1–L10.)
12. **Data protection.** Are wallet addresses plus IP logs "personal data" under DPDP? What SPDI Rules privacy policy and consent are needed now? Does the CERT-In 180-day in-India log retention duty apply to Satelink (hosted on Railway and Vercel outside India), and how should it be met?
13. **Market data.** Which licences (NSE Data & Analytics, BSE, broker API terms) are needed to display or derive Indian market data inside the Trading AI? Does any redistribution happen if data is fetched per user through the user's own broker session?
14. **Supplier terms.** Do upstream RPC providers' and the x402 facilitator's terms permit resale/markup ("API procurement")? Which indemnity and limitation terms should Satelink's customer terms carry?
15. **Policy watch.** Given that no VDA statute or discussion paper exists, is there any pending RBI or MeitY measure (for example the PPI 2026 draft, or stablecoin statements) that would make continued stablecoin acceptance inadvisable now?

### For the CA (tax and FEMA compliance)

1. **GST, export status of crypto-paid sales.** Do x402 (USDC) and vault (USDT) receipts satisfy IGST s.2(6)(iv) ("convertible foreign exchange")? If not, compute IGST at 18% on past crypto-paid foreign sales (value = open-market value of the VDA), with interest. Should a voluntary payment be made via DRC-03?
2. **GST, recipient location.** For anonymous wallet payers, how do we evidence recipient location under s.13(12) and the s.2(6)(ii) conditions? Is any sale to an unidentified payer a domestic taxable supply by default?
3. **GST, mechanics.** Is a valid LUT on file for FY 2026-27? What invoice format should a per-call micro-billing model use (periodic consolidated invoices)? What SAC code (OIDAR/IT services) and rate (18%) apply? Do e-invoicing thresholds apply? Does a refund of unused prepaid credits need a credit note, and are prepaid credits an "advance" or a "voucher" for time of supply (CHECKOUT_UNBLOCK_PREP L6)?
4. **GST, RCM.** Has IGST under RCM (IGST s.5(3), Notification 10/2017-IGST (Rate)) been paid on imported services (Railway, Vercel, Cloudflare, RPC upstreams, Anthropic and similar)? Quantify the arrears and the ITC.
5. **GST, MoR.** Under Dodo Payments as merchant of record, who is Jakuraa's recipient? Is Jakuraa's supply to Dodo an export (entity location, currency, channel)?
6. **GST, node operators.** If node operators are paid in USDT, what are the GST consequences (barter, valuation, RCM for foreign operators, registration of Indian operators)?
7. **FEMA, export compliance.** With the 2026 export regulations in force since 1 Oct 2026: EDF filing for services within 30 days of month-end, the 9-month realisation clock, EDPMS reconciliation with the AD bank, purpose codes (S08xx) for inward remittances, and STPI vs AD bank as specified authority for software. What changes from the 2015/16 regime that we must operationalise?
8. **Income tax, crypto receipts.** Is receipt of stablecoins for services taxed as business income at the INR value on receipt? Is the later conversion a VDA transfer at 30% (s.115BBH successor in the Income-tax Act 2025) with 1% TDS deducted by the buyer? Confirm the exact 2025 Act section numbers.
9. **Income tax, node operator payouts.** Analyse 1% VDA TDS where consideration is in kind (who deducts when Jakuraa transfers USDT for services), plus service TDS (194C/194J successors) on in-kind payments to residents, and s.195-successor withholding for non-residents.
10. **Income tax, foreign purchases.** For foreign API/hosting purchases, is withholding required under the s.195 successor (royalty/FTS vs business income; DTAA; *Engineering Analysis*)? Confirm Form 15CA/CB practice. Confirm the equalisation levy is fully inapplicable after 1 Apr 2025.
11. **Books and audit.** How should stablecoin balances and the vault be carried in Ind AS/AS financials (inventory vs intangible vs financial asset), and what does the statutory auditor need (wallet-ownership evidence, on-chain reconciliation)?
12. **CARF reporting.** Does the Mar 2026 CBDT crypto-asset reporting amendment (effective 1 Jan 2026) impose any reporting on Jakuraa as a holder or user, as opposed to as a VDA SP?
13. **Company Secretary item (via the CA).** Does the MoA objects clause (CIN NIC 52190, retail trade) cover software/IT services, payment-adjacent activity and the Trading AI? Is satelink.network compliant with s.12(3)(c) (CIN and registered office on invoices, notices and the website)?

---

*Prepared read-only. No files other than this one were modified.*
