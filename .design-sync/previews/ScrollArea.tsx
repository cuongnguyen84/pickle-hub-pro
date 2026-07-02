import * as React from "react";
import { ScrollArea, Separator } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12 }}>{children}</div>
);
const courts = Array.from({ length: 12 }, (_, i) => `Court ${i + 1}`);
export const CourtList = () => (
  <Stage>
    <ScrollArea className="h-48 w-56 rounded-md border">
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Courts</div>
        {courts.map((c) => (
          <div key={c}><div style={{ fontSize: 14, padding: "6px 0" }}>{c}</div><Separator /></div>
        ))}
      </div>
    </ScrollArea>
  </Stage>
);
