# Performance and cost are connected: how to find the trade-off before scale.

At peak customer work hours, a B2B SaaS assistant was taking 2,400ms at p99. Sequential prompt calls timed out in chains, so a slow dependency did not merely make one answer slow; it made the next dependency late as well. Meanwhile, unindexed vector lookups and unmanaged context windows had doubled the monthly LLM bill without corresponding revenue growth. [1]

That is not two incidents. It is one operating problem measured in two units. The request was doing too much work, and the bill was paying for the same excess work. Performance and cost need to be budgeted together before traffic, tenants, or model usage make the choice for you.


## Latency and cost share one budget

Start with order-of-magnitude reasoning. A 2,400ms p99 and a p99 under 150ms are not points on one smooth tuning curve. They are different classes of problem. The first suggests request-path work, serial dependencies, or an unsuitable lookup strategy.

A rough latency ladder is useful because each rung points to a different fix. An **in-process cache** keeps data beside the code and avoids a call altogether. A **local cache** adds a process or host boundary but still avoids most network work. A **network round trip** introduces queueing, serialization, and contention. A **disk seek** adds storage latency and access patterns. A **cross-region call** adds distance and another failure domain.

The same ladder applies to cost. Memory consumed by a cache, database capacity used by an index, network traffic, storage operations, and model tokens all belong to the request’s cost profile. The engineering question is: which rung is responsible for the next meaningful portion of latency, and what work can be removed rather than merely hidden?

## The AI case got faster by doing less work

The B2B SaaS case is instructive because it did not win by accepting a simple latency-for-cost trade. The slow operations were also expensive operations. Naive cosine lookups searched too much data, so they consumed time and infrastructure while producing no corresponding user value. Unbounded context windows transmitted too much to the model, which increased both response time and token expenditure.

Restart replaced the sequential prompt chain with an asynchronous agentic pipeline built on Model Context Protocol. It replaced naive vector search with hybrid BM25 and pgvector HNSW indexing. BM25 handles exact terms and operational vocabulary; the HNSW index narrows vector retrieval without scanning the full set. Multi-tier semantic caching and prompt compression removed repeated model work rather than making the same work wait in a faster queue.

The result was a simultaneous improvement: p99 fell from 2,400ms to under 150ms for 85% of frequent operator intents, while monthly token expenditure fell by 48%. [1] Automated deterministic regression suites ran across 500+ operational test cases on every CI push, with a 99.4% evaluation pass rate.

The important lesson is architectural. When the system is searching too much, calling too many services, or sending too much context, the best cost optimisation is often a performance optimisation. Remove the work first. Cache or scale the remaining work only after you know it is necessary.

The AI case referenced here cut P99 latency below 150ms and token cost by 48% by moving work out of the request path — [the breakdown is here](https://restart.ng/case-studies).

### Semantic caching has an honest price

A semantic cache can return a previous answer for a new request that is sufficiently similar. That saves model tokens and wait time, but it gives up freshness.

What may be cached is therefore a product decision wearing an engineering costume. Stable explanations and repeated low-risk intents may tolerate bounded staleness. Current balances, access-sensitive results, prices, and workflow state usually should not be served from a response cache without explicit versioning and invalidation. Product owners must define what “fresh enough” means for each class of answer; engineers then encode that decision in cache keys, time-to-live rules, and invalidation events. A high cache-hit rate is not a success if it returns the wrong answer.

## Move work out of the request path

The secondary commerce case shows the same principle without a language model. A high-volume retailer was calculating wholesale prices synchronously while a customer loaded checkout. During traffic spikes, that work contributed to rate-limit throttling and abandoned carts.

Restart pre-computed customer price matrices in an asynchronous Kafka and Redis pipeline, then stored tier entitlement tokens in edge caches. Checkout no longer had to calculate a price matrix before responding. The reported calculation latency at checkout became zero milliseconds, and the platform handled 4,200 requests per minute during a Black Friday flash-sale peak with 100% order processing reliability. [2]

This is not free. Pre-computation consumes storage, queue capacity, invalidation logic, and operational attention. It is valuable when that cost is lower than repeating the same calculation on every request, especially when the request path is the most visible and failure-sensitive part of the system.

## Measure before optimising

A p50 can look healthy while p99 destroys trust. Users do not experience the median when a timeout occurs during a critical workflow. A mean is also misleading for a bimodal distribution: if cached requests are quick and misses are slow, the average describes neither mode and hides the boundary that needs attention.

Measure latency by route, tenant, intent, cache hit or miss, queue wait, dependency, and payload or token size. Pair each series with cost per request.

Cost guardrails belong in engineering. Set per-tenant budget caps where usage can grow independently, alert on drift in cost per request rather than waiting for total spend to become alarming, and keep a record of the cost curve as traffic and context size change. A cost curve is often the earlier warning: total spend can look stable while each request quietly becomes more expensive.

## Find the operating point this week

Take one high-volume request path and write down its latency ladder: in-process cache, local cache, network round trip, disk seek, or cross-region call. Mark the p50, p99, cache-hit rate, dependency time, and cost per request for each meaningful branch. Do not optimise the mean before you can explain the tail.

Then price the next millisecond. If the next improvement requires more memory, an index, another region, more queue capacity, or fewer model tokens, record that cost beside the expected user benefit. Set a tenant cap and a drift alert before the change ships.

---

> **Latency and cost come out of the same budget.**
>
> The **AI Integration Sprint** is a 2–4 week engagement that includes cost and latency guardrails, evaluation harnesses, and regression checks as deliverables rather than afterthoughts. It is scoped for teams that have an AI feature running and need it to hold its operating point under real traffic.
>
> **[Scope this with a senior engineer →](https://restart.ng/start-project?tier=AI%20INTEGRATION%20SPRINT)**
>
> Three short steps. A senior engineer reads your brief — not a sales queue — and replies within 24 hours with whether there is a fit and the clearest next step.

## References

[1]: https://restart.ng/resources/case-studies "Restart Inc. case studies"
[2]: https://restart.ng "Restart Inc."
