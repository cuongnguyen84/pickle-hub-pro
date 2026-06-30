import * as React from "react";
import { Separator } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12, maxWidth: 320 }}>{children}</div>
);
export const Horizontal = () => (
  <Stage>
    <div>
      <div style={{ fontWeight: 600 }}>Court A</div>
      <p className="text-muted-foreground" style={{ fontSize: 13, margin: "4px 0 12px" }}>Center court · Stadium</p>
      <Separator />
      <div style={{ display: "flex", gap: 12, height: 24, alignItems: "center", marginTop: 12 }}>
        <span style={{ fontSize: 13 }}>Singles</span>
        <Separator orientation="vertical" />
        <span style={{ fontSize: 13 }}>Doubles</span>
        <Separator orientation="vertical" />
        <span style={{ fontSize: 13 }}>Mixed</span>
      </div>
    </div>
  </Stage>
);
