import * as React from "react";
import { Toggle } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12 }}>{children}</div>
);
export const Variants = () => (
  <Stage>
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Toggle>Bold</Toggle>
      <Toggle defaultPressed>Pressed</Toggle>
      <Toggle variant="outline">Outline</Toggle>
      <Toggle disabled>Disabled</Toggle>
    </div>
  </Stage>
);
