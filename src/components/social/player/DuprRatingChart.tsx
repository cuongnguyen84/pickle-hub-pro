import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { TinyLineChart } from "@/components/ui/tiny-chart";
import { useI18n } from "@/i18n";
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
 * Editorial chart section — eyebrow tag, hairline divider top, SVG lines
 * (tiny-chart, recharts removed by perf-js-gzip) using TheLine green token
 * for the doubles series + dim color for singles. No card border around the
 * chart itself; it lives directly inside the section.
 */
export function DuprRatingChart({ history, loading }: Props) {
  const { language } = useI18n();
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

  const yDomain = useMemo<[number, number]>(() => {
    const values = points.flatMap((p) =>
      [p.doubles, p.singles].filter((v): v is number => v != null),
    );
    if (values.length === 0) return [2, 7];
    const min = Math.max(2, Math.min(...values) - 0.2);
    const max = Math.min(7, Math.max(...values) + 0.2);
    return [min, max];
  }, [points]);

  const hasSinglesSeries = points.some((p) => p.singles != null);

  const sectionLabel = language === "vi" ? "DUPR — 30 NGÀY" : "DUPR — 30 DAYS";

  if (loading) {
    return (
      <Section label={sectionLabel}>
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
      <Section label={sectionLabel}>
        <p
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            fontSize: 18,
            color: "var(--tl-fg-3)",
            margin: 0,
          }}
        >
          {language === "vi"
            ? "Cần thêm dữ liệu để vẽ biểu đồ."
            : "Need more data points to render this chart."}
        </p>
      </Section>
    );
  }

  return (
    <Section label={sectionLabel}>
      <TinyLineChart
        height={220}
        xLabels={points.map((p) => p.dateLabel)}
        yDomain={yDomain}
        gridColor="var(--tl-border)"
        tickColor="var(--tl-fg-3)"
        ariaLabel={
          language === "vi" ? "Biểu đồ DUPR 30 ngày" : "DUPR 30-day chart"
        }
        series={[
          {
            label: "Doubles",
            values: points.map((p) => p.doubles),
            color: "var(--tl-green)",
            strokeWidth: 2,
            dotRadius: 3,
          },
          ...(hasSinglesSeries
            ? [
                {
                  label: "Singles",
                  values: points.map((p) => p.singles),
                  color: "var(--tl-fg-3)",
                  strokeWidth: 1.5,
                  dashed: true,
                  dotRadius: 2,
                },
              ]
            : []),
        ]}
        renderTooltip={(i) => (
          <>
            <div style={{ color: "var(--tl-fg-3)" }}>{points[i].dateLabel}</div>
            {points[i].doubles != null && (
              <div>Doubles: {points[i].doubles}</div>
            )}
            {points[i].singles != null && (
              <div>Singles: {points[i].singles}</div>
            )}
          </>
        )}
      />
    </Section>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        padding: "32px 0",
        borderTop: "1px solid var(--tl-border)",
      }}
    >
      <div className="tl-eyebrow" aria-hidden="true">
        <span className="pip" />
        <span>{label}</span>
      </div>
      {children}
    </section>
  );
}
