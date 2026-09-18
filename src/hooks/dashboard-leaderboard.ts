/** Public standings use the same live chapter roster as the ALL dashboard. */
export interface ChapterLeader {
  id: string;
  name: string;
  points: number;
  currentPoints: number;
  eventsAttended: number;
  rank: number;
  badges: Array<{ id: string; name: string; icon: string | null }>;
}

interface LeaderboardPage {
  leaderboard: ChapterLeader[];
  totalMembers: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

const LEADERBOARD_URL =
  "https://dashboard.all-ai-network.org/api/leaderboard?chapter=msoe-ai-club";
const PAGE_SIZE = 500;
let pending: Promise<ChapterLeader[]> | null = null;

async function loadLeaderboard(): Promise<ChapterLeader[]> {
  const leaders: ChapterLeader[] = [];
  const seen = new Set<string>();
  let totalMembers: number | undefined;
  for (let pageNumber = 0; pageNumber < 200; pageNumber += 1) {
    const offset = leaders.length;
    const response = await fetch(
      `${LEADERBOARD_URL}&limit=${PAGE_SIZE}&offset=${offset}`,
      { cache: "no-store", signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok) throw new Error("Could not load the latest standings.");
    const page = (await response.json()) as LeaderboardPage;
    if (
      !Array.isArray(page.leaderboard) ||
      !Number.isSafeInteger(page.totalMembers) || page.totalMembers < 0 ||
      page.offset !== offset || page.limit !== PAGE_SIZE ||
      typeof page.hasMore !== "boolean" ||
      (totalMembers !== undefined && page.totalMembers !== totalMembers)
    ) {
      throw new Error("Standings changed while loading. Please refresh.");
    }
    totalMembers = page.totalMembers;
    for (const [index, row] of page.leaderboard.entries()) {
      if (
        typeof row.id !== "string" || seen.has(row.id) ||
        typeof row.name !== "string" ||
        !Number.isFinite(row.points) || !Number.isFinite(row.currentPoints) ||
        row.rank !== offset + index + 1 || !Array.isArray(row.badges)
      ) {
        throw new Error("Standings changed while loading. Please refresh.");
      }
      seen.add(row.id);
      leaders.push(row);
    }
    if (!page.hasMore) {
      if (leaders.length !== totalMembers) {
        throw new Error("Could not load the complete standings. Please refresh.");
      }
      return leaders;
    }
    if (!page.leaderboard.length || leaders.length >= totalMembers) {
      throw new Error("Could not load the complete standings. Please refresh.");
    }
  }
  throw new Error("Could not load the complete standings. Please refresh.");
}

/** Deduplicate concurrent views, without keeping an old response after it settles. */
export function getChapterLeaderboard(): Promise<ChapterLeader[]> {
  if (!pending) {
    pending = loadLeaderboard().finally(() => { pending = null; });
  }
  return pending;
}
