import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12, maxWidth: 420 }}>{children}</div>
);
export const Default = () => (
  <Stage>
    <Tabs defaultValue="bracket">
      <TabsList>
        <TabsTrigger value="bracket">Bracket</TabsTrigger>
        <TabsTrigger value="schedule">Schedule</TabsTrigger>
        <TabsTrigger value="players">Players</TabsTrigger>
      </TabsList>
      <TabsContent value="bracket"><p className="text-muted-foreground" style={{ fontSize: 14 }}>Double-elimination bracket for 64 teams.</p></TabsContent>
      <TabsContent value="schedule"><p className="text-muted-foreground" style={{ fontSize: 14 }}>Matches run Sat–Sun, 8am start.</p></TabsContent>
      <TabsContent value="players"><p className="text-muted-foreground" style={{ fontSize: 14 }}>128 registered players.</p></TabsContent>
    </Tabs>
  </Stage>
);
