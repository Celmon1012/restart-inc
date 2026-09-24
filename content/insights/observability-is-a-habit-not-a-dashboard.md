# Observability isn't a dashboard — it's a habit your team practices daily.

A fleet operator had 20,000 connected transport assets, yet operations managers could lose sight of vehicle status when it mattered. Unreliable cellular coverage caused 12% telemetry packet loss. Burst uploads then hit database write locks and froze the dispatch dashboards. The screen existed; the operational answer did not.

Most teams buy observability and do not practise it. A dashboard nobody opens during an incident, with panels chosen at setup and never revised, is documentation of an opinion. A team with real observability knows which three numbers to inspect when something breaks, and changes them after the incident teaches something new.

## Observability answers three different questions

The first question is **is it working**. A metrics dashboard can answer that: process health, request rate, error count, and resource saturation show whether a service is alive. A green metric can coexist with missing vehicle messages or a queue that is ageing.

The second is **is it working well**. This requires a baseline and a distribution, not just an uptime light. Latency percentiles, freshness, throughput, and loss rates tell you whether the system meets its operational promise. Weak monitoring reports an average that hides a bad tail, or displays a total without showing whether it is current.

The third is **if not, where is it failing**. Tracing answers that question by following one operation across services, queues, storage, and external calls. A metric can tell you ingestion is slow. A trace can show that the delay starts at a broker handoff, a lock, or a retrying downstream call. These are different capabilities.

The fleet pipeline made the separation concrete. Restart used MQTT brokers, TimescaleDB time-series hypertables, and Go ingestion relays, while Grafana exposed the operational view. It also used local SQLite buffers, compressed delta transmission, and deduplication on ingest. Sustained ingestion reached 15,000 events per second with sub-50ms inserts, packet loss was eliminated, and uptime reached 99.995%. The useful observability was the ability to distinguish a missing signal, a delayed signal, and a failed write without guessing.

## Missing events are often more important than error events

Error monitoring catches failures that announce themselves. The harder failures produce no exception. They simply stop producing the event you expected.

Suppose a vehicle has sent no telemetry for 40 minutes. The ingestion service may be healthy, the broker may have no errors, and the database may accept writes. Yet the vehicle is operationally unobserved. The absence is the signal; evaluate it against the expected heartbeat and last known operating state.

The same pattern applies beyond telemetry. A heartbeat that stops arriving, a reconciliation run that produces zero records, or a queue whose depth only grows are failures expressed as missing or one-sided movement. Instrument the expectation, not only the exception. Store the last-seen timestamp and expected interval so an alert distinguishes a powered-down asset from a silent one.

This is also why the edge buffer matters. When observability depends on a network you do not control, the data has to be produced and retained locally first. The vehicle gateway stores events in SQLite, compresses deltas, and forwards them after reconnection. Ingest deduplication makes replay safe. Store-and-forward is stronger than treating connectivity as a problem to solve once: the network can remain unreliable while the record remains durable.

## Page only on causes a human can act on

An alert should point toward a decision, not announce a symptom. “Dashboard is stale” is a symptom. “The edge relay has exceeded its local buffer policy and cannot forward” identifies a condition an operator can investigate. “Database CPU is high” is interesting; “write-lock contention is delaying ingestion beyond the freshness budget” is closer to a cause.

Page-worthy is a smaller set than interesting. A page earns its place when a person must act now, the condition has an owner, and the action can change the outcome. If the response is only to acknowledge it, wait, and hope the graph recovers, it belongs in a review view rather than an on-call channel.

A noisy alert is worse than a missing one because repeated false alarms train people to discount the channel. Habituation turns a real page into background noise. Use this test before keeping an alert: **what decision will the recipient make in the next few minutes, and what evidence will tell them that the decision worked?** If neither answer is specific, remove the page or lower it to a diagnostic signal.

## The panel set should change after every incident

Observability becomes a practice when it has a feedback loop. Before a change, instrument the hypothesis you are about to test. If you expect batching to reduce write contention, capture contention, batch size, freshness, and loss before deploying it. Otherwise a favourable graph is only a story you told yourself.

During an incident, prefer numbers that map to failure boundaries: last event time, ingest rate, queue age, write latency, and error or retry rate. The exact set depends on the architecture. Each number must help answer whether the system works, whether it works well, or where it fails.

The B2B SaaS case shows the same discipline in an AI feature. Its assistant reached 2.4-second p99 latency during peak hours because sequential prompt calls, unindexed vector lookups, and unmanaged context windows compounded. Restart rebuilt retrieval with hybrid BM25 and pgvector HNSW search, added semantic caching, and ran more than 500 deterministic regression cases on every CI push. Frequent operator intents reached under 150ms p99, and the eval suite recorded a 99.4% pass rate. For an AI feature, that harness is observability: it detects quality regressions that latency and uptime cannot see.

### Turn an incident into a durable check

After the incident, write down the failed assumption as a measurable condition. Add the check before closing the work, then replay the incident against it. Revise panels if the check would have arrived too late or pointed at the wrong layer. Finally, delete panels nobody has looked at in a quarter. A smaller set that drives decisions is more valuable than an archive of metrics.

## Check the habit this week

Pick the last production incident and ask three questions: which number would have shown the failure first, which number would have located it, and which expected event never arrived? If the team cannot answer within a few minutes, add those signals before buying another observability product. Then inspect your alerts: for each page, name the owner, immediate action, and success condition. Anything without all three is not operational observability yet; it is an interesting chart waiting to be ignored.
