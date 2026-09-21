# Restart Inc — Positioning, Revenue & Pricing Strategy (Planning Doc)

Status (updated 2026-09-18): the Lago catalog is live in production with real customers (YATA), Flutterwave payment collection is confirmed working end-to-end, and the console billing page shows real subscriptions/invoices/payment links. What started as a planning doc now doubles as the operational record of how billing was actually wired up — see §7 for the catalog and §8 for a real, confirmed Lago core bug and its fix, which will recur for every new Flutterwave customer until Lago patches it upstream.

## 1. Positioning summary

- Wedge: production discipline as the product. The client console (real Lago billing, multi-tenant admin, 2FA/auth) is proof of delivery discipline, not just marketing — "the same console we use to run your account is the console we wire into your product."
- Don't compete on price vs. offshore shops or solo freelancers. Compete on ownership and continuity: a retainer with a real console/SLA survives one person being unavailable; a freelancer doesn't.
- Workforce model: lean, named senior team is the face of the business. Agentic tooling (Claude/MCP-driven scaffolding, review, test generation) is the internal margin engine, not the sales pitch — "senior-supervised," never "cheaper labor." A standalone "agentic workforce" product only exists as the enterprise Growth Engineering Pod tier, sold explicitly and gated behind a completed Audit or MVP.

## 2. Offer ladder (collapse from ~14 overlapping SKUs to 3 tiers)

1. **Lead-in** — Architecture Audit. Cheap to deliver, proves seniority fast, produces the roadmap that sells the next tier.
2. **Core** — MVP Build (Laravel/Octane) or Medusa Commerce Build. AI Integration Sprint and Fractional CTO work fold in here as line items, not standalone funnels.
3. **Compounding** — DevOps Retainer (renamed from "Care & Growth Retainer" 2026-09-17). The piece that was missing: turns project revenue into recurring revenue. Split into two billed components so cloud cost swings never get quietly absorbed:
   - **A. Support & Maintenance** — your labor, fixed monthly fee, defined SLA and hour cap, overage billed separately.
   - **B. Infrastructure pass-through** — billed at cost + 15–20% management markup, itemized separately, run through Lago's metered billing.

Enterprise "Dedicated Growth Engineering Pod" (turnkey senior team) sits above all three as the $100k+ upsell — never the first thing a prospect sees.

## 3. USD price ladder (international / diaspora / USD-funded clients)

| Offer | Price | Billing terms | Server type | Config | Est. monthly infra cost | Duration |
|---|---|---|---|---|---|---|
| Architecture Audit | $12k flat | One-time | None — audit uses client's existing infra | Read-only access, no provisioning | $0 | 1 week |
| MVP Build (Laravel/Octane) | $35k–$75k | 50% upfront / 50% on delivery | Managed VPS cluster (Hetzner or DigitalOcean) | 2× app nodes (4 vCPU / 8GB), managed Postgres (4GB), Redis (1GB), staging environment | $120–220/mo during build; $150–300/mo post-launch | 4–12 weeks build, then ongoing hosting |
| Medusa Commerce Build | $30k–$70k | 50% upfront / 50% on delivery | Managed VPS or DO App Platform | App node (4 vCPU / 8GB) + Postgres + Redis + object storage (S3/Spaces) for media | $140–260/mo | 6–10 weeks typical, then ongoing |
| AI Integration Sprint | $15k–$30k | Fixed sprint | Add-on to existing infra + vector store | pgvector on existing Postgres, or dedicated vector instance; LLM API usage billed separately (metered, usage-based) | $30–80/mo infra + variable LLM spend ($50–500+/mo by volume) | 2–4 weeks |
| DevOps Retainer — Standard | $2.5k–$4k/mo | Monthly, auto-billed via Lago | Production VPS, single region | 2–4 vCPU / 8GB app + managed Postgres + Redis + daily backups | $150–300/mo (pass-through) | Ongoing monthly |
| DevOps Retainer — Growth | $6k–$10k/mo | Monthly | Production VPS, HA (2 nodes) + CDN | 2× app nodes (4–8 vCPU / 16GB) + managed Postgres HA + Redis + CDN + backups | $350–650/mo (pass-through) | Ongoing monthly |
| Dedicated Growth Pod (Enterprise, 99.99% SLA) | $100k+/mo | Monthly retainer | Dedicated bare-metal or multi-AZ cloud (AWS or Hetzner dedicated) | Multi-node HA cluster, replicated DB cluster, load balancers, multi-region failover, 24/7 monitoring | $1,500–4,000+/mo | Ongoing, SLA-backed |

## 4. Nigeria entity

Restart operates locally as **Restart Integrated Systems Ltd**, registered with the CAC (Corporate Affairs Commission) as a limited liability company. This resolves the earlier open question on NGN invoicing capacity: local invoices can be issued under this entity. Tax obligations under Nigeria's 2025 Tax Reform Act (NRS, formerly FIRS):

- **VAT registration threshold**: mandatory above ₦50m annual turnover (this doubled from ₦25m under the reform). Below that, no charging or filing VAT unless you opt into voluntary registration to claim input VAT on corporate deals.
- **CIT "small company" exemption**: 0% CIT and no standard CIT filing if turnover ≤ threshold and fixed assets < ₦250m — **but the exact turnover threshold is unsettled in the law itself**: the Nigeria Tax Act 2025 says ₦50m, the Nigeria Tax Administration Act says ₦100m. Don't assume the more generous number without an accountant confirming which applies to Restart.
- **Professional/consulting services carve-out**: legal, accounting, medical, and consulting services are excluded from small-company status *regardless of turnover*. This is the open question that matters most here — whether Restart's software/systems engineering delivery is treated as exempt "IT services" or as excluded "consulting" determines whether any small-company CIT/VAT benefit applies at all. Get this classification confirmed before pricing assumes the exemption.
- **WHT (5–10%)**, which corporate NGN clients may deduct at source on service payments regardless of the above — net this into the target price either way.
- **Filing cadence if VAT-registered**: monthly, due by the 21st of the month following the transaction month. CIT (if not exempt): annual, due March 31 following the close of the prior financial year.

Treat the small-company exemption as **not yet confirmed to apply to Restart** — the professional-services carve-out could rule it out entirely. Get this and the current VAT registration status confirmed with an accountant before NGN plans go live in Lago; don't price on the assumption of 0% CIT.

## 5. NGN price ladder (Nigeria-based clients — not an FX conversion of the USD list)

FX snapshot at time of writing (Sept 2026): USD/NGN ~₦1,330–1,375, with a 2026 range of ₦1,338–₦1,445 (~8% swing). This is why infra is pass-through at invoice-date rate rather than fixed.

**Priced conservatively**, per the decision on 2026-09-16: assumes Restart does **not** qualify for the small-company CIT exemption (standard 30% CIT on profit applies) and treats VAT as a real, mandatory pass-through rather than a maybe. Two adjustments from the earlier draft:
- Base fees below are **stated VAT-exclusive** — add **7.5% VAT** at invoicing on every line. VAT is a pass-through (collected from the client, remitted to NRS), so it doesn't erode margin as long as it's always added on top and never quietly absorbed into the headline price.
- The lower bound of each band is raised roughly 10–15% versus the earlier draft, so the quoted fee still clears target take-home margin *after* a 30% CIT bite on profit, instead of assuming a 0% rate that isn't confirmed. If the small-company exemption is later confirmed to apply, that's upside, not a number this list depends on.

| Offer | Price (NGN, excl. VAT) | ~USD equivalent* | Server type | Config | Est. monthly infra cost (USD, converted at invoice date) | Duration |
|---|---|---|---|---|---|---|
| Architecture Audit (local) | ₦2.8M–₦4M | ~$2,000–$2,900 | None — read-only access to client's existing stack | N/A | $0 | 3–5 days |
| MVP Build (local) | ₦9M–₦25M | ~$6,500–$18,000 | Single VPS (Hetzner or DO, cheapest reliable region) | 2 vCPU / 4GB app node + managed Postgres (2GB) + Redis | $25–50/mo | 4–8 weeks build, then ongoing |
| DevOps Retainer — Local Standard | ₦400k–₦600k/mo | ~$290–$430/mo | Single VPS | 2 vCPU / 4GB + Postgres + backups | $25–45/mo (pass-through, billed in NGN at invoice-date rate) | Ongoing monthly |
| DevOps Retainer — Local Growth | ₦1M–₦1.5M/mo | ~$725–$1,100/mo | VPS + standby node | 4 vCPU / 8GB app + managed Postgres + Redis + nightly backups + basic failover | $60–110/mo (pass-through) | Ongoing monthly |

*USD equivalents are for internal margin sanity-checks only — never display USD figures to NGN clients.

Key differences from the USD list, not just smaller numbers:
- Local MVP builds default to Paystack/Flutterwave instead of Stripe, and local SMS/email providers.
- Milestone billing is 40/30/30 (kickoff / midpoint / delivery) instead of 50/50 — local clients are more comfortable with this, and it reduces collection risk.
- Even NGN-priced infra is realistically USD-denominated (Hetzner/DO for reliability), so the pass-through line must say so explicitly.
- Nigerian B2B clients may apply 5–10% withholding tax at source on top of the above — net this into the target price, don't discover the shortfall after invoicing.
- NGN retainer fee held fixed per quarter, with an automatic repricing trigger if USD/NGN moves more than ~7% from the quote date.

## 6. Dedicated production server capacity ladder (Contabo, confirmed 2026-09-17)

Clarified model, simpler than the shared-vs-dedicated split floated earlier: **internal/dev projects stay on the shared `localhost` Coolify box; any project that goes to production always gets its own dedicated Contabo server**, same config as YATA's (the one project currently running on its own box, `svr.yata.network`). There's no in-between shared-hosting tier for real clients.

**Three tiers, not one flat server** (revised 2026-09-17) — a client picks a tier upfront based on need, or moves up later via a Lago plan change on their subscription (Lago handles proration on a mid-cycle plan swap natively — no manual math, no new customer object). **Confirmed annual-commitment-only — no monthly option**, for both currencies:

| Plan | Specs | Raw Contabo cost | NGN (yearly) | USD (yearly) | NGN markup | USD markup |
|---|---|---|---|---|---|---|
| Dedicated Server — VPS 10 | 4 vCPU / 8GB RAM / 75GB NVMe | ~$4.95/mo | ₦280,000/yr (₦28,000/mo equiv.) | $200/yr ($20/mo equiv.) | ~4.2x | ~4.0x |
| Dedicated Server — VPS 20 | 6 vCPU / 12GB RAM / 100GB NVMe | ~$6.36/mo | ₦360,000/yr (₦36,000/mo equiv.) | $300/yr ($30/mo equiv.) | ~4.2x | ~4.7x |
| Dedicated Server — VPS 30 | 8 vCPU / 24GB RAM / 200GB NVMe | ~$12.00/mo | ₦680,000/yr (₦68,000/mo equiv.) | $500/yr ($50/mo equiv.) | ~4.4x | ~4.2x |

USD infra is priced close to real cost + the same markup range as NGN, deliberately **not** inflated the way the rest of the USD list is relative to NGN (e.g. MVP Build is ~4-5x pricier in USD than NGN) — the underlying Contabo bill is identical regardless of client market, so there's no cost basis for charging international clients materially more for the same server.

**"2 months free" still shown even though monthly isn't selectable**: each plan's Lago `description` field states the monthly-equivalent rate and the 2-months-free framing (e.g. "billed annually, equivalent to ₦28,000/mo (2 months free vs. paying monthly)"), so that appears on the plan/invoice even though a client can't actually choose to pay monthly. Both catalog scripts carry this description text now — the 3 NGN plans (created directly in the dashboard before this was decided) still need it added manually to match.

All six are Lago **plans** (fixed recurring amount), not the variable `infra-passthrough` add-on — the specs are standardized, so this isn't a "bill whatever the actual invoice was" case the way a custom enterprise server would be. `infra-passthrough-usd`/`-ngn` remain for genuinely variable/custom infra outside this ladder.

Sources checked for the Contabo benchmarks: [Contabo Cloud VPS 10](https://www.vpsbenchmarks.com/hosters/contabo/plans/cloud-vps-10), [Contabo Cloud VPS 30](https://www.vpsbenchmarks.com/hosters/contabo/plans/cloud-vps-30), [Contabo 2026 pricing guide](https://cybernews.com/best-web-hosting/contabo-review/pricing/) — one source flagged Contabo's lineup as possibly being restructured, so re-verify against contabo.com directly before the VPS 20/30 tiers are ever quoted to a real client.

## 7. Lago catalog setup (done — confirmed live 2026-09-17)

Catalog: one `plan` per recurring retainer (USD + NGN), one `add_on` per one-time offer (Audit, MVP Build, infra pass-through, USD + NGN). Recurring retainers use Lago **plans**; one-time offers and the infra pass-through use Lago **add-ons**, which support per-invoice amount override — matches how the price bands work (a documented range, not a fixed number, with the actual figure locked at deal/invoicing time).

Codes:
- `devops-retainer-standard-usd`, `devops-retainer-growth-usd`, `growth-engineering-pod-usd` (plans)
- `devops-retainer-standard-ngn`, `devops-retainer-growth-ngn` (plans)
- `dedicated-server-vps10-ngn`, `dedicated-server-vps20-ngn`, `dedicated-server-vps30-ngn` (plans — §6, yearly only, restructured 2026-09-17)
- `dedicated-server-vps10-usd`, `dedicated-server-vps20-usd`, `dedicated-server-vps30-usd` (plans — §6, yearly only, added 2026-09-17, not yet created in Lago)
- `architecture-audit-usd`, `mvp-build-usd`, `medusa-commerce-build-usd`, `ai-integration-sprint-usd`, `infra-passthrough-usd` (add-ons)
- `architecture-audit-ngn`, `mvp-build-ngn`, `infra-passthrough-ngn` (add-ons)

**Naming/code changes made directly in the Lago dashboard, not through either script (2026-09-17):** "Care Retainer" renamed to "DevOps Retainer" across all 4 USD/NGN plans (codes renamed to match, safe since all had 0 subscriptions). The single flat `dedicated-server-contabo-ngn-monthly`/`-yearly` pair was replaced with the 3-tier `dedicated-server-vps{10,20,30}-ngn` ladder above (yearly only) — the monthly variant was dropped in the process, not carried forward, and is an open question in §6. **Both catalog scripts below have been updated to match this live state** so a future re-run won't try to recreate the old `care-retainer-*` or `dedicated-server-contabo-*` codes.

Every code is seeded at the **floor of its documented price band**, since Lago plans/add-ons hold one number, not a range. Actual deals get invoiced at the negotiated figure via a one-off invoice with the amount overridden — the catalog entry just guarantees the SKU exists to subscribe/invoice against.

**Infra note (2026-09-17):** `LAGO_API_URL` must be `https://billing-api.restart.ng` with **no `:3000`**. Coolify's reverse proxy terminates TLS on 443 for that domain and routes internally to the container's port 3000 — hitting `:3000` directly on the host bypasses the proxy and gets "connection refused," since that raw port isn't published externally. This was wrong in the hardcoded default in both edge functions and the local script (now fixed); if `LAGO_API_URL` is also set as an explicit Supabase secret, that value needs the same correction or it'll override the fixed default right back to broken.

**Catalog is now clean (2026-09-17):** the pre-existing entries (`devops-retainer`, `managed-services`, `vps`, `shared-hosting`) predated any real production billing and have been deleted from Lago — none of them had active subscriptions. The 15 codes below are the entire production catalog now, not an addition to an older one.

**Lago add-on validation quirks (2026-09-17, confirmed against production):**
- **`amount_cents: 0` is rejected** ("value_is_out_of_range") on an add-on — a plan can apparently hold 0, but an add-on can't. `infra-passthrough-usd`/`-ngn` were seeded at `0` to mean "always overridden, no fixed price," which doesn't work; they now use a nominal 100 (i.e. $1 / ₦1) placeholder instead.
- **There's an upper ceiling on add-on `amount_cents` somewhere between 280,000,000 and 900,000,000.** `architecture-audit-ngn` at 280,000,000 succeeded; `mvp-build-ngn` at the real documented floor of 900,000,000 (₦9M) failed with the same "value_is_out_of_range" error. The exact threshold wasn't pinned down further (didn't want to keep probing production) — `mvp-build-ngn`'s catalog entry now seeds at 250,000,000 as a placeholder, comfortably under the confirmed-working value. **This does not change the real MVP Build price** — that's still the documented ₦9M-25M band, applied at invoicing time via the one-off override this catalog design already relies on. If a future NGN plan/add-on needs a genuinely large fixed amount (not a floor placeholder), this ceiling needs to be found precisely first (check Lago's source/changelog for the exact `amount_cents` validation, or ask Lago support) rather than assumed away.

**Two ways to seed it, same catalog, same idempotent behavior** (create only what's missing, never edit or delete an existing plan/add-on — a later price change is a manual edit in Lago, not a re-run):

- **[supabase/functions/setup-lago-catalog/index.ts](supabase/functions/setup-lago-catalog/index.ts)** — now that `LAGO_API_KEY` is configured in Supabase, this is the primary path. Admin-gated the same way `console-billing` gates workspace billing reads (caller's JWT must carry `app_metadata.is_admin`). `GET` does a dry run (lists what would be created, writes nothing); `POST` actually creates missing plans/add-ons. Claude has not called this — it needs an admin session's JWT, which lives in the browser after logging into the console, not something available here. Call it yourself, e.g. from the browser console while logged in as admin, or via curl with that session's access token:
  ```bash
  curl -X POST "$SUPABASE_URL/functions/v1/setup-lago-catalog" \
    -H "Authorization: Bearer <your admin access token>" \
    -H "apikey: $SUPABASE_ANON_KEY"
  ```
  Drop `-X POST` for a dry run first.
- **[scripts/setup-lago-plans.mjs](scripts/setup-lago-plans.mjs)** — a local alternative that talks to Lago directly with your own `LAGO_API_KEY` exported in the shell, for anyone who'd rather not go through Supabase. Same dry-run-by-default, `--apply`-to-write behavior. Keep the two catalog lists in sync if either changes.

Still open, for whenever pricing goes live in the console:
- Pricing visibility should key off the client's workspace currency/region, not just "logged in," otherwise every client sees both lists — undercuts the "your price is scoped to you" positioning.
- If pricing surfaces inside a "Delivery Milestones & Roadmaps" tab, that framing fits retainer/change-order pricing well (cost of remaining work) but is an odd frame for the initial Audit/Build sale — likely want Audit/Build pricing visible pre-engagement (site or proposal) and reserve the console tab for retainer and milestone-linked pricing.
- VAT registration status and the small-company classification (§4) should be resolved before the NGN add-ons are ever invoiced against a real client, even though the catalog entries are safe to seed now.

## 8. Flutterwave payment collection — confirmed working, with a real Lago bug and its fix (2026-09-18)

**Verified end-to-end**: YATA's ₦1,500,000 invoice generated a real, live Flutterwave hosted checkout page (`checkout.flutterwave.com`) via Lago's own native "Open payment link" button — correct merchant (Restart Integrated Systems Ltd), correct customer, correct amount, all payment methods rendering. This confirms the entire chain works: Lago customer → Flutterwave provider link → `payment_url` generation → real Flutterwave checkout.

**The bug, root-caused by reading Lago's own source** (`getlago/lago-api`, not a separate community repo — Flutterwave support lives in Lago's core codebase, just labeled "Built by community" in the UI for support-disclaimer purposes):

- The dashboard's "Connect to external apps" customer form saves `customer.billing_configuration.payment_provider` correctly, but never creates the actual link record (`PaymentProviderCustomers::FlutterwaveCustomer`) that `Invoices::Payments::GeneratePaymentUrlService` and `Customers::GenerateCheckoutUrlService` both require — no toggle exists in that UI to trigger it.
- Calling the customer API with `billing_configuration.sync_with_provider: true` (documented in `Customers::UpsertFromApiService`) **does** create that link record — but `PaymentProviders::CreateCustomerFactory` creates it with **`payment_provider_id` left `nil`**, never pointing at the org's actual Flutterwave provider row. Confirmed at the database level via Coolify's Terminal tab on the `restart-billing` service, `api` container:
  ```bash
  bundle exec rails runner 'pp Customer.find_by(external_id:"yata").payment_provider_customers.pluck(:type,:payment_provider_id,:provider_customer_id)'
  # => [["PaymentProviderCustomers::FlutterwaveCustomer", nil, nil]]
  ```
  Since `GeneratePaymentUrlService` looks up the link via `customer.payment_provider_customers.find_by(payment_provider_id: <real provider id>)`, a `nil` FK always misses, always returning `missing_payment_provider_customer` ("customer is not linked to a valid payment provider") — even though the link record technically exists and the customer's config looks fully correct.
- This is why **both** my code's call and Lago's own native "Open payment link" button failed identically — same core service, same broken FK, regardless of which surface calls it. Confirmed this also means Lago's own customer self-service portal (`portal_url` → `checkout_url`) would hit the exact same wall the moment a client tried to pay from inside it — this bug is universal across every payment-collection entry point in Lago, not specific to our console or Supabase layer.

**The fix** — a one-row, one-column correction once the broken record is identified:
```bash
bundle exec rails runner 'c = Customer.find_by(external_id:"yata"); fc = c.payment_provider_customers.find_by(type:"PaymentProviderCustomers::FlutterwaveCustomer"); fc.update!(payment_provider_id:"<org flutterwave provider id>"); pp fc.reload.attributes'
```
Get the org's real Flutterwave provider id via:
```bash
bundle exec rails runner 'pp PaymentProviders::FlutterwaveProvider.pluck(:id,:code,:organization_id)'
```
For Restart Inc, that id is `950a90ff-b58d-4ffe-ada5-3dad4637b5d1` (code `flw_main`) — stable across customers, only the `external_id` in the first command changes per customer.

**This will recur for every new Flutterwave customer** until Lago patches the factory bug upstream — the API sync step (`sync_with_provider: true`, via [supabase/functions/sync-lago-payment-provider/index.ts](supabase/functions/sync-lago-payment-provider/index.ts)) is still a required first step (it creates the link record), but must always be followed by this manual FK correction via Coolify's Terminal. Treat both steps as one standing runbook entry for onboarding any Flutterwave customer, not two independent fixes. Worth filing as a GitHub issue against `getlago/lago-api` given it's core-repo code with a clear, reproducible defect — the evidence trail above (source reading + DB-level confirmation) is a strong basis for a bug report.

**Webhook registered** (2026-09-18): the Flutterwave webhook URL (from Lago's connection page, `https://billing-api.restart.ng/webhooks/flutterwave/c1a3dc95-8ec8-47f7-a1e9-38488085e119?code=flw_main`) is now registered in Flutterwave's dashboard. Not yet confirmed against a real transaction that it correctly flips a Lago invoice to paid — that's still an open verification step.

**Two unrelated bugs in our own `console-billing` edge function** (2026-09-18, found after the above was already fixed) — the Lago-side fix alone didn't make the "Pay Now" button appear, because [supabase/functions/console-billing/index.ts](supabase/functions/console-billing/index.ts)'s own `payment_url` POST had two separate mistakes:
1. `lagoPost` sent `Content-Type: application/json` with no request body at all — Lago's Rails backend rejects that as malformed JSON, while the dashboard's own button sends `"{}"`. Fixed by sending `body: "{}"`.
2. Even after (1), the code read `body.invoice.payment_url` / top-level `body.payment_url`, neither of which exist. Reading `Api::V1::InvoicesController#payment_url` and `V1::PaymentProviders::InvoicePaymentSerializer` in Lago's source showed the real response root is `invoice_payment_details.payment_url`. Fixed the key.

Both silent-`null` failure modes were made loud (`paymentUrlError` field per invoice, `lagoPost` returning the real status/body) rather than swallowed, so a future regression here won't require re-deriving this from scratch. Verified end-to-end 2026-09-18: the ₦1,500,000 pending invoice now shows a working "Pay Now" button that opens a real Flutterwave checkout.

## 9. Pricing exposure to agentic-AI price compression (opened 2026-09-19)

Raised question: with agentic coding tools now widely available, is the offer ladder (§2–3) dated? Answer: the *positioning* (§1) already hedges against this correctly — "compete on ownership and continuity, not price" and "agentic tooling is the margin engine, not the sales pitch" is the right defense. The exposure is uneven across the ladder, not uniform:

- **Lead-in (Audit) and Compounding (Retainer) are largely insulated.** Nobody undercuts "the console/SLA/continuity that survives you being unavailable" with a cheaper AI-augmented freelancer — that's an institutional-trust product, not a coding-throughput product.
- **Core (MVP Build, Medusa Build, AI Integration Sprint) is where the price crash actually bites.** A generic "build me an app" quote is now directly comparable to what any competitor running Claude Code/similar can offer at a fraction of the price. The **AI Integration Sprint** ($15k–$30k) is the single most commoditized line on the ladder — "AI integration" is now a crowded, cheap-to-fake service category.

**Recommendation (not yet actioned — needs Ademola's sign-off on actual figures):** don't cut Core-tier prices to chase commoditized competitors; that concedes the "don't compete on price" wedge we've built everything else around. Instead:
1. Reframe Core-tier sales language so the deliverable is explicitly "production discipline bundled into the build" (console, audit trail, review gates), not "an app" — the same distinction Founding Engineer's own operating instructions now encode for delivery work.
2. Weight the sales narrative toward Compounding/Enterprise sooner in the funnel — since agentic tooling has lowered Restart's own internal delivery cost, margin on Core-tier work should be improving even if headline prices hold, which strengthens the case for using Core as a loss-leader into the Retainer rather than a standalone profit center.
3. Revisit the AI Integration Sprint specifically — either narrow its scope to something harder to replicate (e.g., building on Restart's own agentic-ops tooling now that Paperclip is live internally) or fold it further into Core builds as a line item rather than a standalone sale, since standalone "AI integration" is the most exposed SKU on the list.

Actual price-band changes are **not yet made** — this section records the analysis and direction, not a repriced §3.

## 10. Lead generation channel strategy (opened 2026-09-19)

The Growth/BD hire (RES-6) is scoped to *inbound* lead triage and qualification — it does not address top-of-funnel lead generation. For Restart's actual deal shape ($10k–$100k+, relationship/trust-driven, long sales cycle), channel priority should be:

1. **Referrals from existing clients** (YATA, TaxIQ, Lubcon, Kumoda) — highest-converting channel for this kind of sale; the "continuity" pitch is most persuasive to someone who's already lived it.
2. **Content/SEO**, leveraging the already-chosen "Operator's Field Notes" editorial brand direction — case studies and audit-style writeups compound over time and pre-sell the "evidence before hype" positioning before a prospect ever talks to sales.
3. **Targeted outbound** for the $50k+ tiers specifically — a narrow, well-defined ICP outreach beats broad reach at this deal size.
4. **Paid ads deliberately last, if at all** — high-ticket relationship sales convert poorly off cold ad clicks, and ad-driven traffic skews toward price-shoppers, which directly fights the "don't compete on price" wedge.

Not yet actioned — see the follow-up task assigned to the COO for turning this into a concrete referral/content/outbound plan.
