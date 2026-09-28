# When to extend the existing system — and when to redraw the boundary.

At 15,000 organisations, a Pan-African treasury and billing platform started losing the end-of-month race. Shared-database contention stretched reconciliation to 4.5 hours. Queue backlogs delayed webhooks by hours, and compliance warnings followed.

The obvious argument was whether the Laravel codebase needed a rewrite or refactor. That was the wrong argument. The urgent question was which concerns should share a database boundary, transaction, failure domain, and one team’s release process.

## The boundary, not the codebase, is the decision

“Rewrite or refactor” makes architecture sound like a judgement on code quality. A better test is operational: **what must be deployed, scaled, failed, and owned together?** If those answers line up, extend the existing boundary. If not, redesign it before deciding how much code survives.

Extending is the cheaper choice when the boundary is sound and only its implementation has degraded. An inefficient query, an under-sized queue, or a runtime with poor memory behaviour can be corrected inside the existing unit. Deploy the index, tune the worker pool, measure, and roll back if the result is wrong.

Redrawing is necessary when the change crosses the boundary. A requirement that must scale independently cannot remain behind a shared bottleneck. A compliance guarantee for one ledger or tenant cannot be credible if controls are system-wide. A team releasing weekly cannot be coupled to one releasing quarterly. A synchronous call holding a user request open may belong behind an asynchronous contract with explicit retry and delivery semantics.

## Boundary signals appear before the outage

Look for signals that describe future operating constraints, not just present slowness. Two features that need different capacity curves are a warning: an invoice reconciliation job competing with interactive billing requests will eventually make one miss its SLO. Two teams whose release cadences block each other are another. Count how often a small change waits for an unrelated deployment and the rollback surface created by that coupling.

Check the failure domain. If a webhook provider times out, does the financial write fail with it? If one tenant generates a large reconciliation batch, can it consume workers needed by every other tenant? If an audit rule requires immutable history for one part of the product, can an operator still update those records through a general-purpose model?

These are boundary questions because the symptom remains after local code becomes cleaner. More threads do not fix workloads needing independent scaling. More tests do not make system-wide guarantees satisfy isolated evidence. A faster synchronous call is still synchronous when the caller should not own its retry policy.

In the treasury platform, the repair was structural. Restart introduced schema-level tenant isolation, immutable append-only event streams for the financial ledger, and horizontal sharding by transaction velocity. Laravel Octane and Swoole improved runtime behaviour, but the boundary changed so tenant contention, financial history, and processing capacity could be controlled separately. Reconciliation fell to under 30 seconds, with capacity for more than 50,000 tenants and 99.99% availability.

## Separate the consistent path from the eventual path

The most useful decomposition is not “old module versus new module”. It is **transactional and consistent versus eventually consistent**.

The financial path must record one authoritative fact and reject duplicate retries. Notifications, projections, reports, and webhook delivery can catch up from it. Mixing them into the transaction expands the critical path; mixing them into mutable tables makes repair guesswork.

A minimal ledger boundary makes the distinction explicit:

```sql
CREATE TABLE ledger_entries (
  id              uuid PRIMARY KEY,
  account_id      uuid NOT NULL,
  idempotency_key text NOT NULL,
  amount_minor    bigint NOT NULL,
  currency        char(3) NOT NULL,
  occurred_at     timestamptz NOT NULL,
  UNIQUE (account_id, idempotency_key)
);

INSERT INTO ledger_entries (...)
VALUES (...)
ON CONFLICT (account_id, idempotency_key) DO NOTHING;
```

The idempotency key is stored with the authoritative write, before publishing a notification or attempting another side effect. A retry becomes a no-op at the ledger boundary rather than a second debit for a repair job to discover.

Append-only removes the class of bugs in which a mutable balance and incomplete audit trail disagree after a timeout, retry, or partial rollback. Derived balances and webhook records can be rebuilt from the ledger. The financial fact cannot be silently overwritten.

## Redrawing means operating two systems for a while

A new boundary creates an operational bill. During migration, a small team may own two deploy pipelines, dashboards, alert paths, and reconciliation while supporting the old product. Incidents can cross the seam. Engineers must decide which system is authoritative, how duplicate events behave, and when to delete the old path.

That cost is real, but different from keeping a boundary that cannot express the requirement. Define the dual-run duration, mismatch threshold, rollback trigger, and cutover owner. For a small team, this may postpone unrelated feature work for several weeks; a new service is not free once its repository exists.

A global logistics firm provides the technique worth copying. Its legacy multi-tenant SaaS suite held more than 7TB of operations data and strict role-based permissions. Restart ran a synchronized shadow deployment with parallel replication conduits and real-time idempotency validation for 14 days. The off-peak DNS cutover completed with zero system downtime and no dropped transaction or inventory discrepancy.

“We copied the data” proves that a transfer completed. “We ran both systems for fourteen days and the numbers matched” proves alignment under live conditions, including permissions, retries, late updates, and drift.

### The trap: a redraw can be a rewrite in disguise

Re-implementing the same boundary in a new framework is not architectural change. If the same team owns the same deployable, the same transaction couples the same concerns, and the same outage affects the same users, the new framework buys novelty and nothing else.

Name the independent scaling unit, consistency guarantee, failure domain, or ownership boundary that will change. If you cannot name one, improve the existing implementation instead.

## Check the boundary this week

Take the last five incidents or delayed releases and ask: what shared a deploy, transaction, failure domain, and ownership? Mark the pairings that forced unrelated work to wait or made one concern inherit another’s outage.

Then choose one seam and write its contract: the authoritative write, idempotency key, retry rule, eventual side effects, and rollback condition. If it cannot be described without hand-waving, the boundary is not ready to move. If it can, size the change honestly — as an extension or as a migration that temporarily requires two systems.

> Decide the boundary first. The amount of code you rewrite stops being a matter of taste.

---

> **The boundary is the decision. The amount of code you rewrite is downstream of it.**
>
> The **Architecture Audit** is a one-week technical deep dive that ends in a prioritised 12-week remediation plan. It is the fastest way to get an outside read on where the boundary actually sits before you commit a team to either path.
>
> **[Scope this with a senior engineer →](https://restart.ng/start-project?tier=ARCHITECTURE%20AUDIT)**
>
> Three short steps. A senior engineer reads your brief — not a sales queue — and replies within 24 hours with whether there is a fit and the clearest next step.
