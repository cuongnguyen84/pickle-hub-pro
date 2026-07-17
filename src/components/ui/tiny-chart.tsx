import { useMemo, useRef, useState, useLayoutEffect } from "react";

// ============================================================================
// tiny-chart — zero-dependency SVG charts (perf-js-gzip).
// Replaces recharts (107.8 KB gz, eagerly preloaded on every page) for the
// three simple charts this app actually renders: line, bar, donut.
// Touch-first: tooltips follow pointerdown/move (no hover requirement),
// containers resize via ResizeObserver, empty/sparse data never throws —
// callers keep their own empty states, these components just render nothing
// extra when a series has <1 usable point.
// ============================================================================

const FONT = 11;
const AXIS_W = 34;
const PAD_TOP = 8;
const PAD_BOTTOM = 20;

function useContainerWidth(): [React.MutableRefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => min + i * step);
}

// Count data (views, users) needs whole-number ticks whose labels sit exactly
// on their gridlines — rounding fractional ticks mislabels the grid (the
// recharts allowDecimals behaviour this replaces).
function integerTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const step = Math.max(1, Math.ceil(max / count));
  const out = [];
  for (let t = 0; t <= max; t += step) out.push(t);
  if (out[out.length - 1] !== max) out.push(max);
  return out;
}

/** Thin x labels down to at most `max` evenly spread entries. */
function thinLabels(labels: string[], max = 8): (string | null)[] {
  if (labels.length <= max) return labels;
  const every = Math.ceil(labels.length / max);
  return labels.map((l, i) => (i % every === 0 ? l : null));
}

interface TooltipState {
  index: number;
  left: number;
  top: number;
}

function TooltipBox({
  left,
  top,
  children,
}: {
  left: number;
  top: number;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      style={{
        position: "absolute",
        left,
        top,
        transform: "translate(-50%, -100%)",
        background: "var(--tl-bg, hsl(var(--surface)))",
        border: "1px solid var(--tl-border, hsl(var(--border)))",
        borderRadius: 8,
        fontSize: 12,
        color: "var(--tl-fg, hsl(var(--foreground)))",
        padding: "6px 10px",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        zIndex: 10,
      }}
    >
      {children}
    </div>
  );
}

// ─── Line ───────────────────────────────────────────────────────────────────

export interface TinyLineSeries {
  /** y value per x index; null gaps are skipped (connectNulls behaviour) */
  values: (number | null)[];
  color: string;
  label: string;
  strokeWidth?: number;
  dashed?: boolean;
  dotRadius?: number;
}

interface TinyLineChartProps {
  xLabels: string[];
  series: TinyLineSeries[];
  height: number;
  yDomain?: [number, number];
  gridColor?: string;
  tickColor?: string;
  /** Rendered inside the tooltip for the hovered/tapped x index */
  renderTooltip?: (index: number) => React.ReactNode;
  ariaLabel: string;
  /** Skip ResizeObserver and render at this width (fixed-width hosts, tests) */
  fixedWidth?: number;
}

export function TinyLineChart({
  xLabels,
  series,
  height,
  yDomain,
  gridColor = "var(--tl-border, hsl(var(--border)))",
  tickColor = "var(--tl-fg-3, hsl(var(--foreground-secondary)))",
  renderTooltip,
  ariaLabel,
  fixedWidth,
}: TinyLineChartProps) {
  const [ref, measured] = useContainerWidth();
  const width = fixedWidth ?? measured;
  const [tip, setTip] = useState<TooltipState | null>(null);

  const n = xLabels.length;
  const plotW = Math.max(0, width - AXIS_W - 8);
  const plotH = Math.max(0, height - PAD_TOP - PAD_BOTTOM);

  // Without an explicit yDomain the data is count-like (views, users): anchor
  // at zero like recharts' [0, "auto"] did — an all-zero series must not
  // invent a [-1, 1] domain with negative ticks.
  const [yMin, yMax] = useMemo(() => {
    if (yDomain) return yDomain;
    const vals = series.flatMap((s) => s.values).filter((v): v is number => v != null);
    const max = vals.length ? Math.max(0, ...vals) : 0;
    return [0, max > 0 ? max : 1];
  }, [series, yDomain]);
  const autoDomain = !yDomain;

  const xAt = (i: number) => AXIS_W + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => PAD_TOP + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!renderTooltip || n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.min(
      n - 1,
      Math.max(0, Math.round(((px - AXIS_W) / (plotW || 1)) * (n - 1))),
    );
    setTip({ index: i, left: xAt(i), top: PAD_TOP });
  };

  if (width === 0) return <div ref={ref} style={{ width: "100%", height }} />;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onPointerLeave={() => setTip(null)}
        style={{ touchAction: "pan-y", display: "block" }}
      >
        {(autoDomain ? integerTicks(yMax) : niceTicks(yMin, yMax)).map((t) => (
          <g key={t}>
            <line
              x1={AXIS_W}
              x2={width - 8}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke={gridColor}
              strokeDasharray="3 3"
            />
            <text x={AXIS_W - 6} y={yAt(t) + 3} textAnchor="end" fontSize={FONT} fill={tickColor}>
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}
        {thinLabels(xLabels).map((l, i) =>
          l == null ? null : (
            <text
              key={i}
              x={xAt(i)}
              y={height - 4}
              textAnchor="middle"
              fontSize={FONT}
              fill={tickColor}
            >
              {l}
            </text>
          ),
        )}
        {series.map((s, si) => {
          const pts = s.values
            .map((v, i) => (v == null ? null : `${xAt(i)},${yAt(v)}`))
            .filter(Boolean)
            .join(" ");
          return (
            <g key={si}>
              {pts.includes(" ") && (
                <polyline
                  points={pts}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.strokeWidth ?? 2}
                  strokeDasharray={s.dashed ? "4 3" : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {(s.dotRadius ?? 0) > 0 &&
                s.values.map((v, i) =>
                  v == null ? null : (
                    <circle
                      key={i}
                      cx={xAt(i)}
                      cy={yAt(v)}
                      r={tip?.index === i ? (s.dotRadius ?? 3) + 2 : s.dotRadius}
                      fill={s.color}
                    />
                  ),
                )}
            </g>
          );
        })}
        {tip && (
          <line
            x1={tip.left}
            x2={tip.left}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke={gridColor}
          />
        )}
      </svg>
      {tip && renderTooltip && (
        <TooltipBox left={tip.left} top={tip.top}>
          {renderTooltip(tip.index)}
        </TooltipBox>
      )}
    </div>
  );
}

// ─── Bar ────────────────────────────────────────────────────────────────────

interface TinyBarChartProps {
  xLabels: string[];
  values: number[];
  height: number;
  barColor: string;
  gridColor?: string;
  tickColor?: string;
  renderTooltip?: (index: number) => React.ReactNode;
  ariaLabel: string;
  /** Skip ResizeObserver and render at this width (fixed-width hosts, tests) */
  fixedWidth?: number;
}

export function TinyBarChart({
  xLabels,
  values,
  height,
  barColor,
  gridColor = "hsl(var(--border))",
  tickColor = "hsl(var(--foreground-secondary))",
  renderTooltip,
  ariaLabel,
  fixedWidth,
}: TinyBarChartProps) {
  const [ref, measured] = useContainerWidth();
  const width = fixedWidth ?? measured;
  const [tip, setTip] = useState<TooltipState | null>(null);

  const n = values.length;
  const plotW = Math.max(0, width - AXIS_W - 8);
  const plotH = Math.max(0, height - PAD_TOP - PAD_BOTTOM);
  const yMax = Math.max(1, ...values);
  const slot = n > 0 ? plotW / n : 0;
  const barW = Math.max(2, Math.min(28, slot * 0.6));
  const xAt = (i: number) => AXIS_W + i * slot + slot / 2;
  const yAt = (v: number) => PAD_TOP + plotH - (v / yMax) * plotH;

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!renderTooltip || n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.min(n - 1, Math.max(0, Math.floor((px - AXIS_W) / (slot || 1))));
    setTip({ index: i, left: xAt(i), top: yAt(values[i]) });
  };

  if (width === 0) return <div ref={ref} style={{ width: "100%", height }} />;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onPointerLeave={() => setTip(null)}
        style={{ touchAction: "pan-y", display: "block" }}
      >
        {integerTicks(yMax).map((t) => (
          <g key={t}>
            <line
              x1={AXIS_W}
              x2={width - 8}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke={gridColor}
              strokeDasharray="3 3"
              opacity={0.3}
            />
            <text x={AXIS_W - 6} y={yAt(t) + 3} textAnchor="end" fontSize={FONT} fill={tickColor}>
              {t}
            </text>
          </g>
        ))}
        {thinLabels(xLabels).map((l, i) =>
          l == null ? null : (
            <text
              key={i}
              x={xAt(i)}
              y={height - 4}
              textAnchor="middle"
              fontSize={FONT}
              fill={tickColor}
            >
              {l}
            </text>
          ),
        )}
        {values.map((v, i) => (
          <rect
            key={i}
            x={xAt(i) - barW / 2}
            y={yAt(v)}
            width={barW}
            height={Math.max(0, PAD_TOP + plotH - yAt(v))}
            rx={3}
            fill={barColor}
            opacity={tip == null || tip.index === i ? 1 : 0.6}
          />
        ))}
      </svg>
      {tip && renderTooltip && (
        <TooltipBox left={tip.left} top={tip.top}>
          {renderTooltip(tip.index)}
        </TooltipBox>
      )}
    </div>
  );
}

// ─── Donut ──────────────────────────────────────────────────────────────────

export interface TinyDonutSegment {
  value: number;
  color: string;
  label: string;
}

interface TinyDonutProps {
  segments: TinyDonutSegment[];
  height: number;
  innerRadius?: number;
  outerRadius?: number;
  renderTooltip?: (index: number) => React.ReactNode;
  ariaLabel: string;
  /** Skip ResizeObserver and render at this width (fixed-width hosts, tests) */
  fixedWidth?: number;
}

export function TinyDonut({
  segments,
  height,
  innerRadius = 60,
  outerRadius = 80,
  renderTooltip,
  ariaLabel,
  fixedWidth,
}: TinyDonutProps) {
  const [ref, measured] = useContainerWidth();
  const width = fixedWidth ?? measured;
  const [tip, setTip] = useState<TooltipState | null>(null);

  const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  const cx = width / 2;
  const cy = height / 2;
  const gapRad = 0.06; // small gap between segments

  const arcs = useMemo(() => {
    if (total <= 0) return [];
    let angle = -Math.PI / 2;
    return segments.map((seg) => {
      const sweep = (Math.max(0, seg.value) / total) * 2 * Math.PI;
      // Gap shrinks for thin slices so a small-but-positive segment keeps at
      // least half its sweep instead of collapsing to an invisible arc.
      const gap = Math.min(gapRad, sweep / 2);
      const start = angle + gap / 2;
      const end = angle + sweep - gap / 2;
      angle += sweep;
      return { start, end, seg };
    });
  }, [segments, total]);

  const arcPath = (start: number, end: number) => {
    const large = end - start > Math.PI ? 1 : 0;
    const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
    return [
      `M ${p(outerRadius, start)}`,
      `A ${outerRadius} ${outerRadius} 0 ${large} 1 ${p(outerRadius, end)}`,
      `L ${p(innerRadius, end)}`,
      `A ${innerRadius} ${innerRadius} 0 ${large} 0 ${p(innerRadius, start)}`,
      "Z",
    ].join(" ");
  };

  if (width === 0) return <div ref={ref} style={{ width: "100%", height }} />;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height }}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} style={{ display: "block" }}>
        {arcs.map(({ start, end, seg }, i) => (
          <path
            key={i}
            d={arcPath(start, end)}
            fill={seg.color}
            opacity={tip == null || tip.index === i ? 1 : 0.6}
            onPointerDown={() => {
              const mid = (start + end) / 2;
              setTip({
                index: i,
                left: cx + ((innerRadius + outerRadius) / 2) * Math.cos(mid),
                top: cy + ((innerRadius + outerRadius) / 2) * Math.sin(mid),
              });
            }}
            onPointerEnter={() => {
              const mid = (start + end) / 2;
              setTip({
                index: i,
                left: cx + ((innerRadius + outerRadius) / 2) * Math.cos(mid),
                top: cy + ((innerRadius + outerRadius) / 2) * Math.sin(mid),
              });
            }}
            onPointerLeave={() => setTip(null)}
          />
        ))}
      </svg>
      {tip && renderTooltip && (
        <TooltipBox left={tip.left} top={tip.top}>
          {renderTooltip(tip.index)}
        </TooltipBox>
      )}
    </div>
  );
}
