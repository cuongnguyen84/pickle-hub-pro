import * as React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12 }}>{children}</div>
);
export const Group = () => (
  <Stage>
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Avatar><AvatarImage src="https://i.pravatar.cc/80?img=12" alt="CN" /><AvatarFallback>CN</AvatarFallback></Avatar>
      <Avatar><AvatarImage src="https://i.pravatar.cc/80?img=24" alt="TL" /><AvatarFallback>TL</AvatarFallback></Avatar>
      <Avatar><AvatarFallback>QP</AvatarFallback></Avatar>
    </div>
  </Stage>
);
