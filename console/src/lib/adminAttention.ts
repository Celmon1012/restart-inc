// "What needs us today" across the admin area: blocked and overdue milestones,
// server requests awaiting review, lead follow-ups, open support tickets, and
// overdue invoices. Shared by the admin Overview, the top-bar bell, and the
// Needs attention page.
//
// Loads are cached for a minute at module level, so the bell (mounted on every
// admin page) and the Overview don't each re-read Lago and Chatwoot on every
// navigation.

import { consoleSchema } from "./supabase";
import { invokeFunction } from "./functions";
import { formatDate, formatRelative } from "./format";
import { loadWorkspaceNames, OPEN_STAGES, type PipelineStage } from "./admin";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import type { Status as RequestStatus } from "@/components/ServerRequests";
import type { FinanceOverview } from "@/pages/admin/Finance";

export interface LeadRow {
  id: string;
  name: string;
  company: string | null;
  status: PipelineStage;
  created_at: string;
  next_follow_up_at: string | null;
}

export interface ConversationSummary {
  id: string;
  workspaceName: string | null;
  status: string;
  lastMessage: string | null;
  lastActivityAt: number | null;
}

export interface DeliveryData {
  deliverables: Array<{ id: string; title: string; status: string; due_at: string | null; workspace: { id: string; name: string } | null }>;
  tasks: Array<{ id: string; is_done: boolean }>;
  requests: Array<{ id: string; status: RequestStatus; kind: string; created_at: string; workspace: { name: string } | null }>;
}

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; promise: Promise<unknown> }>();

function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise as Promise<T>;
  const promise = loader();
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}

/** Drop cached loads so the next read hits the sources again. */
export function invalidateAttention() {
  cache.clear();
}

const loadLeads = () =>
  cached("leads", async () => {
    const { data, error } = await consoleSchema()
      .from("inquiries")
      // Same "*" read as the Leads page: next_follow_up_at comes from a
      // pipeline migration that may not be applied everywhere, and naming it
      // explicitly fails the whole query where it is missing.
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as LeadRow[];
  });

const loadDelivery = () =>
  cached("delivery", async (): Promise<DeliveryData> => {
    const [deliverables, tasks, requests, names] = await Promise.all([
      consoleSchema().from("deliverables").select("id,title,status,due_at,workspace_id"),
      consoleSchema().from("deliverable_tasks").select("id,is_done"),
      consoleSchema().from("server_requests").select("id,status,kind,created_at,workspace_id").order("created_at", { ascending: false }),
      loadWorkspaceNames()
    ]);
    for (const r of [deliverables, tasks, requests]) if (r.error) throw r.error;
    const ws = (id: string) => (names.has(id) ? { id, name: names.get(id)! } : null);
    return {
      deliverables: (deliverables.data ?? []).map((d) => ({ ...d, workspace: ws(d.workspace_id) })),
      tasks: tasks.data ?? [],
      requests: (requests.data ?? []).map((r) => ({ ...r, workspace: ws(r.workspace_id) }))
    } as DeliveryData;
  });

const loadSupport = () =>
  cached("support", async () => (await invokeFunction<{ conversations: ConversationSummary[] }>("console-support-data")).conversations ?? []);

const loadFinance = () => cached("finance", () => invokeFunction<FinanceOverview>("console-admin-finance"));

export function useAdminSources() {
  return {
    leads: useAsyncResource(() => loadLeads(), []),
    delivery: useAsyncResource(() => loadDelivery(), []),
    support: useAsyncResource(() => loadSupport(), []),
    finance: useAsyncResource(() => loadFinance(), [])
  };
}

export type AttentionCategory = "delivery" | "requests" | "leads" | "support" | "billing";

export const ATTENTION_CATEGORY_LABEL: Record<AttentionCategory, string> = {
  delivery: "Delivery",
  requests: "Server requests",
  leads: "Follow-ups",
  support: "Support",
  billing: "Billing"
};

export interface AttentionItem {
  key: string;
  category: AttentionCategory;
  text: string;
  href: string;
}

export function buildAttention(s: ReturnType<typeof useAdminSources>): AttentionItem[] {
  const now = new Date();
  const d = s.delivery.data;
  const blocked = d?.deliverables.filter((m) => m.status === "blocked") ?? [];
  const overdue = d?.deliverables.filter((m) => m.status !== "completed" && m.status !== "blocked" && m.due_at && new Date(m.due_at) < now) ?? [];
  const pendingReview = d?.requests.filter((r) => r.status === "pending_review") ?? [];
  const followUps = (s.leads.data ?? []).filter(
    (l) => OPEN_STAGES.includes(l.status) && l.next_follow_up_at && new Date(l.next_follow_up_at) <= now
  );
  const openTickets = (s.support.data ?? []).filter((c) => c.status === "open");

  // One line per client for overdue invoices, not one per invoice: a client
  // with seven unpaid invoices is one thing to chase.
  const overdueByClient = new Map<string, number>();
  for (const i of s.finance.data?.openInvoices ?? []) {
    if (i.overdue) overdueByClient.set(i.client, (overdueByClient.get(i.client) ?? 0) + 1);
  }

  return [
    ...blocked.map((m) => ({
      key: `b-${m.id}`,
      category: "delivery" as const,
      text: `${m.workspace?.name ?? "Client"}: “${m.title}” is blocked`,
      href: `/admin/projects/${m.workspace?.id ?? ""}`
    })),
    ...overdue.map((m) => ({
      key: `o-${m.id}`,
      category: "delivery" as const,
      text: `${m.workspace?.name ?? "Client"}: “${m.title}” was due ${formatDate(m.due_at)}`,
      href: `/admin/projects/${m.workspace?.id ?? ""}`
    })),
    ...pendingReview.map((r) => ({
      key: `r-${r.id}`,
      category: "requests" as const,
      text: `${r.workspace?.name ?? "Client"} requested ${r.kind === "upgrade" ? "a server upgrade" : "a new server"} ${formatRelative(r.created_at)}`,
      href: "/admin/requests"
    })),
    ...followUps.map((l) => ({
      key: `l-${l.id}`,
      category: "leads" as const,
      text: `Follow-up due: ${l.name}${l.company ? ` (${l.company})` : ""}`,
      href: `/admin/leads?id=${l.id}`
    })),
    ...openTickets.map((c) => ({
      key: `t-${c.id}`,
      category: "support" as const,
      text: `Open ticket from ${c.workspaceName ?? "a client"}: ${c.lastMessage ?? "no message"}`,
      href: `/admin/support?id=${c.id}`
    })),
    ...Array.from(overdueByClient, ([client, n]) => ({
      key: `i-${client}`,
      category: "billing" as const,
      text: n === 1 ? `${client} has an overdue invoice` : `${client} has ${n} overdue invoices`,
      href: "/finance"
    }))
  ];
}

export function useAdminAttention() {
  const sources = useAdminSources();
  const loading = Object.values(sources).some((r) => r.loading);
  const failed = (Object.keys(sources) as Array<keyof typeof sources>).filter((k) => sources[k].error);
  return { sources, items: buildAttention(sources), loading, failed };
}

