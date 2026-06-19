import * as React from "react";
import { Button } from "vite_react_shadcn_ts";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12 }}>{children}</div>
);

export const Variants = () => (
  <Stage>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <Button>Join tournament</Button>
      <Button variant="secondary">View bracket</Button>
      <Button variant="outline">Filter</Button>
      <Button variant="destructive">Cancel match</Button>
      <Button variant="ghost">Skip</Button>
      <Button variant="link">Learn more</Button>
    </div>
  </Stage>
);

export const Sizes = () => (
  <Stage>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  </Stage>
);

export const States = () => (
  <Stage>
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Button>Enabled</Button>
      <Button disabled>Disabled</Button>
    </div>
  </Stage>
);
