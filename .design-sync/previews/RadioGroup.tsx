import * as React from "react";
import { RadioGroup, RadioGroupItem, Label } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12 }}>{children}</div>
);
export const Format = () => (
  <Stage>
    <RadioGroup defaultValue="mixed">
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><RadioGroupItem value="singles" id="r1" /><Label htmlFor="r1">Singles</Label></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><RadioGroupItem value="doubles" id="r2" /><Label htmlFor="r2">Doubles</Label></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><RadioGroupItem value="mixed" id="r3" /><Label htmlFor="r3">Mixed doubles</Label></div>
    </RadioGroup>
  </Stage>
);
