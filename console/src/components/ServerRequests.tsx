import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Loader2, Rocket, X } from "lucide-react";
import { toast } from "sonner";
import { consoleSchema, supabase } from "@/lib/supabase";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { formatRelativeTime } from "@/lib/resources";
import type { Workspace } from "@/lib/resources";

/* ------------------------------------------------------------------
 * Server capacity requests (Operate plan). Replaces the mailto links on
 * the Infrastructure tab. A member asks for an upgrade or an extra
 * server; an engineer reviews it before anything is quoted; the client
 * pays the attached Lago invoice; lago-webhook marks it paid; an engineer
 * does the work. Backed by console.server_requests
 * (20260926120000_console_server_requests.sql).
 * ------------------------------------------------------------------ */

type Kind = "upgrade" | "new_server";
type Tier = "s" | "m" | "l";
type Hosting = "restart" | "client";
type CloudProvider = "aws" | "gcp" | "azure" | "digitalocean" | "on_prem" | "other";
export type Status = "pending_review" | "awaiting_payment" | "paid" | "in_progress" | "done" | "declined" | "cancelled";

export interface ServerRequest {
  id: string;
  created_at: string;
  updated_at: string;
  kind: Kind;
  server_uuid: string | null;
  requested_tier: Tier | null;
  hosting: Hosting;
  cloud_provider: CloudProvider | null;
  cloud_region: string | null;
  cloud_spec: string | null;
  reason: string | null;
  status: Status;
  engineer_note: string | null;
  lago_invoice_id: string | null;
}

// Specs mirror the Managed Environment plans in setup-lago-catalog.
const TIERS: { id: Tier; name: string; spec: string }[] = [
  { id: "s", name: "Managed Environment S", spec: "4 vCPU · 8 GB RAM · 75 GB NVMe" },
  { id: "m", name: "Managed Environment M", spec: "6 vCPU · 12 GB RAM · 100 GB NVMe" },
  { id: "l", name: "Managed Environment L", spec: "8 vCPU · 24 GB RAM · 200 GB NVMe" },
];

// "Your cloud": the same operations on a server in the client's own account,
// billed on the managed-env-byo-* plans (management fee only).
const PROVIDERS: { id: CloudProvider; name: string }[] = [
  { id: "aws", name: "AWS" },
  { id: "gcp", name: "Google Cloud" },
  { id: "azure", name: "Azure" },
  { id: "digitalocean", name: "DigitalOcean" },
  { id: "on_prem", name: "On-premises" },
  { id: "other", name: "Other" },
];

function requestSummary(r: ServerRequest): string {
  if (r.hosting === "client") {
    const provider = PROVIDERS.find((p) => p.id === r.cloud_provider)?.name;
    return ["Your cloud", provider, r.cloud_region, r.cloud_spec].filter(Boolean).join(" · ");
  }
  const tier = TIERS.find((t) => t.id === r.requested_tier);
  return tier ? `${tier.name} · ${tier.spec}` : (r.requested_tier ?? "").toUpperCase();
}

export const STATUS_LABEL: Record<Status, string> = {
  pending_review: "Engineer reviewing",
  awaiting_payment: "Awaiting payment",
  paid: "Paid — scheduling",
  in_progress: "In progress",
  done: "Done",
  declined: "Not recommended",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<Status, "healthy" | "warning" | "down" | "muted"> = {
  pending_review: "warning",
  awaiting_payment: "warning",
  paid: "healthy",
  in_progress: "healthy",
  done: "healthy",
  declined: "muted",
  cancelled: "muted",
};

export const OPEN: Status[] = ["pending_review", "awaiting_payment", "paid", "in_progress"];

// Client-facing: members request and pay here; engineers review them in the
// admin area (pages/admin/ServerRequests.tsx), which reuses RequestRow.
export function ServerRequests({ workspace }: { workspace: Workspace }) {
  const [formKind, setFormKind] = useState<Kind | null>(null);

  const { data, error, retry } = useAsyncResource<ServerRequest[]>(
    async (signal) => {
      const { data: rows, error: dbError } = await consoleSchema()
        .from("server_requests")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (signal.aborted) return [];
      if (dbError) throw dbError;
      return (rows ?? []) as ServerRequest[];
    },
    [workspace.id],
    { errorMessage: "Failed to load server requests" }
  );
  const requests = data ?? [];
  const awaitingInvoices = requests.some((r) => r.status === "awaiting_payment" && r.lago_invoice_id);
  const paymentUrls = usePaymentUrls(workspace.id, awaitingInvoices);

  return (
    <>
      <div className="infra-actions-bar">
        <div>
          <h3>Need more capacity?</h3>
          <p>
            An engineer reviews every request first. Sometimes the fix is a bigger server; sometimes it's a slow
            query. Nothing is charged until you approve a quote.
          </p>
        </div>
        <div className="infra-actions-buttons">
          <button
            type="button"
            className="dash-action-btn"
            disabled={!workspace.server}
            title={workspace.server ? undefined : "No server assigned to this project yet"}
            onClick={() => setFormKind("upgrade")}
          >
            <span>Request upgrade</span>
            <ArrowUpRight size={14} />
          </button>
          <button type="button" className="console-btn-secondary" onClick={() => setFormKind("new_server")}>
            <Rocket size={13} />
            <span>Add a server</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="sr-error" role="alert">
          <span>Couldn't load server requests.</span>
          <button type="button" className="console-retry-btn" onClick={retry}>Retry</button>
        </div>
      )}

      {requests.length > 0 && (
        <div className="sr-list">
          <h4>Server requests</h4>
          {requests.map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              reviewable={false}
              paymentUrl={r.lago_invoice_id ? paymentUrls[r.lago_invoice_id] : undefined}
              onChanged={retry}
            />
          ))}
        </div>
      )}

      {formKind && (
        <RequestDialog
          kind={formKind}
          workspace={workspace}
          onClose={() => setFormKind(null)}
          onCreated={() => {
            setFormKind(null);
            retry();
          }}
        />
      )}
    </>
  );
}

/** Payment links for this workspace's open Lago invoices, keyed by Lago invoice id. */
function usePaymentUrls(workspaceId: string, enabled: boolean): Record<string, string | null> {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    supabase.functions
      .invoke(`console-billing?workspace_id=${workspaceId}`)
      .then(({ data }) => {
        if (cancelled || !data?.invoices) return;
        const map: Record<string, string | null> = {};
        for (const inv of data.invoices as { lagoId?: string; paymentUrl: string | null }[]) {
          if (inv.lagoId) map[inv.lagoId] = inv.paymentUrl;
        }
        setUrls(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workspaceId, enabled]);
  return urls;
}

export function RequestRow({
  request: r,
  reviewable,
  clientName,
  paymentUrl,
  onChanged,
}: {
  request: ServerRequest;
  reviewable: boolean;
  clientName?: string;
  paymentUrl: string | null | undefined;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<Status>(r.status);
  const [note, setNote] = useState(r.engineer_note ?? "");
  const [invoiceId, setInvoiceId] = useState(r.lago_invoice_id ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await consoleSchema()
      .from("server_requests")
      .update({ status, engineer_note: note.trim() || null, lago_invoice_id: invoiceId.trim() || null })
      .eq("id", r.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request updated");
    setEditing(false);
    onChanged();
  };

  return (
    <div className="sr-row">
      <div className="sr-row-main">
        <div className="sr-row-title">
          <strong>{clientName ? `${clientName} · ` : ""}{r.kind === "upgrade" ? "Upgrade server" : "Add a server"}</strong>
          <span>{requestSummary(r)}</span>
        </div>
        <span className={`sr-status ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
      </div>
      {r.reason && <p className="sr-reason">{r.reason}</p>}
      {r.engineer_note && (
        <p className="sr-note"><span>Engineer:</span> {r.engineer_note}</p>
      )}
      <div className="sr-row-foot">
        <span>Requested {formatRelativeTime(r.created_at)}</span>
        {r.status === "awaiting_payment" && !reviewable &&
          (paymentUrl ? (
            <a className="dash-action-btn sr-pay" href={paymentUrl} target="_blank" rel="noreferrer">
              <span>Pay invoice</span>
              <ArrowUpRight size={13} />
            </a>
          ) : (
            <Link href="/console/billing" className="sr-link">Pay from Billing & SLA</Link>
          ))}
        {reviewable && !editing && (
          <button type="button" className="sr-link" onClick={() => setEditing(true)}>Review</button>
        )}
      </div>

      {reviewable && editing && (
        <div className="sr-admin">
          <label>
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Lago invoice ID</span>
            <input value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="Attach before setting Awaiting payment" />
          </label>
          <label className="sr-admin-wide">
            <span>Note to client</span>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Recommendation, quote, or schedule" />
          </label>
          <div className="sr-admin-actions">
            <button type="button" className="console-btn-secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            <button type="button" className="dash-action-btn" onClick={save} disabled={saving || (status === "awaiting_payment" && !invoiceId.trim())}>
              {saving ? <Loader2 size={13} className="spin" /> : null}
              <span>Save</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestDialog({
  kind,
  workspace,
  onClose,
  onCreated,
}: {
  kind: Kind;
  workspace: Workspace;
  onClose: () => void;
  onCreated: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [hosting, setHosting] = useState<Hosting>("restart");
  const [tier, setTier] = useState<Tier | null>(null);
  const [provider, setProvider] = useState<CloudProvider | "">("");
  const [region, setRegion] = useState("");
  const [spec, setSpec] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  // Only a new server can be client-hosted; resizing one the client owns
  // happens in their provider's console.
  const clientHosted = kind === "new_server" && hosting === "client";
  const canSubmit = clientHosted ? provider !== "" : tier !== null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: rpcError } = await consoleSchema().rpc("request_server_change", {
      p_workspace_id: workspace.id,
      p_kind: kind,
      p_server_uuid: kind === "upgrade" ? workspace.server?.uuid ?? null : null,
      p_tier: clientHosted ? null : tier,
      p_reason: reason.trim() || null,
      p_hosting: clientHosted ? "client" : "restart",
      p_cloud_provider: clientHosted ? provider : null,
      p_cloud_region: clientHosted ? region.trim() || null : null,
      p_cloud_spec: clientHosted ? spec.trim() || null : null,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(
        rpcError.code === "PGRST202"
          ? "Server requests aren't switched on yet. Contact support and we'll set it up."
          : /failed to fetch|network/i.test(rpcError.message ?? "")
            ? "We couldn't reach the server. Check your connection and try again."
            : rpcError.message || "We couldn't send the request. Please try again."
      );
      return;
    }
    toast.success("Request sent. An engineer will review it within one business day.");
    onCreated();
  };

  return (
    <dialog
      ref={ref}
      className="sr-dialog"
      aria-labelledby="sr-dialog-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="sr-dialog-head">
          <h2 id="sr-dialog-title">{kind === "upgrade" ? "Request a server upgrade" : "Add a server to this project"}</h2>
          <button type="button" className="sr-close" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>
        {kind === "upgrade" && workspace.server && (
          <p className="sr-current">
            Current: <b>{workspace.server.name}</b> · {workspace.server.cpus ?? "—"} vCPU · {workspace.server.memoryGb ?? "—"} GB RAM
          </p>
        )}

        {kind === "new_server" && (
          <>
            <span className="sr-label">Where should it run?</span>
            <div className="sr-tiers" role="radiogroup" aria-label="Hosting">
              <button
                type="button"
                role="radio"
                aria-checked={hosting === "restart"}
                className={`sr-tier ${hosting === "restart" ? "selected" : ""}`}
                onClick={() => setHosting("restart")}
              >
                <strong>Restart-hosted</strong>
                <span>Server included in the plan</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={hosting === "client"}
                className={`sr-tier ${hosting === "client" ? "selected" : ""}`}
                onClick={() => setHosting("client")}
              >
                <strong>Your cloud</strong>
                <span>Your account and provider bill; we operate it</span>
              </button>
            </div>
          </>
        )}

        {clientHosted ? (
          <>
            <label className="sr-label" htmlFor="sr-provider">Provider</label>
            <select
              id="sr-provider"
              className="sr-textarea"
              value={provider}
              onChange={(e) => setProvider(e.target.value as CloudProvider | "")}
            >
              <option value="" disabled>Choose where the server runs</option>
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <label className="sr-label" htmlFor="sr-region">Region <em>(optional)</em></label>
            <input
              id="sr-region"
              className="sr-textarea"
              maxLength={100}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. eu-west-1, or your Lagos data centre"
            />
            <label className="sr-label" htmlFor="sr-spec">Server size <em>(optional)</em></label>
            <input
              id="sr-spec"
              className="sr-textarea"
              maxLength={200}
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="e.g. 4 vCPU · 8 GB RAM, Ubuntu 24.04. Leave blank and we'll recommend one."
            />
          </>
        ) : (
          <>
            <span className="sr-label">Size</span>
            <div className="sr-tiers" role="radiogroup" aria-label="Server size">
              {TIERS.map((t) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={tier === t.id}
                  key={t.id}
                  className={`sr-tier ${tier === t.id ? "selected" : ""}`}
                  onClick={() => setTier(t.id)}
                >
                  <strong>{t.name}</strong>
                  <span>{t.spec}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <label className="sr-label" htmlFor="sr-reason">
          {kind === "upgrade" ? "What's slowing down or running out?" : "What will this server run?"} <em>(optional)</em>
        </label>
        <textarea
          id="sr-reason"
          className="sr-textarea"
          rows={3}
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={kind === "upgrade" ? "e.g. Checkout slows down at peak; memory sits above 90%" : "e.g. A separate worker for background jobs"}
        />

        {clientHosted ? (
          <ol className="sr-steps">
            <li>An engineer reviews it within one business day and sends the minimum spec and an access checklist (SSH key or IAM role, firewall rules).</li>
            <li>You get a quote for onboarding and the monthly management fee. Your provider bills you for the server directly.</li>
            <li>Once paid and access is in place, we validate the server and bring it under monitoring, backups, and patching.</li>
          </ol>
        ) : (
          <ol className="sr-steps">
            <li>An engineer reviews it within one business day and replies here with a recommendation.</li>
            <li>If it's the right move, you get a quote and an invoice. Nothing is charged before that.</li>
            <li>Once paid, we schedule the work. Upgrades need a short restart, agreed with you in advance.</li>
          </ol>
        )}

        {error && <p className="sr-form-error" role="alert">{error}</p>}

        <div className="sr-dialog-actions">
          <button type="button" className="console-btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="dash-action-btn" disabled={!canSubmit || submitting}>
            {submitting ? <Loader2 size={13} className="spin" /> : null}
            <span>Send request</span>
          </button>
        </div>
      </form>
    </dialog>
  );
}

export { OPEN as OPEN_SERVER_REQUEST_STATUSES };
