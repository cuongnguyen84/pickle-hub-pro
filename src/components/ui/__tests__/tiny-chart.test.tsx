// Empty/sparse-data contract for tiny-chart (perf-js-gzip). recharts had
// implicit grace for sparse series; these pin the same guarantee on the
// replacement so a player profile with 0-2 rating points never throws or
// renders a broken chart (the silent-failure mode from the pre-mortem).
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TinyLineChart, TinyBarChart, TinyDonut } from "../tiny-chart";

const line = (values: (number | null)[], xLabels = values.map((_, i) => `d${i}`)) =>
  renderToStaticMarkup(
    <TinyLineChart
      height={220}
      xLabels={xLabels}
      series={[{ label: "Doubles", values, color: "green", dotRadius: 3 }]}
      ariaLabel="test chart"
    />,
  );

describe("TinyLineChart sparse data", () => {
  it("renders without throwing for empty series", () => {
    expect(() => line([])).not.toThrow();
  });

  it("renders without throwing for a single point", () => {
    expect(() => line([3.5])).not.toThrow();
  });

  it("renders without throwing when all values are null", () => {
    expect(() => line([null, null, null])).not.toThrow();
  });

  it("skips null gaps instead of crashing (connectNulls behaviour)", () => {
    expect(() => line([3.1, null, 3.4, null, 3.2])).not.toThrow();
  });

  it("server-render emits the measuring container (chart mounts client-side)", () => {
    // Before ResizeObserver fires, width is 0 and only the wrapper div
    // renders — first paint must never be a mis-scaled SVG.
    const html = line([3.1, 3.2, 3.3]);
    expect(html).toContain("<div");
    expect(html).not.toContain("<svg");
  });
});

describe("full render at fixed width", () => {
  it("line chart renders grid, thinned x labels, polyline, dots and both series", () => {
    const html = renderToStaticMarkup(
      <TinyLineChart
        height={220}
        fixedWidth={600}
        xLabels={Array.from({ length: 20 }, (_, i) => `${i + 1}/07`)}
        yDomain={[2, 7]}
        series={[
          {
            label: "Doubles",
            values: Array.from({ length: 20 }, (_, i) => 3 + (i % 5) * 0.1),
            color: "green",
            dotRadius: 3,
          },
          {
            label: "Singles",
            values: Array.from({ length: 20 }, (_, i) => (i % 3 === 0 ? null : 2.8)),
            color: "gray",
            dashed: true,
            dotRadius: 2,
          },
        ]}
        ariaLabel="dupr chart"
        renderTooltip={(i) => <div>{i}</div>}
      />,
    );
    expect(html).toContain("<svg");
    expect(html).toContain("aria-label=\"dupr chart\"");
    expect(html).toContain("<polyline");
    expect(html).toContain("stroke-dasharray");
    expect(html).toContain("<circle");
    // 20 labels must be thinned, not all rendered
    expect((html.match(/\/07</g) ?? []).length).toBeLessThan(20);
  });

  it("single-point series renders a dot without a polyline", () => {
    const html = renderToStaticMarkup(
      <TinyLineChart
        height={100}
        fixedWidth={400}
        xLabels={["a"]}
        series={[{ label: "s", values: [3.5], color: "green", dotRadius: 3 }]}
        ariaLabel="one point"
      />,
    );
    expect(html).toContain("<circle");
    expect(html).not.toContain("<polyline");
  });

  it("bar chart renders one rect per value with y ticks", () => {
    const html = renderToStaticMarkup(
      <TinyBarChart
        height={200}
        fixedWidth={600}
        xLabels={["T2", "T3", "T4"]}
        values={[0, 5, 12]}
        barColor="blue"
        ariaLabel="new users"
        renderTooltip={(i) => <div>{i}</div>}
      />,
    );
    expect((html.match(/<rect/g) ?? []).length).toBe(3);
    expect(html).toContain("T2");
    expect(html).toContain("12");
  });

  it("donut renders one arc path per positive segment", () => {
    const html = renderToStaticMarkup(
      <TinyDonut
        height={200}
        fixedWidth={400}
        segments={[
          { value: 70, color: "green", label: "Video" },
          { value: 30, color: "red", label: "Livestream" },
        ]}
        ariaLabel="views by type"
        renderTooltip={(i) => <div>{i}</div>}
      />,
    );
    expect((html.match(/<path/g) ?? []).length).toBe(2);
    expect(html).toContain("aria-label=\"views by type\"");
  });
});

describe("codex findings (PR #389 hotfix)", () => {
  it("auto domain anchors count data at zero — all-zero series shows no negative ticks", () => {
    const html = renderToStaticMarkup(
      <TinyLineChart
        height={300}
        fixedWidth={600}
        xLabels={["a", "b", "c"]}
        series={[{ label: "views", values: [0, 0, 0], color: "blue", dotRadius: 3 }]}
        ariaLabel="views"
      />,
    );
    expect(html).not.toContain(">-1<");
    expect(html).not.toContain(">-0.5<");
    expect(html).toContain(">0<");
  });

  it("integer ticks sit exactly on their gridlines (no rounded labels)", () => {
    const html = renderToStaticMarkup(
      <TinyBarChart
        height={200}
        fixedWidth={600}
        xLabels={["a"]}
        values={[1]}
        barColor="blue"
        ariaLabel="bars"
      />,
    );
    // max=1 must yield ticks 0 and 1 exactly once each — not 0,0,1,1,1
    expect((html.match(/>0</g) ?? []).length).toBe(1);
    expect((html.match(/>1</g) ?? []).length).toBe(1);
  });

  it("donut keeps a tiny positive segment visible (1000 vs 1)", () => {
    const html = renderToStaticMarkup(
      <TinyDonut
        height={200}
        fixedWidth={400}
        segments={[
          { value: 1000, color: "green", label: "Video" },
          { value: 1, color: "red", label: "Livestream" },
        ]}
        ariaLabel="views by type"
      />,
    );
    const paths = html.match(/<path[^>]+d="([^"]+)"/g) ?? [];
    expect(paths.length).toBe(2);
    // the tiny slice's outer arc must span a nonzero angle: its two arc
    // endpoints must differ (a collapsed arc repeats the same point)
    const d = paths[1];
    const nums = [...d.matchAll(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map((m) => m[0]);
    expect(nums[0]).not.toEqual(nums[1]);
  });
});

describe("TinyBarChart / TinyDonut sparse data", () => {
  it("bar chart tolerates empty values", () => {
    expect(() =>
      renderToStaticMarkup(
        <TinyBarChart height={200} xLabels={[]} values={[]} barColor="blue" ariaLabel="bars" />,
      ),
    ).not.toThrow();
  });

  it("donut tolerates all-zero segments", () => {
    expect(() =>
      renderToStaticMarkup(
        <TinyDonut
          height={200}
          segments={[
            { value: 0, color: "red", label: "a" },
            { value: 0, color: "blue", label: "b" },
          ]}
          ariaLabel="donut"
        />,
      ),
    ).not.toThrow();
  });
});
