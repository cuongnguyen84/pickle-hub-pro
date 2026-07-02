import * as React from "react";
import { Input, Label } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12, maxWidth: 360 }}>{children}</div>
);
export const WithLabel = () => (
  <Stage>
    <div style={{ display: "grid", gap: 8 }}>
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="player@thepicklehub.net" />
    </div>
  </Stage>
);
export const States = () => (
  <Stage>
    <div style={{ display: "grid", gap: 12 }}>
      <Input placeholder="Search players…" />
      <Input defaultValue="Cuong Nguyen" />
      <Input placeholder="Disabled" disabled />
    </div>
  </Stage>
);
