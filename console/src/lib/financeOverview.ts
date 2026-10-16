// The shape of console-admin-finance's response and the call that loads it. Kept out of the page
// so the Finance pages and their shared frame can both import it without a cycle.

import { invokeFunction } from "@/lib/functions";

export type Totals = Record<string, number>;

export interface SubscriptionLine {
  customerId: string;
  workspaceId: string | null;
  planCode: string;
  planName: string;
  subscriptionName: string | null;
  kind: "hosting" | "service";
  monthlyCents: number;
  currency: string;
}

export interface FinanceOverview {
  generatedAt: string;
  totals: { collected: Totals; collectedThisMonth: Totals; outstanding: Totals; overdue: Totals; /** Recurring revenue given away by active coupons, so billed MRR = mrr - discount. */ discount?: Totals; mrr: Totals; vatCollected?: Totals; vatCollectedThisMonth?: Totals };
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
    /** Monthly amount an active coupon is giving away, and how many invoices it still covers (null = no end). */
    discount?: Totals;
    couponInvoicesLeft?: number | null;
    invoiceCount: number;
    lastInvoiceAt: string | null;
  }>;
  /** Every active subscription as a line: hosting plans (dedicated-server-*) or services (retainers, maintenance, pods). */
  subscriptions?: SubscriptionLine[];
  /** Every invoice with its state (absent until the finance function has been redeployed). */
  allInvoices?: InvoiceRow[];
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

export type InvoiceState = "draft" | "unpaid" | "partial" | "overdue" | "paid";

export interface InvoiceRow {
  id: string;
  number: string;
  client: string;
  workspaceId: string | null;
  issuingDate: string;
  dueDate: string | null;
  state: InvoiceState;
  totalAmountCents: number;
  paidAmountCents: number;
  totalDueAmountCents: number;
  currency: string;
  fileUrl: string | null;
}

/** One invoice in full, for the detail panel (console-admin-finance?invoice=...). */
export interface InvoiceDetail {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  issuingDate: string;
  dueDate: string | null;
  currency: string;
  customer: { name: string | null; legalName: string | null; email: string | null; phone: string | null; taxId: string | null; address: string[] };
  lines: Array<{ description: string; detail: string | null; units: number; rateCents: number; amountCents: number; taxRate: number }>;
  taxes: Array<{ name: string; rate: number; amountCents: number }>;
  subtotalCents: number;
  taxesCents: number;
  discountsCents: number;
  totalCents: number;
  paidCents: number;
  dueCents: number;
  fileUrl: string | null;
  payments: Array<{ date: string; amountCents: number; status: string }>;
}

export const loadFinanceOverview = () => invokeFunction<FinanceOverview>("console-admin-finance");
