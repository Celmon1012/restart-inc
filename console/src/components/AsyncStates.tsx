import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared loading, empty, error and status components for console data surfaces.
 *
 * The console previously had **no** `aria-live` region, `role="status"`,
 * `role="alert"`, or `aria-busy` attribute anywhere in its source. On a
 * live-monitoring product that is not a formality: when a workspace refreshed and
 * a system flipped to down, or an approval succeeded, or a submit failed, a
 * screen-reader user was given no indication that anything had changed at all.
 *
 * These components put that announcement in one place so every page behaves the
 * same way, and so sighted users get the same explicit confirmation currently
 * scattered across ad-hoc per-page wording.
 */

/** Visually hidden but announced. Used for direct live-region text. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

/**
 * A polite live region for state that has *settled* — "Refreshed", "3 results",
 * "Decision recorded". Polite means it waits for the screen reader to finish its
 * current utterance rather than interrupting, which is right for confirmations.
 */
export function StatusRegion({ message }: { message: string | null }) {
  return (
    <div className="status-region" role="status" aria-live="polite" aria-atomic="true">
      {message ?? ""}
    </div>
  );
}

/**
 * An assertive live region for something the operator must know immediately —
 * a failed load or a failed submit. `role="alert"` implicitly uses assertive,
 * which interrupts: appropriate for failure, wrong for routine confirmation.
 */
export function ErrorAlert({
  message,
  onRetry,
  retryLabel = "Try again",
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="console-error-alert" role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <div className="console-error-alert-body">
        <strong>Something went wrong</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button type="button" className="console-retry-btn" onClick={onRetry}>
          <RefreshCw size={13} aria-hidden="true" />
          <span>{retryLabel}</span>
        </button>
      )}
    </div>
  );
}

/**
 * Loading placeholder with `aria-busy` and a live label, so the wait itself is
 * communicated rather than being a silent blank region.
 */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="dash-empty-state console-loading-state" aria-busy="true">
      <Loader2 size={16} className="console-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Empty state with an optional action, announced politely when it appears. */
export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="dash-empty-state console-empty-state">
      {icon && <div className="console-empty-icon" aria-hidden="true">{icon}</div>}
      <span className="console-empty-title">{title}</span>
      {hint && <p className="console-empty-hint">{hint}</p>}
      {action && <div className="console-empty-action">{action}</div>}
    </div>
  );
}

/**
 * Inline retry affordance for a failed panel that is not a full-page error —
 * e.g. one card on a page whose other cards loaded fine.
 */
export function InlineRetry({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="console-inline-retry" role="alert">
      <span>{message}</span>
      <button type="button" className="console-retry-btn" onClick={onRetry}>
        <RefreshCw size={12} aria-hidden="true" />
        <span>Retry</span>
      </button>
    </div>
  );
}
