// ARCH-04: shared style tokens for the tournament-format setup pages
// (QT/Flex/DE variant — TeamMatch overrides fontSize/desc locally).
// Extracted verbatim from the four per-page copies.

export const surfaceCard: React.CSSProperties = {
  background: "var(--tl-bg-elev)",
  border: "1px solid var(--tl-border)",
  borderRadius: "var(--tl-radius-lg)",
  padding: 28,
};

export const stepKickerStyle: React.CSSProperties = {
  fontFamily: "Geist Mono, ui-monospace, monospace",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--tl-green)",
  marginBottom: 8,
};

export const stepHeadingStyle: React.CSSProperties = {
  fontFamily: "Instrument Serif, serif",
  fontStyle: "italic",
  fontWeight: 400,
  fontSize: 28,
  letterSpacing: "-0.015em",
  lineHeight: 1.05,
  margin: 0,
  color: "var(--tl-fg)",
};

export const stepDescStyle: React.CSSProperties = {
  fontSize: 14.5,
  color: "var(--tl-fg-3)",
  marginTop: 6,
  lineHeight: 1.5,
};
