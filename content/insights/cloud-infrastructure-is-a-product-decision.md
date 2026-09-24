# Cloud infrastructure is a product decision — not just a hosting decision.

The renewal notice arrived before anything had failed. A global logistics firm faced a legacy SaaS renewal with usage-tier penalties projected at more than $3M annually. Freight tracking, customs documentation, and warehouse dispatch ran 24/7/365, so the usual maintenance window was unavailable. The system also held more than 7TB of operational data behind strict role-based permissions.

The question was whether the business should keep paying for a usage contract whose limits were set elsewhere. Restart built a private cloud on dedicated bare metal, replicated data in parallel, ran a synchronised shadow deployment for 14 days, and completed an off-peak DNS cutover.

Where a system runs determines what the product can promise. It sets a floor for latency, a shape for marginal cost, a boundary around integrations, and a posture for data handling. Treating that choice as the final deployment task means accepting constraints without naming them.

## Infrastructure sets three product promises

The first promise is **availability**. It includes the maintenance window, network path, failure domains, and ability to restore service. A dispatch product that must operate continuously cannot quietly inherit a provider's maintenance schedule or a dependency's rate limit.

The second is **marginal cost per unit of work**. A unit might be a shipment tracked, a document processed, an event ingested, or a query served. Each additional request, byte stored, and byte moved can be metered. That meter becomes part of pricing, gross margin, or the decision to reject a feature.

The third is **what data can be held where**. This includes primary records, replicas, backups, logs, analytics copies, keys, and support paths. If the product cannot state those locations, it does not yet have a defensible data posture.

## Managed speed and owned control have different cost curves

A managed platform converts capital expenditure and much of the operations burden into operating expenditure. It buys a faster start and a provider's maintenance capacity. That is often correct while demand is uncertain or the team needs to reach market before it can justify an operating function.

Owned infrastructure shifts the balance. Hardware, networking, capacity planning, patching, observability, replacement, and recovery become the team's responsibility. In return, the team controls more of the performance envelope, data boundary, and sustained-workload cost.

Managed cost is usually close to linear in usage. More requests, storage, database operations, and outbound traffic produce more billable consumption. Owned cost is stepwise: a server, link, or storage tier is paid for in chunks, then carries spare capacity until the next step. The crossover depends on utilisation, not company size. A predictable workload can justify owned capacity sooner than a larger but bursty one.

Model baseline, peaks, idle capacity, staffing time, recovery requirements, and migration cost together. The answer may be managed, owned, or hybrid.

### Egress becomes expensive after the architecture is embedded

Ingress can look inexpensive while egress grows. Exports to another region, analytics system, backup destination, customer, or adjacent service may each be charged. Cheap storage can become an expensive operating model when data moves repeatedly between zones or providers.

Lock-in is also more than an API problem. It can be a dependency on storage formats, identity models, queue semantics, or network topology. Put egress paths and an exit procedure in the initial unit-economics model.

## The logistics migration was a contract and a boundary

The logistics engagement was triggered by a renewal, not by a technical outage. There was a business clock: accept usage-tier penalties projected at $3M+ annually, or make a replacement safe before the contract forced the decision.

Parallel replication kept the existing system authoritative while the replacement caught up. Real-time idempotency validation prevented duplicate transactions. Permission hierarchies were preserved. The 14-day shadow deployment let the team compare live behaviour before the off-peak DNS cutover.

The result was a 70% reduction in ongoing software licensing and infrastructure spend. More than 7TB moved without a dropped transaction or inventory discrepancy, with zero downtime. The client retained data sovereignty for its NDPA and GDPR obligations and established an internal managed IT services business unit.

An infrastructure migration is a risk-management exercise with a business clock. Replication, shadow traffic, and reconciliation turn a commercial decision into a safe production change.

## The physical environment is part of the architecture

The industrial fleet case had a different constraint: sporadic cellular connectivity across remote transit corridors. The operator had 20,000 connected assets and was losing 12% of telemetry packets. Burst uploads could freeze dispatch dashboards.

The architecture therefore assumed disconnection. MQTT edge relays buffered events locally in SQLite, compressed deltas, and forwarded them when connectivity returned. Deduplication made replay safe. The edge buffer was the component that made the product truthful about its environment.

The pipeline sustained 15,000 events per second, eliminated telemetry packet loss, and recorded 99.995% uptime. Where connectivity and power are variables, decide what must continue when the link disappears and which actions can be replayed safely. A cloud service cannot remove a physical constraint it cannot observe.

## Residency is an architecture constraint, not a checkbox

“The data is in the cloud” answers neither who can access it nor where its copies are. Under Nigeria's Data Protection Act, personal data cannot be transferred from Nigeria to another country unless the recipient has adequate protection or a specified exception applies; the controller or processor must record the basis. Adequacy considers enforceable rights, public-authority access, applicable law, and supervisory enforcement [1].

The GDPR similarly requires a recognised mechanism for transfers outside the European Economic Area, such as an adequacy decision, standard contractual clauses, binding corporate rules, or a permitted derogation [2]. A provider's global footprint is not a compliance answer by itself.

Map primary storage, replicas, backups, telemetry, logs, support access, keys, and disaster recovery. A private cloud may make that boundary easier to control, but it does not make compliance automatic.

## Decide before the renewal decides for you

This week, write a one-page infrastructure decision record. Name the availability promise. Define one unit of work and plot its cost at baseline, peak, and sustained utilisation. Draw where each production, backup, log, and support-access copy of sensitive data resides. Mark what happens when the network, power, or an external dependency fails.

Add the exit test: how would you restore the data, move the workload, and keep serving customers if the provider changed its pricing or access terms? If the answers are vague, infrastructure is already making product decisions on your behalf.

## References

[1]: https://cert.gov.ng/ngcert/resources/Nigeria_Data_Protection_Act_2023.pdf "Nigeria Data Protection Act, 2023"
[2]: https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/rules-international-data-transfers_en "European Commission: Rules on international data transfers"
