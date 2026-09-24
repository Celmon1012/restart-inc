import { useCallback, useMemo, useState } from "react";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import {
  EmptyState,
  ErrorAlert,
  LoadingState,
  StatusRegion,
} from "@/components/AsyncStates";
import {
  groupByDay,
  KIND_LABEL,
  loadTimeline,
  type TimelineEvent,
  type TimelineKind,
  type TimelineTone,
} from "@/lib/timeline";
import { formatTime } from "@/lib/format";
import {
  Activity,
  Boxes,
  CalendarClock,
  Filter,
  HeartPulse,
  KeyRound,
  Rocket,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

const FILTERS: { key: TimelineKind | "all"; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <Activity size={12} /> },
  { key: "deploy", label: "Deploys", icon: <Rocket size={12} /> },
  { key: "delivery", label: "Delivery", icon: <Target size={12} /> },
  { key: "task", label: "Tasks", icon: <Boxes size={12} /> },
  { key: "agent", label: "Agent", icon: <Sparkles size={12} /> },
  { key: "lead", label: "Leads", icon: <Users size={12} /> },
  { key: "health", label: "Health", icon: <HeartPulse size={12} /> },
];

const RANGES = [
  { key: 7, label: "7 days" },
  { key: 30, label: "30 days" },
  { key: 90, label: "90 days" },
  { key: 0, label: "All time" },
];

function toneIcon(kind: TimelineKind) {
  switch (kind) {
    case "deploy":
      return <Rocket size={9} />;
    case "delivery":
      return <Target size={9} />;
    case "task":
      return <Boxes size={9} />;
    case "agent":
      return <Sparkles size={9} />;
    case "lead":
      return <Users size={9} />;
    case "health":
      return <HeartPulse size={9} />;
    case "key":
      return <KeyRound size={9} />;
  }
}

export default function Timeline() {
  const { activeWorkspace, loading: wsLoading, error: wsError, isAdmin } = useWorkspace();
  const [kind, setKind] = useState<TimelineKind | "all">("all");
  const [rangeDays, setRangeDays] = useState<number>(30);

  const loader = useCallback(
    (signal: AbortSignal) =>
      activeWorkspace
        ? loadTimeline(activeWorkspace, signal, { isAdmin })
        : Promise.resolve({ events: [], degradedSources: [] }),
    [activeWorkspace, isAdmin]
  );

  const { data, loading, error, retry, refresh, refreshing } = useAsyncResource(loader, [
    activeWorkspace?.id,
    isAdmin,
  ], { enabled: Boolean(activeWorkspace), errorMessage: "Failed to load activity" });

  const all = data?.events ?? [];
  const degraded = data?.degradedSources ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const e of all) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, [all]);

  const filtered = useMemo(() => {
    const cutoff = rangeDays > 0 ? Date.now() - rangeDays * 86_400_000 : 0;
    return all.filter(
      (e) => (kind === "all" || e.kind === kind) && new Date(e.at).getTime() >= cutoff
    );
  }, [all, kind, rangeDays]);

  const days = useMemo(() => groupByDay(filtered), [filtered]);

  // What the follow-up agent has done in this window, surfaced as a count rather
  // than left for the operator to tally from the feed. Only shown to admins,
  // since agent_runs is admin-only and a member would otherwise see a permanent
  // zero that reads as "the agent never runs".
  const agentRuns = useMemo(() => all.filter((e) => e.kind === "agent"), [all]);
  const agentSummary = useMemo(() => {
    const failed = agentRuns.filter((e) => e.tone === "down").length;
    return {
      total: agentRuns.length,
      failed,
      clean: agentRuns.length - failed,
    };
  }, [agentRuns]);

  const summary =
    loading || refreshing
      ? "Loading activity"
      : `${filtered.length} ${filtered.length === 1 ? "event" : "events"} shown`;

  return (
    <ConsoleLayout onRefresh={() => void refresh()} isRefreshing={refreshing}>
      <StatusRegion message={summary} />

      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">WORKSPACE HISTORY</span>
          <h1>Activity</h1>
          <p>
            {activeWorkspace
              ? `What has happened in ${activeWorkspace.name} — deploys, delivery, agent actions, and current health.`
              : "Loading workspace…"}
          </p>
        </div>
      </div>

      {wsLoading && !activeWorkspace ? (
        <LoadingState label="Loading your workspace…" />
      ) : wsError ? (
        <ErrorAlert message={wsError} />
      ) : !activeWorkspace ? (
        <EmptyState
          title="No workspace assigned"
          hint="No workspace has been assigned to your account yet. Contact Restart Inc to get set up."
        />
      ) : loading ? (
        <LoadingState label="Loading activity…" />
      ) : error ? (
        <ErrorAlert message={error} onRetry={retry} />
      ) : (
        <>
          {degraded.length > 0 && (
            <div className="console-inline-retry" role="status">
              <span>
                Some sources could not be read ({degraded.join(", ")}). Everything else is shown below.
              </span>
            </div>
          )}

          {isAdmin && agentSummary.total > 0 && (
            <div className="timeline-agent-summary">
              <div className="timeline-agent-summary-head">
                <Sparkles size={14} className="text-teal" aria-hidden="true" />
                <strong>Automated activity</strong>
                <span className="timeline-agent-scope">
                  all projects — the agent runs across the whole deployment, not one workspace
                </span>
              </div>
              <div className="timeline-agent-stats">
                <span>
                  <strong>{agentSummary.total}</strong> run{agentSummary.total === 1 ? "" : "s"}
                </span>
                <span>
                  <strong>{agentSummary.clean}</strong> completed
                </span>
                {agentSummary.failed > 0 && (
                  <span className="down">
                    <strong>{agentSummary.failed}</strong> failed
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="timeline-toolbar">
            <div className="timeline-filters" role="group" aria-label="Filter by event type">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`timeline-filter ${kind === f.key ? "active" : ""}`}
                  aria-pressed={kind === f.key}
                  onClick={() => setKind(f.key)}
                >
                  {f.icon}
                  <span>{f.label}</span>
                  <span className="timeline-filter-count">{counts[f.key] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="timeline-filters" role="group" aria-label="Filter by date range">
              <CalendarClock size={13} style={{ color: "var(--dim)" }} aria-hidden="true" />
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className={`timeline-range ${rangeDays === r.key ? "active" : ""}`}
                  aria-pressed={rangeDays === r.key}
                  onClick={() => setRangeDays(r.key)}
                  style={
                    rangeDays === r.key
                      ? { borderColor: "rgba(46,229,193,.4)", color: "var(--teal)" }
                      : undefined
                  }
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {all.length === 0 ? (
            <EmptyState
              icon={<Activity size={18} />}
              title="No activity recorded yet"
              hint="Deploys, delivery milestones, agent actions, and lead movements will appear here as they happen. This workspace has not recorded any events so far."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Filter size={18} />}
              title="No events match these filters"
              hint={`Nothing in the last ${rangeDays === 0 ? "recorded period" : `${rangeDays} days`} for ${
                kind === "all" ? "any type" : KIND_LABEL[kind]
              }. Try widening the date range or clearing the type filter.`}
              action={
                <button
                  type="button"
                  className="console-retry-btn"
                  onClick={() => {
                    setKind("all");
                    setRangeDays(0);
                  }}
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <>
              <div className="timeline-total">
                {filtered.length} {filtered.length === 1 ? "event" : "events"}
                {kind !== "all" && ` · ${KIND_LABEL[kind]}`}
                {rangeDays > 0 && ` · last ${rangeDays} days`}
              </div>
              {days.map((day) => (
                <section className="timeline-day" key={day.day}>
                  <div className="timeline-day-label">
                    <span>{day.label}</span>
                    <span className="timeline-day-count">{day.events.length}</span>
                  </div>
                  <div className="timeline-list">
                    {day.events.map((e: TimelineEvent) => (
                      <article className="timeline-event" key={e.id} tabIndex={0}>
                        <span
                          className={`timeline-node ${e.tone === "neutral" ? "" : e.tone}`}
                          aria-hidden="true"
                        >
                          {toneIcon(e.kind)}
                        </span>
                        <div className="timeline-event-body">
                          <div className="timeline-event-head">
                            <span className="timeline-event-title">{e.title}</span>
                            {e.synthetic && (
                              <span className="timeline-kind-tag" title="Derived from current state">
                                CURRENT
                              </span>
                            )}
                            <span className="timeline-event-time">{formatTime(e.at)}</span>
                          </div>
                          {e.detail && <p className="timeline-event-detail">{e.detail}</p>}
                          <div className="timeline-event-meta">
                            <span className="timeline-kind-tag">
                              {toneIcon(e.kind)}
                              {KIND_LABEL[e.kind]}
                            </span>
                            {e.actor && <span className="timeline-kind-tag">{e.actor}</span>}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </>
      )}
    </ConsoleLayout>
  );
}
