import * as React from "react";
import { Textarea, Label } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12, maxWidth: 400 }}>{children}</div>
);
export const Default = () => (
  <Stage>
    <div style={{ display: "grid", gap: 8 }}>
      <Label htmlFor="note">Match notes</Label>
      <Textarea id="note" rows={4} placeholder="Great rallies in game 2…" />
    </div>
  </Stage>
);
