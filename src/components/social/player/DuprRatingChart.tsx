import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { DuprHistoryRow } from "@/hooks/social/useDuprRatingHistory";

interface Props {
  history: DuprHistoryRow[];
  loading: boolean;
}

interface ChartPoint {
  ts: number;
  dateLabel: string;
  doubles: number | null;
  singles: number | null;
  source: string;
}

export function DuprRatingChart({ history, loading }: Props) {
  const points: ChartPoint[] = useMemo(
    () =>
      history.map((h) => {
        const d = new Date(h.recorded_at ?? Date.now());
        return {
          ts: d.getTime(),
          dateLabel: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
          doubles: h.dupr_doubles,
          singles: h.dupr_singles,
          source: h.source,
        };
      }),
    [history],
  );

  // Pad y-domain by 0.2 around the data range so a flat line isn't centered.
  const yDomain = useMemo(() => {
    const values = points.flatMap((p) =>
      [p.doubles, p.singles].filter((v): v is number => v != null),
    );
    if (values.length === 0) return [2, 7];
    const min = Math.max(2, Math.min(...values) - 0.2);
    const max = Math.min(7, Math.max(...values) + 0.2);
    return [min, max];
  }, [points]);

  const hasSinglesSeries = points.some((p) => p.singles != null);

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (points.length < 2) {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          DUPR — 30 ngày
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cần thêm dữ liệu để vẽ biểu đồ. Cập nhật DUPR rating ở{" "}
          <span className="font-medium">Cài đặt → DUPR</span> để theo dõi tiến
          triển.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="px-2 pb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        DUPR — 30 ngày
      </h2>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            />
            <Line
              type="monotone"
              dataKey="doubles"
              name="Doubles"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
            {hasSinglesSeries && (
              <Line
                type="monotone"
                dataKey="singles"
                name="Singles"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={{ r: 2 }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
