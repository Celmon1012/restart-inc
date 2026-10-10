# Restart Inc.

Website (`client/`), client console (`console/`), Supabase edge functions and migrations
(`supabase/`), and infrastructure (`infra/`).

## Billing (Lago): do not deploy stock Lago

`billing.restart.ng` runs a **patched** Lago build, not the upstream image. Every Lago upgrade
and every new client deployment must be built from [`infra/lago/`](infra/lago/README.md) and the
patches re-checked, or invoices, credit notes, API keys, timezone and the Flutterwave payment
link break. Read [`infra/lago/README.md`](infra/lago/README.md) first.
