import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared data-loading primitive for console pages.
 *
 * Written because nine console pages each hand-rolled the same shape — a
 * `useEffect`, `setLoading(true)`, a `try/catch`, a `setError` — and every one of
 * them had the same two gaps:
 *
 *  1. **No retry.** A page that failed showed a message and offered nothing but a
 *     manual browser reload. That is worst exactly when it matters: during an
 *     incident, when a transient edge-function error should not cost a reload.
 *  2. **Inconsistent cancellation.** Only `BillingSla` guarded against setting
 *     state after unmount or after a workspace switch. The others could resolve a
 *     stale request and overwrite fresher data — the classic race where a slow
 *     response for workspace A lands after a fast response for workspace B.
 *
 * Both are solved once here rather than nine times.
 *
 * @param loader  Async function returning the data. Receives an AbortSignal; the
 *                hook ignores any settlement after that signal fires.
 * @param deps    Re-run when these change (typically `[activeWorkspace?.id]`).
 *                Pass an empty array for a one-shot load.
 * @param options.enabled  Skip loading entirely (e.g. no workspace selected yet).
 *                Reported as `loading: false` so the UI does not spin forever.
 */
export interface AsyncResource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** True once a load has completed successfully at least once. */
  loaded: boolean;
  /** Re-run the loader, showing the full loading state. */
  retry: () => void;
  /**
   * Re-run without clearing current data — for a toolbar refresh where blanking
   * the page would be a downgrade.
   */
  refresh: () => Promise<void>;
  /** True while a `refresh()` is in flight. */
  refreshing: boolean;
}

export function useAsyncResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
  options: { enabled?: boolean; errorMessage?: string } = {}
): AsyncResource<T> {
  const { enabled = true, errorMessage = "Failed to load data" } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);

  // Latest loader in a ref so `run` stays stable: a fresh inline arrow function
  // on every render must not retrigger the effect, or every page would loop.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  // One controller per in-flight load. A new run aborts the previous request, so
  // a stale response can never overwrite a newer one.
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const run = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!enabled) {
        setLoading(false);
        return;
      }
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      if (mode === "initial") {
        setLoading(true);
        setError(null);
      } else {
        setRefreshing(true);
      }

      try {
        const result = await loaderRef.current(controller.signal);
        if (controller.signal.aborted || !mountedRef.current) return;
        setData(result);
        setError(null);
        setLoaded(true);
      } catch (err) {
        if (controller.signal.aborted || !mountedRef.current) return;
        // supabase-js PostgrestErrors are plain objects, not Error instances --
        // read their message too, or a real database error hides behind the
        // generic fallback.
        const message =
          err instanceof Error
            ? err.message
            : typeof (err as { message?: unknown })?.message === "string"
              ? (err as { message: string }).message
              : null;
        setError(message || errorMessage);
      } finally {
        if (!controller.signal.aborted && mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [enabled, errorMessage]
  );

  useEffect(() => {
    void run("initial");
    // `nonce` lets retry() force a re-run; deps are the call site's dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, nonce, ...deps]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const refresh = useCallback(() => run("refresh"), [run]);

  return { data, loading, error, loaded, retry, refresh, refreshing };
}
