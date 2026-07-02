import * as React from "react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, Button } from "vite_react_shadcn_ts";
export const Open = () => (
  <div className="bg-background text-foreground" style={{ minHeight: 420, padding: 24, display: "flex", justifyContent: "center" }}>
    <DropdownMenu defaultOpen modal={false}>
      <DropdownMenuTrigger asChild><Button variant="outline">Match actions</Button></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Game 2 · Court A</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Enter score</DropdownMenuItem>
        <DropdownMenuItem>Pause match</DropdownMenuItem>
        <DropdownMenuItem>Report issue</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
