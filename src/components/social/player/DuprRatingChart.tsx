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

/**
 * Editorial chart section — eyebrow tag, hairline divider top, Recharts
 * lines using TheLine green token for the doubles series + dim color for
 * singles. No card border around the chart itself; it lives directly
 * inside the section.
 */
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
      <Section>
        <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
          <Loader2
            className="h-5 w-5 animate-spin"
            style={{ color: "var(--tl-fg-3)" }}
          />
        </div>
      </Section>
    );
  }

  if (points.length < 2) {
    return (
      <Section>
        <p
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            fontSize: 18,
            color: "var(--tl-fg-3)",
            margin: 0,
          }}
        >
          Cần thêm dữ liệu để vẽ biểu đồ.
        </p>
      </Section>
    );
  }

  return (
    <Section>
      <div style={{ height: 220, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
          >
            <CartesianGrid stroke="var(--tl-border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 11, fill: "var(--tl-fg-3)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 11, fill: "var(--tl-fg-3)" }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                background: "var(--tl-bg)",
                border: "1px solid var(--tl-border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--tl-fg)",
              }}
              labelStyle={{ color: "var(--tl-fg-3)" }}
            />
            <Line
              type="monotone"
              dataKey="doubles"
              name="Doubles"
              stroke="var(--tl-green)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--tl-green)" }}
              activeDot={{ r: 5 }}
              connectNulls
            />
            {hasSinglesSeries && (
              <Line
                type="monotone"
                dataKey="singles"
                name="Singles"
                stroke="var(--tl-fg-3)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={{ r: 2 }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        padding: "32px 0",
        borderTop: "1px solid var(--tl-border)",
      }}
    >
      <div className="tl-eyebrow" aria-hidden="true">
        <span className="pip" />
        <span>DUPR — 30 NGÀY</span>
      </div>
      {children}
    </section>
  );
}
