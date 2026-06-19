import * as React from "react";
import { Label, Checkbox } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12 }}>{children}</div>
);
export const Default = () => (
  <Stage>
    <Label htmlFor="name">Player name</Label>
  </Stage>
);
export const WithControl = () => (
  <Stage>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <Checkbox id="terms" defaultChecked />
      <Label htmlFor="terms">I agree to the tournament rules</Label>
    </div>
  </Stage>
);
