# Lago (billing.restart.ng): patched build, read this first

Our self-hosted Lago is **not the stock image**. It is upstream Lago `v1.53.0` with a small set
of patches applied at build time. **A stock Lago will not behave the same: the screens below
show a premium popup and the payment link crashes.** So:

> **Every Lago upgrade, and every new client deployment of Lago, must be built from this
> folder, and the patches re-checked.** Never point a deployment at `getlago/api` /
> `getlago/front` directly.

Current build: **`v1.53.0-p7`** (images `restart/lago-api:v1.53.0-p7`, `restart/lago-front:v1.53.0-p7`),
running in Coolify service `restart-billing` (uuid `pwz5mon2kh40psk4eb2fv0z7`).

## What is patched

Two kinds of patch. Both are applied by `sed` / a script during `docker build`, and **each step
fails the build if upstream's code no longer matches**, so a version bump can never silently
ship an unpatched or half-patched Lago.

### 1. Licence gates lifted (self-hosted Lago hides these behind a paid licence)

Only the features below. Everything else stays behind the premium popup.

| Feature | API (`api.Dockerfile`) | Front end (`patch-front.mjs`) |
|---|---|---|
| Record a payment (manual payments) | `payments/manual_create_service.rb` | invoice list, invoice page, payments page, customer payments tab |
| API keys beyond the first, with scoped permissions | `api_keys/create_service.rb`; `api_permissions` forced on in `organization.rb` | API keys list and form |
| Billing entity timezone and email settings | `billing_entities/update_service.rb` | timezone block, email scenarios |
| Invoice emails (`invoice.finalized`) | every `email_settings.include?` sending path | email scenario switches |
| Manual "Request overdue payment" | `payment_requests/create_service.rb` | request-payment page |
| Credit notes (create + estimate) | `credit_notes/create_service.rb`, `estimate_service.rb` | "Issue a credit note" in 3 places |
| Add an entity (no cap) | `organization.rb` entity limit, `billing_entities/create_service.rb` | none (follows the API) |
| Plan overrides on a subscription (a per-client price, name, description or trial on a standard plan; the "Unlock plan overrides" banner and the Edit ✨ buttons on the subscription's plan tab) | `subscriptions/create_service.rb`, `subscriptions/update_service.rb`, `plans/override_service.rb` | `useSubscriptionPremiumGate` hook, plan tab banner, create/edit subscription form |

Plan overrides cover what `plan_overrides` carries on a subscription (including its charges). Editing
a charge or charge filter on its own endpoint (`update_or_override_charge_service`,
`update_or_override_fixed_charge_service`, `charge_filters/*`) is still licence-gated. To use an
override: open the subscription, Subscription plan tab, Edit on "Subscription fee". It creates a
child plan for that customer only; the shared plan and other customers are untouched.

Still gated on purpose: payment receipt emails, analytics dashboards, plan features (progressive
billing, minimum commitment), wallets and alerts, custom roles, SSO, integrations, AI. Unlock one
only when asked for by name, and add it to this table.

### 2. Upstream bug fixes (not licence gates)

- `invoices/payments/flutterwave_service.rb`: upstream builds the Flutterwave checkout for the
  invoice's **full total**, ignoring payments already recorded (a ₦1.5m invoice with ₦1m paid
  asked for ₦1.5m). The patch charges `total_due_amount_cents`, and makes `tx_ref` unique per link
  (Flutterwave refuses a `tx_ref` that already has a successful payment, which would block a
  second part-payment). A payment link already created is reused for 24 hours, so after
  deploying this, expire any open payment intent for an invoice that already has payments.
- `payment_intents/fetch_service.rb`: upstream v1.53.0 reads `provider_session_id` from the
  payment provider's result, which only Stripe defines. For Flutterwave "Open payment link"
  raised `NoMethodError`, and the console's "Pay Now" never appeared. The patch reads it only
  when present. **Check whether a newer upstream still needs it** before carrying it forward.

## Files

| File | Purpose |
|---|---|
| `api.Dockerfile` | the API patches (one `RUN` per patch); `FROM getlago/api:<version>` |
| `patch-front.mjs` | the front-end patches, run inside the front build |
| `front.Dockerfile` | the front build, for reference/local builds |
| `restart-billing.compose.before.yml` | the stock upstream compose, kept as the base and as a rollback |
| `generate-compose.mjs` | builds `restart-billing.compose.yml` from the files above |
| `restart-billing.compose.yml` | what is pasted into Coolify (**generated, do not hand-edit**) |
| `purge-test-data.sql` / `.sh` | one-off test-data cleanup (dry run by default) |

## Upgrading Lago, or setting up a new client deployment

1. **Back up the database first.** In the `db` container terminal:
   `pg_dump -U lago -d lago -Fc -f /tmp/lago-pre-upgrade.dump`, then copy it **off the host**
   (`/tmp` inside the container is lost when it is recreated). The API runs migrations on start,
   which cannot be undone by going back to the old image.
2. **Bump the version** in four places: `FROM getlago/api:<v>` in `api.Dockerfile`,
   `front.Dockerfile`, the `#<v>` git tag in the front build context (in
   `generate-compose.mjs`), and the comment in `patch-front.mjs`.
3. **Dry-run the patches against the new source.** Clone `getlago/lago-front` and
   `getlago/lago-api` at the new tag, then:
   - front: from the front repo root run `node <this folder>/patch-front.mjs` (a fresh clone,
     once; it edits files in place).
   - API: run each `RUN` step from `api.Dockerfile` against the cloned files.
   Any step that fails means upstream changed that code: read the new code, update the patch,
   and for the bug fix check whether upstream fixed it.
4. **Regenerate the compose**: `node generate-compose.mjs v<version>-p1` (the tag must change on
   every patch edit so Coolify rebuilds).
5. **Apply in Coolify**: `restart-billing` → Edit Compose File → paste the generated file →
   Deploy. The build runs on the Coolify host (the front takes ~5 minutes) and billing is down
   while the containers swap, so plan for about ten minutes.
6. **Check it works** (after a hard refresh):
   - Invoice → Actions → *Record a payment*, *Issue a credit note*, *Open payment link*: no premium popup.
   - Developers → API keys → *Add a key*, with a permissions section.
   - Settings → billing entity → Timezone → *Edit*; *Add an entity*; Email scenarios switches.
   - `https://billing-api.restart.ng` reports the new version.
7. **Commit** the folder so the repo matches production.

For a **new client** running their own Lago: create the Coolify service from
`restart-billing.compose.yml`, set the environment variables below, then run step 6.

## Environment variables the service needs (set in Coolify, not in this repo)

Lago core: `SECRET_KEY_BASE`, `LAGO_RSA_PRIVATE_KEY`, `LAGO_ENCRYPTION_*`, `LAGO_API_URL`,
`LAGO_FRONT_URL`, `SERVICE_PASSWORD_POSTGRES`, `LAGO_ORG_*`.
Outgoing email: `LAGO_FROM_EMAIL` and `LAGO_SMTP_ADDRESS`, `LAGO_SMTP_PORT`, `LAGO_SMTP_USERNAME`,
`LAGO_SMTP_PASSWORD`. Without them Lago cannot send any email at all.
Payments: the Flutterwave integration is configured inside Lago (Integrations), not in env vars.

## Related, outside this folder

- Billing emails (invoice issued, payment received, overdue) and the weekly overdue reminder are sent
  by the console, not Lago: `supabase/functions/lago-webhook` and `console-billing-reminders`.
  The Lago webhook endpoint (Developers → Webhooks) must point at `lago-webhook`, with HMAC signing and
  `LAGO_WEBHOOK_HMAC_KEY` set on the Supabase edge runtime. If Lago's own invoice emails are switched
  on as well, clients get two.
- The console reads Lago through `LAGO_API_KEY` on the edge runtime. Keys created in Lago with scoped
  permissions are enforced, so a key used by the console must keep the permissions it needs.

## Licence note

These patches remove licence checks in code that is AGPL-licensed, on infrastructure we run. Lago also
sells these features commercially; if Restart ever needs vendor support, or the terms matter to a
client, buying a Lago licence removes the need for the patches above (keep the bug fix).
