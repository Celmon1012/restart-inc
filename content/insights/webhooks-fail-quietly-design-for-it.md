# Webhooks fail quietly. Design your systems to notice when they do.

At Black Friday peak, the omni-channel retailer handled 4,200 requests per minute. Its custom wholesale tier pricing ran synchronously on checkout page loads, so traffic triggered rate-limit throttling, abandoned carts, and missed enterprise replenishment orders.

Restart moved the work into an asynchronous Kafka/Redis pipeline, pre-computed wholesale price matrices, cached tier entitlement tokens at the edge, and added automated dunning. The result was 100% order processing reliability, a 99.99% webhook ingestion SLA with dead-letter queues and replay, and zero milliseconds of wholesale price calculation at checkout.

That engagement illustrates the uncomfortable default: at volume, delivery failure is steady state. A webhook can be lost, duplicated, delayed, or reordered while every component reports healthy. The dangerous failure leaves no exception or immediate complaint while financial or inventory state drifts.

## Treat every delivery as lost until the system proves otherwise

A sender's successful HTTP request means only that a receiver accepted a request. It does not prove that the event was applied, that its side effect committed, or that a later event will not arrive first. Network timeouts create ambiguity: the receiver may have committed the order update, but the response disappeared before the sender saw it. The sender retries, and your handler receives the same event again.

At-least-once delivery is therefore the practical contract. Mainstream webhook senders retry because they cannot distinguish a lost response from a failed handler. Your consumer must make a duplicate harmless, not hope the sender will avoid one.

A payment-captured event processed twice can credit a customer twice. An inventory-reserved event can decrement stock twice. A shipment-created event can produce duplicate fulfilment records or notifications. These are the normal consequence of retry semantics.

## Ordering is where otherwise careful consumers fail

A unique event key is necessary, but it is not enough to check for an existing key in application code. Two workers can both execute `SELECT`, both see no row, and both perform the side effect before either insert wins. That is a race, even when the check and the insert are adjacent in the same function.

### Claim the event before applying its effect

The database constraint must arbitrate the race. The event key is written inside the same transaction as the state change, and it is written first:

```sql
BEGIN;
INSERT INTO webhook_receipts (event_key, received_at)
VALUES (:event_key, now())
ON CONFLICT (event_key) DO NOTHING;
-- Continue only when the insert affected one row.
INSERT INTO inventory_ledger (order_id, delta, reason)
VALUES (:order_id, :delta, 'webhook');
COMMIT;
```

The handler proceeds only when the first insert claims a new key. A duplicate hits the uniqueness constraint and exits without applying the ledger change. If the process crashes after the receipt insert but before the ledger insert, the transaction rolls back both writes. A retry can then claim the key and apply the effect. That is why the key must be recorded before the effect, not after it.

This pattern applies to state held in one database transaction. For an external side effect, persist an outbox record with the claim; a remote API call is not atomic with your database.

## Authenticity has a time limit

Idempotency answers “should this event be applied twice?” Signature verification answers “did the sender produce this body?” Verify the HMAC over the raw request bytes before parsing JSON. Parsing and re-serialising can change whitespace, key order, escaping, or number representation, so verifying a reconstructed object is not verification of what was signed.

Use a constant-time signature comparison and reject requests outside a bounded timestamp tolerance. A valid signature with an unbounded replay window is equivalent to no verification: an attacker who captures one legitimate request can resend it indefinitely. The idempotency key limits repeated application, but it does not replace authenticity, expiry, or audit logging.

Keep the raw body long enough to verify it, and record the event identifier, signature timestamp, verification result, and receipt time.

## A dead-letter queue is an operating surface, not a bin

Retry forever is not a strategy. It can bury a poison message behind repeated parsing failures, saturate workers, and delay newer events. Retries need bounded attempts, backoff, and a clear classification between transient failures and permanent ones such as an invalid schema or an unknown business state.

A dead-letter queue holds messages that exhausted that policy or cannot be processed safely. It should preserve the original body, headers, event key, error history, and attempt timestamps. At 3am, an operator needs to inspect the failure, correct the dependency, and replay it deliberately. Replay must retain the original event key so the idempotency guard still applies. One bad event must not stop the queue behind it.

The retailer's 99.99% webhook ingestion SLA was paired with automated dead-letter queues and replay capabilities. That pairing matters: ingestion measures acceptance, while replay is how the system recovers from the events that acceptance could not safely complete.

## Make silence an explicit failure signal

A queue can be empty because the system is healthy, or because the sender stopped sending, the subscription expired, credentials broke, or a consumer is pointed at the wrong topic. “No errors” cannot distinguish those cases. Monitor consumer lag, oldest-message age, retry counts, dead-letter depth, and receipt-to-commit time.

Add a scheduled reconciliation job that compares the sender's record of truth with your own. For orders, compare accepted, paid, cancelled, and fulfilled identifiers. Reconciliation should produce a repair list with event keys, not silently mutate state; operators need an auditable path to replay or correction.

Metric absence is also a metric. If this integration normally receives events and none arrive for 20 minutes, alert on that absence. Choose the window from observed traffic and business tolerance, then test it by disabling delivery in a staging or controlled production path. In the home services engagement, automated voice and WhatsApp agents resolved 74% of inbound inquiries without human intervention and reduced booking time to under two minutes. When an automated actor drives the workflow, a dropped event has no person waiting to notice it. The monitor is the fallback.

### Check one webhook this week

Take one production webhook and trace it from raw request to committed side effect. Confirm that a database uniqueness constraint, not a check-then-act branch, owns deduplication; that the claim and effect share a transaction or an explicit outbox; that signatures expire; and that a 20-minute silence would page someone. If you cannot answer who replays a dead-lettered event at 3am, the failure mode is already present.

> Design the consumer for duplicate, delayed, reordered, and absent events. Then make each condition observable.

---

> **If you cannot say who replays a dead-lettered event at 3am, the failure mode is already present.**
>
> The **Medusa Commerce Build** treats idempotent webhook processing as a first-class deliverable, alongside protected customer data review and resilient order flows. It is built for commerce teams whose event volume makes silent failure expensive.
>
> **[Scope this with a senior engineer →](https://restart.ng/start-project?tier=MEDUSA%20COMMERCE%20BUILD)**
>
> Three short steps. A senior engineer reads your brief — not a sales queue — and replies within 24 hours with whether there is a fit and the clearest next step.
