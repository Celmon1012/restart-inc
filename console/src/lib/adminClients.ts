// Client-level rollups on top of loadPortfolio(): money from
// console-admin-finance and tickets from console-support-data, both keyed by
// workspace (= project) and summed per client. Kept separate from lib/admin.ts
// because both come from edge functions that can fail independently.

import type { ClientSummary } from "./admin";
import type { FinanceOverview } from "@/pages/admin/Finance";

export type Totals = Record<string, number>;

export type ClientStatus = "active" | "scoping" | "idle";

export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  active: "Active",
  scoping: "Scoping",
  idle: "Idle"
};

export function addTotals(into: Totals, from: Totals | undefined) {
  for (const [c, v] of Object.entries(from ?? {})) into[c] = (into[c] ?? 0) + v;
  return into;
}

export interface ClientMoney {
  mrr: Totals;
  collected: Totals;
  outstanding: Totals;
  overdue: Totals;
  invoiceCount: number;
}

export function moneyFor(client: ClientSummary, finance: FinanceOverview | null | undefined): ClientMoney {
  const ids = new Set(client.projects.map((p) => p.id));
  const money: ClientMoney = { mrr: {}, collected: {}, outstanding: {}, overdue: {}, invoiceCount: 0 };
  for (const row of finance?.clients ?? []) {
    if (!row.workspaceId || !ids.has(row.workspaceId)) continue;
    addTotals(money.mrr, row.mrr);
    addTotals(money.collected, row.collected);
    addTotals(money.outstanding, row.outstanding);
    addTotals(money.overdue, row.overdue);
    money.invoiceCount += row.invoiceCount;
  }
  return money;
}

export function statusFor(client: ClientSummary, money: ClientMoney): ClientStatus {
  if (client.projects.some((p) => p.status === "active" || p.status === "blocked" || p.status === "live") || Object.keys(money.mrr).length > 0) {
    return "active";
  }
  if (client.projects.every((p) => p.status === "onboarding")) return "scoping";
  return "idle";
}
