import * as React from "react";
import { Popover, PopoverTrigger, PopoverContent, Button, Label, Input } from "vite_react_shadcn_ts";
export const Open = () => (
  <div className="bg-background text-foreground" style={{ minHeight: 360, padding: 24, display: "flex", justifyContent: "center" }}>
    <Popover defaultOpen modal={false}>
      <PopoverTrigger asChild><Button variant="outline">Court settings</Button></PopoverTrigger>
      <PopoverContent>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 600 }}>Court A</div>
          <div style={{ display: "grid", gap: 6 }}><Label htmlFor="surf">Surface</Label><Input id="surf" defaultValue="Outdoor acrylic" /></div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
);
