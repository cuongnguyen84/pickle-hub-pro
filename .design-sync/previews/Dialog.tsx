import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Input, Label } from "vite_react_shadcn_ts";
export const Open = () => (
  <div className="bg-background text-foreground" style={{ minHeight: 480 }}>
    <Dialog defaultOpen modal={false}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create tournament</DialogTitle>
          <DialogDescription>Set the basics. You can edit the bracket later.</DialogDescription>
        </DialogHeader>
        <div style={{ display: "grid", gap: 12, padding: "8px 0" }}>
          <div style={{ display: "grid", gap: 6 }}><Label htmlFor="t">Name</Label><Input id="t" defaultValue="Summer Slam 2026" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
);
