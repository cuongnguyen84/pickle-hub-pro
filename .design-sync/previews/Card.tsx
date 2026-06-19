import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge } from "vite_react_shadcn_ts";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12 }}>{children}</div>
);

export const TournamentCard = () => (
  <Stage>
    <Card style={{ maxWidth: 360 }}>
      <CardHeader>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <CardTitle>Summer Slam 2026</CardTitle>
          <Badge>LIVE</Badge>
        </div>
        <CardDescription>Outdoor · Mixed Doubles · 4.0–4.5</CardDescription>
      </CardHeader>
      <CardContent>
        <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }} className="text-muted-foreground">
          64 teams · Double elimination · Prize pool $2,400. Courts open at 8am.
        </p>
      </CardContent>
      <CardFooter style={{ gap: 12 }}>
        <Button>Register</Button>
        <Button variant="outline">Details</Button>
      </CardFooter>
    </Card>
  </Stage>
);
