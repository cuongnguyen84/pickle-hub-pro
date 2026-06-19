import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, Button, Label, Input } from "vite_react_shadcn_ts";
export const Open = () => (
  <div className="bg-background text-foreground" style={{ minHeight: 520 }}>
    <Sheet defaultOpen modal={false}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Filter players</SheetTitle>
          <SheetDescription>Narrow the directory by rating and format.</SheetDescription>
        </SheetHeader>
        <div style={{ display: "grid", gap: 12, padding: "16px 0" }}>
          <div style={{ display: "grid", gap: 6 }}><Label htmlFor="min">Min DUPR</Label><Input id="min" defaultValue="4.0" /></div>
        </div>
        <SheetFooter><Button>Apply filters</Button></SheetFooter>
      </SheetContent>
    </Sheet>
  </div>
);
