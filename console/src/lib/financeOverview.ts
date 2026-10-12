// The shape of console-admin-finance's response and the call that loads it. Kept out of the page
// so the Finance pages and their shared frame can both import it without a cycle.

import { invokeFunction } from "@/lib/functions";

export type Totals = Record<string, number>;

export interface FinanceOverview {
  generatedAt: string;
  totals: { collected: Totals; collectedThisMonth: Totals; outstanding: Totals; overdue: Totals; mrr: Totals; vatCollected?: Totals; vatCollectedThisMonth?: Totals };
  activeSubscriptions: number;
  billedClients: number;
  unbilledClients: number;
  invoiceCount: number;
  invoicesTruncated: boolean;
  monthly: Array<{ month: string; collected: Totals }>;
  clients: Array<{
    workspaceId: string | null;
    name: string;
    customerId: string;
    collected: Totals;
    outstanding: Totals;
    overdue: Totals;
    mrr: Totals;
    invoiceCount: number;
    lastInvoiceAt: string | null;
  }>;
  openInvoices: Array<{
    id: string;
    number: string;
    client: string;
    workspaceId: string | null;
    issuingDate: string;
    dueDate: string | null;
    paymentStatus: string;
    overdue: boolean;
    totalAmountCents: number;
    totalDueAmountCents: number;
    currency: string;
    fileUrl: string | null;
  }>;
}

export const loadFinanceOverview = () => invokeFunction<FinanceOverview>("console-admin-finance");
