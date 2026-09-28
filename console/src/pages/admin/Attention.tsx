// Everything that needs us, in one list: the full version of the admin
// Overview's "Needs attention" and the top-bar bell's dropdown.

import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { ErrorAlert, StatusRegion } from "@/components/AsyncStates";
import { ATTENTION_CATEGORY_LABEL, invalidateAttention, useAdminAttention, type AttentionCategory } from "@/lib/adminAttention";

const CATEGORIES = Object.keys(ATTENTION_CATEGORY_LABEL) as AttentionCategory[];

export default function AdminAttention() {
  const { sources, items, loading, failed } = useAdminAttention();
  const [filter, setFilter] = useState<"all" | AttentionCategory>("all");
  const visible = items.filter((a) => filter === "all" || a.category === filter);
  const count = (c: AttentionCategory) => items.filter((a) => a.category === c).length;
  const refreshing = Object.values(sources).some((r) => r.refreshing);

  const refresh = () => {
    invalidateAttention();
    void Promise.all(Object.values(sources).map((r) => r.refresh()));
  };

  return (
    <ConsoleLayout area="admin" onRefresh={refresh} isRefreshing={refreshing}>
      <StatusRegion message={loading ? "Checking what needs attention" : `${visible.length} items shown`} />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">OPERATIONS</span>
          <h1>Needs attention</h1>
          <p>Blocked or overdue milestones, server requests to review, follow-ups due, open tickets, and overdue invoices.</p>
        </div>
      </div>

      {failed.length > 0 && <ErrorAlert message={`Couldn't load ${failed.join(", ")}; this list may be incomplete.`} onRetry={refresh} />}

      <div className="admin-toolbar">
        <button className={`dash-tab-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All ({items.length})</button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`dash-tab-btn ${filter === c ? "active" : ""}`} onClick={() => setFilter(c)}>
            {ATTENTION_CATEGORY_LABEL[c]} ({count(c)})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="dash-empty-state">{loading ? "Checking…" : "Nothing needs attention here."}</div>
      ) : (
        <div className="overview-attention-list">
          {visible.map((a) => (
            <Link href={a.href} key={a.key} className="overview-attention-row">
              <span className="overview-attention-name">
                <span className="admin-muted">{ATTENTION_CATEGORY_LABEL[a.category]} · </span>
                {a.text}
              </span>
              <ArrowRight size={14} />
            </Link>
          ))}
        </div>
      )}
    </ConsoleLayout>
  );
}
