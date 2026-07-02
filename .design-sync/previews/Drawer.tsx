import * as React from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, Button } from "vite_react_shadcn_ts";
export const Open = () => (
  <div className="bg-background text-foreground" style={{ minHeight: 520, position: "relative" }}>
    <Drawer defaultOpen modal={false}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Match recap</DrawerTitle>
          <DrawerDescription>Nguyen / Tran def. Pham / Le · 11-7, 9-11, 11-6</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button>Share result</Button>
          <Button variant="outline">Close</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  </div>
);
