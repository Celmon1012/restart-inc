# Multi-tenant by default: the decision that is expensive to reverse later.

At 15,000 organisations, a Pan-African treasury and billing platform reached the point where its shared-database schema became the incident. End-of-month invoice reconciliation created thread contention. Queue workers fell behind, transaction webhook notifications arrived hours late, and the delay drew compliance warnings.

The original tenancy choice had looked inexpensive because it was. One database, one migration path, and a `tenant_id` column can take a product a long way. The expensive part is not choosing that model. It is discovering later that the model has become the platform’s blast radius, then moving live financial data while customers continue writing to it.

Multi-tenancy is therefore a data-isolation decision made in the first schema. Treat it as an architectural boundary, not as a scaling ticket.

## The first schema sets the blast radius

There are three common isolation models. Each buys a different failure boundary and charges for it somewhere else.

**Shared schema with a tenant column** keeps every tenant’s rows in the same tables. It is usually the right starting point: migrations run once, connection management is simple, and small tenants do not each carry database overhead. The cost is discipline. Every query, unique constraint, index, background job, export, and administrative path must preserve the tenant boundary. A missed predicate can turn one customer’s data into another customer’s response.

**Schema-per-tenant** puts each tenant’s tables in a separate PostgreSQL schema while keeping a database cluster in common. It gives a stronger boundary and makes per-tenant movement more practical. The costs are migration fan-out, connection and search-path management, provisioning, and catalogue scale. One migration becomes an operation across every tenant schema, with partial failure to handle.

**Database-per-tenant** gives the clearest isolation and the most independent recovery, maintenance, and residency choices. It also multiplies credentials, connection pools, backups, monitoring, migrations, failover, and capacity planning. It is justified when contractual, regulatory, noisy-neighbour, or recovery requirements outweigh that burden. It is not a synonym for “enterprise-ready”.

Shared schema stops being right when contention, noisy neighbours, or an isolation error cost more than separation. There is no universal tenant count at which that happens. Transaction shape, workload skew, recovery objectives, and access-control strength matter more than a round number.

### In a shared schema, the tenant key is part of the data model

A tenant column that exists only in application code is not an isolation design. It has to shape uniqueness and access paths in the database:

```sql
CREATE TABLE invoices (
  tenant_id  bigint NOT NULL,
  invoice_no text   NOT NULL,
  status     text   NOT NULL,
  PRIMARY KEY (tenant_id, invoice_no)
);

CREATE UNIQUE INDEX invoices_tenant_invoice_no
  ON invoices (tenant_id, invoice_no);

CREATE INDEX invoices_tenant_status
  ON invoices (tenant_id, status);
```

The primary key makes invoice numbers unique within a tenant. The leading tenant key also narrows the database work. In a shared schema, every business-level unique constraint needs that key, and every tenant-scoped index should lead with it.

## The failure mode is one forgotten predicate

The dangerous query is not exotic:

```sql
SELECT * FROM invoices
WHERE status = 'overdue'
ORDER BY created_at DESC;
```

It can pass one-tenant tests, look plausible in staging, and leak records in production. Code review alone is weak because tenant context is repeated across repositories, raw SQL, reporting jobs, queue consumers, and maintenance scripts.

A repository-level guard can require a tenant context before it builds a query. Database row-level security (RLS) can enforce the boundary even when a caller omits the predicate, using a session setting or authenticated database role. Prefer a layered control: repository checks make intent visible, while RLS limits the damage from a missed path.

RLS is not free. Policies add row-visibility checks and can complicate query plans, joins, bulk operations, pooling, and administrative access. Measure the actual workload, especially reconciliation and reporting. A little per-query work can be cheaper than relying on every engineer to remember one predicate.

## Reversal means moving data while running two systems

Changing isolation later is not a rename. It is data movement while two models are live: provision the target, backfill rows, preserve relationships and audit history, replay concurrent writes, and prove agreement before cutover. Dual writes add retries, ordering gaps, partial commits, and divergent indexes. Rollback must account for writes made during migration.

The treasury and billing platform illustrates why teams eventually pay this bill. Restart moved it from a shared-database model to schema-level tenant isolation, immutable append-only ledger streams, and horizontal sharding based on transaction velocity. The reported result was reconciliation falling from 4.5 hours to under 30 seconds, with capacity for more than 50,000 concurrent corporate tenants and 99.99% availability.[1]

The result came from more than a table layout. Append-only ledger streams made financial history verifiable, while sharding by transaction velocity separated the busiest workloads from quieter tenants.

## Tenancy and data control are different decisions

A global logistics firm had more than 7TB of operations data in a legacy multi-tenant SaaS suite with strict role-based access control. Restart migrated it to dedicated bare-metal private-cloud infrastructure, preserving role-level permissions in a zero-downtime cutover.[1] The case shows that control over where data is operated does not require database-per-tenant isolation inside the application.

The compliance question is whether the system can demonstrate that access is limited, intentional, and auditable. Under NDPA and GDPR expectations, “the application normally adds a tenant filter” is weaker evidence than enforced isolation, tested permission boundaries, immutable audit records, and a documented path for access reviews and deletion or export requests. The right control may be shared-schema RLS, schema-per-tenant, or dedicated infrastructure. Choose based on the data, the threat model, and the evidence the organisation must produce—not on the label of the tenancy model.

## Check the boundary before it becomes a migration

This week, inspect one production-shaped path rather than reviewing an architecture diagram. Pick an invoice, order, or user record and trace its tenant key through the schema, unique constraints, indexes, repository methods, queue payloads, exports, and audit trail. Search for raw queries that can run without an explicit tenant context. Then run a negative test: authenticate as tenant A and verify that a deliberately omitted predicate cannot return tenant B’s rows.

Record the point at which shared-schema contention, backup requirements, noisy-neighbour impact, or compliance evidence becomes unacceptable. If that point is approaching, model the migration now, while backfills and dual-operation windows are still affordable. The decision is nearly free in the first schema. It is a programme once the data is live.

## References

[1]: ../../client/src/data/caseStudies.ts "Restart Inc. case study data"
