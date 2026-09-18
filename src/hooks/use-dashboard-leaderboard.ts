import { useCallback, useEffect, useRef, useState } from "react";
import { getChapterLeaderboard, type ChapterLeader } from "./dashboard-leaderboard";

/** Refresh open standings after check-ins, on return to the tab, or on request. */
export function useDashboardLeaderboard() {
  const [leaders, setLeaders] = useState<ChapterLeader[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const next = await getChapterLeaderboard();
      if (mounted.current) {
        setLeaders(next);
        setError(null);
      }
    } catch {
      if (mounted.current) setError("We couldn't refresh the standings. Please try again.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(refreshVisible, 60_000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      mounted.current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [refresh]);

  return { leaders, error, loading, refresh };
}
