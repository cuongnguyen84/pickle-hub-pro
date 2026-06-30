import * as React from "react";
import { Progress } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12, maxWidth: 360 }}>{children}</div>
);
export const Levels = () => (
  <Stage>
    <div style={{ display: "grid", gap: 16 }}>
      <div><div style={{ fontSize: 13, marginBottom: 6 }}>Bracket progress</div><Progress value={33} /></div>
      <div><div style={{ fontSize: 13, marginBottom: 6 }}>Registration filled</div><Progress value={72} /></div>
      <div><div style={{ fontSize: 13, marginBottom: 6 }}>Complete</div><Progress value={100} /></div>
    </div>
  </Stage>
);
