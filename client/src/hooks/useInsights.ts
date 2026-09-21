import { useEffect, useState } from "react";
import { fetchInsights } from "@/lib/wp";
import { insightsData, Insight } from "@/data/insights";

interface UseInsightsResult {
  insights: Insight[];
  loading: boolean;
  error: string | null;
}

let cache: Insight[] | null = null;

export function useInsights(): UseInsightsResult {
  const [insights, setInsights] = useState<Insight[]>(cache ?? insightsData);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;

    fetchInsights()
      .then((data) => {
        if (cancelled || data.length === 0) return;
        cache = data;
        setInsights(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load insights");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { insights, loading, error };
}
