import { Link } from "react-router-dom";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlayerStatsRow } from "@/hooks/social/usePlayerStats";

interface PlayerStatsProps {
  stats: PlayerStatsRow | null | undefined;
  loading: boolean;
}

export function PlayerStats({ stats, loading }: PlayerStatsProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats || stats.total_matches === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Chưa có trận đấu nào trên ThePickleHub.
        </p>
        <Button asChild className="mt-3" size="sm">
          <Link to="/tran-dau/moi">Log trận đầu</Link>
        </Button>
      </section>
    );
  }

  const winRateNum = Number(stats.win_rate ?? 0);
  const streak = stats.current_streak ?? 0;
  const StreakIcon = streak > 0 ? TrendingUp : streak < 0 ? TrendingDown : Minus;
  const streakColor =
    streak > 0
      ? "text-green-600 dark:text-green-400"
      : streak < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCell
        label="Win Rate"
        value={`${winRateNum.toFixed(1)}%`}
        sub={`${stats.wins ?? 0}W - ${stats.losses ?? 0}L`}
      />
      <StatCell
        label="Tổng trận"
        value={`${stats.total_matches ?? 0}`}
        sub="đã verified"
      />
      <StatCell
        label="Phong độ"
        value={<FormSparkline form={stats.last_5_form ?? ""} />}
        sub="5 trận gần nhất"
      />
      <StatCell
        label="Streak"
        value={
          <span className={`flex items-center gap-1 ${streakColor}`}>
            <StreakIcon className="h-4 w-4" />
            {Math.abs(streak)}
          </span>
        }
        sub={
          streak > 0
            ? "thắng liên tiếp"
            : streak < 0
              ? "thua liên tiếp"
              : "không liên tiếp"
        }
      />
    </section>
  );
}

interface StatCellProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
}
function StatCell({ label, value, sub }: StatCellProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {sub && (
        <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}

/** 5-cell sparkline; W=green pip, L=red pip. Newest match leftmost. */
function FormSparkline({ form }: { form: string }) {
  const cells = form.padEnd(5, "·").slice(0, 5).split("");
  return (
    <div className="flex justify-center gap-0.5">
      {cells.map((c, i) => (
        <span
          key={i}
          className={`inline-block h-4 w-2 rounded-sm ${
            c === "W"
              ? "bg-green-500"
              : c === "L"
                ? "bg-red-500"
                : "bg-muted"
          }`}
          aria-label={c === "W" ? "Win" : c === "L" ? "Loss" : "no game"}
        />
      ))}
    </div>
  );
}
