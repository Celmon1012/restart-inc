import { useCallback, useEffect, useRef, useState } from "react";
import { fetchInsights } from "@/lib/wp";
import { insightsData, Insight } from "@/data/insights";

export { MIN_PUBLISHED_CHARS } from "@/data/insights";

interface UseInsightsResult {
  /** Everything WordPress returned, drafts included. */
  insights: Insight[];
  /** Published posts only — safe to list, link, and advertise. */
  published: Insight[];
  /** In-progress posts, surfaced separately as "Coming soon". */
  drafts: Insight[];
  loading: boolean;
  /** True when WordPress was unreachable and bundled content is being shown. */
  degraded: boolean;
  error: string | null;
  refetch: () => void;
}

// Module-level cache so moving between /insights and an article doesn't
// refetch. `cacheError` is remembered so a remount can render the degraded
// state immediately rather than flashing skeletons again.
let cache: Insight[] | null = null;
let cacheError: string | null = null;

// Safety valve: if WordPress is slow or hanging, stop showing skeletons and
// fall back to bundled content rather than leaving the page blank forever.
const REQUEST_TIMEOUT_MS = 8000;

function splitByDraft(list: Insight[]): { published: Insight[]; drafts: Insight[] } {
  const published: Insight[] = [];
  const drafts: Insight[] = [];
  for (const item of list) (item.isDraft ? drafts : published).push(item);
  return { published, drafts };
}

export function useInsights(): UseInsightsResult {
  const [insights, setInsights] = useState<Insight[]>(cache ?? insightsData);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(cacheError);
  const [degraded, setDegraded] = useState(Boolean(cacheError) && !cache);
  const [nonce, setNonce] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    // Already resolved this session and not an explicit refetch.
    if (cache && nonce === 0) return;

    let settled = false;
    setLoading(true);

    const timer = window.setTimeout(() => {
      if (settled || cancelledRef.current) return;
      settled = true;
      setLoading(false);
      if (!cache) {
        setDegraded(true);
        setError((prev) => prev ?? "Request timed out");
      }
    }, REQUEST_TIMEOUT_MS);

    fetchInsights()
      .then((data) => {
        if (settled || cancelledRef.current) return;
        settled = true;
        window.clearTimeout(timer);
        // Cache even an empty result: "reachable but nothing published yet" is
        // a valid state, not an error worth retrying on every mount.
        cache = data;
        cacheError = null;
        setInsights(data);
        setDegraded(false);
        setError(null);
      })
      .catch((err) => {
        if (settled || cancelledRef.current) return;
        settled = true;
        window.clearTimeout(timer);
        cacheError = err instanceof Error ? err.message : "Failed to load insights";
        setError(cacheError);
        // Keep bundled content visible rather than emptying the page.
        setDegraded(true);
      })
      .finally(() => {
        if (!cancelledRef.current) setLoading(false);
      });

    return () => {
      cancelledRef.current = true;
      window.clearTimeout(timer);
    };
  }, [nonce]);

  const refetch = useCallback(() => {
    cacheError = null;
    setError(null);
    setDegraded(false);
    setNonce((n) => n + 1);
  }, []);

  const { published, drafts } = splitByDraft(insights);

  return { insights, published, drafts, loading, degraded, error, refetch };
}
