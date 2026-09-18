import { useState } from "react";
import { useDashboardLeaderboard } from "../../../hooks/use-dashboard-leaderboard";
import { BadgeIcon } from "../../badge-icon/BadgeIcon";
import "./Leaderboard.css";

export default function Leaderboard() {
  const { leaders, error, loading, refresh } = useDashboardLeaderboard();
  const [searchTerm, setSearchTerm] = useState("");
  const search = searchTerm.trim().toLocaleLowerCase();
  const filtered = (leaders ?? []).filter((member) =>
    member.name.toLocaleLowerCase().includes(search),
  );

  return (
    <div className="leaderboard-container" aria-busy={loading}>
      <div className="leaderboard-search">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by name..."
          aria-label="Search leaderboard by name"
        />
        <button type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <p className="leaderboard-note">
        Ranked by all-time points. Current points are available to spend.
      </p>
      {error && <p className="leaderboard-status" role="status">
        {error}{leaders !== null ? " Showing the last successfully loaded standings." : ""}
      </p>}
      <div className="leaderboard-scroll-container">
        <table className="leaderboard-table">
          <thead>
            <tr><th scope="col">Place</th><th scope="col">User</th><th scope="col">All-Time</th><th scope="col">Current</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={4} className="no-results">
                {leaders === null ? (loading ? "Loading current standings…" : "Standings are temporarily unavailable.") :
                  search ? "No matching members" : "No members ranked yet."}
              </td></tr>
            ) : filtered.map((member) => {
              const place = ["first-place", "second-place", "third-place"][member.rank - 1] ?? "";
              const medal = ["🏆 ", "🥈 ", "🥉 "][member.rank - 1] ?? "";
              return (
                <tr key={member.id} className={`leaderboard-row ${place}`}>
                  <td className="points-cell">{member.rank}</td>
                  <td>
                    {medal}{member.name}{" "}
                    {member.badges.map((badge) => (
                      <BadgeIcon key={badge.id} icon={badge.icon} name={badge.name} size={20}
                        imgClassName="custom-emoji" emojiClassName="custom-emoji" />
                    ))}
                  </td>
                  <td className="points-cell">{member.points.toLocaleString()}</td>
                  <td className="points-cell">{member.currentPoints.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
