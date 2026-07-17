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
