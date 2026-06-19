import * as React from "react";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Button } from "vite_react_shadcn_ts";
export const Open = () => (
  <div className="bg-background text-foreground" style={{ minHeight: 280, padding: 40, display: "flex", justifyContent: "center", alignItems: "center" }}>
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild><Button variant="outline">DUPR 4.5</Button></TooltipTrigger>
        <TooltipContent>Dynamic Universal Pickleball Rating</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
);
