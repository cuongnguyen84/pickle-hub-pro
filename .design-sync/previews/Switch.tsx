import * as React from "react";
import { Switch, Label } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12 }}>{children}</div>
);
export const States = () => (
  <Stage>
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Switch id="s1" defaultChecked /><Label htmlFor="s1">Live score updates</Label></div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Switch id="s2" /><Label htmlFor="s2">Email digest</Label></div>
    </div>
  </Stage>
);
