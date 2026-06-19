import * as React from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem } from "vite_react_shadcn_ts";
export const Open = () => (
  <div className="bg-background text-foreground" style={{ minHeight: 440, padding: 24, display: "flex", justifyContent: "center" }}>
    <Select defaultValue="mixed" defaultOpen>
      <SelectTrigger style={{ width: 240 }}><SelectValue placeholder="Choose format" /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Format</SelectLabel>
          <SelectItem value="singles">Singles</SelectItem>
          <SelectItem value="doubles">Doubles</SelectItem>
          <SelectItem value="mixed">Mixed doubles</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
);
