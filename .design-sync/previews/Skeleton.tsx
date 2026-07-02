import * as React from "react";
import { Skeleton } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12 }}>{children}</div>
);
export const LoadingCard = () => (
  <Stage>
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <Skeleton className="h-12 w-12 rounded-full" />
      <div style={{ display: "grid", gap: 8 }}>
        <Skeleton className="h-4 w-[200px]" />
        <Skeleton className="h-4 w-[140px]" />
      </div>
    </div>
  </Stage>
);
