import * as React from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption, Badge } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12 }}>{children}</div>
);
const rows = [
  { rank: 1, team: "Nguyen / Tran", w: 12, l: 1, status: "default" },
  { rank: 2, team: "Pham / Le", w: 11, l: 2, status: "default" },
  { rank: 3, team: "Vo / Dang", w: 9, l: 4, status: "secondary" },
];
export const Standings = () => (
  <Stage>
    <Table>
      <TableCaption>Mixed Doubles · Pool A standings</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead style={{ width: 48 }}>#</TableHead>
          <TableHead>Team</TableHead>
          <TableHead>W</TableHead>
          <TableHead>L</TableHead>
          <TableHead>Seed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.rank}>
            <TableCell style={{ fontWeight: 600 }}>{r.rank}</TableCell>
            <TableCell>{r.team}</TableCell>
            <TableCell>{r.w}</TableCell>
            <TableCell>{r.l}</TableCell>
            <TableCell><Badge variant={r.status as "default" | "secondary"}>{r.status === "default" ? "Qualified" : "Bubble"}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Stage>
);
