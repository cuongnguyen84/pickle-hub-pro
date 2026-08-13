// Shared layout for the F04–F07 component matrices.
import type { ReactNode } from "react";

export const MatrixSection = ({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) => (
  <section aria-labelledby={id} style={{ marginBottom: 34 }}>
    <h2 className="tl-shop-h2" id={id} style={{ marginTop: 0 }}>
      {title}
    </h2>
    {note && (
      <p className="tl-shop-hint" style={{ marginTop: -6, marginBottom: 12, maxWidth: "72ch" }}>
        {note}
      </p>
    )}
    {children}
  </section>
);

export const Cell = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ minWidth: 0 }}>
    <p className="tl-shop-eyebrow" style={{ marginBottom: 7, display: "block" }}>
      {label}
    </p>
    {children}
  </div>
);

export const Cells = ({ min = 150, children }: { min?: number; children: ReactNode }) => (
  <div
    style={{
      display: "grid",
      gap: 16,
      gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
      alignItems: "start",
    }}
  >
    {children}
  </div>
);
