import * as React from "react";
import { Checkbox, Label } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12 }}>{children}</div>
);
export const States = () => (
  <Stage>
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Checkbox id="a" /><Label htmlFor="a">Notify me about results</Label></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Checkbox id="b" defaultChecked /><Label htmlFor="b">Add to calendar</Label></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Checkbox id="c" disabled /><Label htmlFor="c">Premium only</Label></div>
    </div>
  </Stage>
);
