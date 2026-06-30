import * as React from "react";
import { Badge } from "vite_react_shadcn_ts";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12 }}>{children}</div>
);

export const Variants = () => (
  <Stage>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      <Badge>LIVE</Badge>
      <Badge variant="secondary">Mixed Doubles</Badge>
      <Badge variant="destructive">Sold out</Badge>
      <Badge variant="outline">4.5 DUPR</Badge>
    </div>
  </Stage>
);
