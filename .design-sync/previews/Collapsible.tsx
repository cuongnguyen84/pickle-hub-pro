import * as React from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent, Button } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12, maxWidth: 360 }}>{children}</div>
);
export const Open = () => (
  <Stage>
    <Collapsible defaultOpen>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>Match rules</span>
        <CollapsibleTrigger asChild><Button variant="ghost" size="sm">Toggle</Button></CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="text-muted-foreground" style={{ fontSize: 14, marginTop: 10, lineHeight: 1.6 }}>
          Best of 3 games to 11, win by 2. Switch sides at 6 in the deciding game.
        </div>
      </CollapsibleContent>
    </Collapsible>
  </Stage>
);
