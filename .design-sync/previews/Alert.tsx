import * as React from "react";
import { Alert, AlertTitle, AlertDescription } from "vite_react_shadcn_ts";

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12 }}>{children}</div>
);

export const Default = () => (
  <Stage>
    <Alert>
      <AlertTitle>Registration open</AlertTitle>
      <AlertDescription>The Summer Slam bracket closes Friday at 6pm. Secure your spot now.</AlertDescription>
    </Alert>
  </Stage>
);

export const Destructive = () => (
  <Stage>
    <Alert variant="destructive">
      <AlertTitle>Payment failed</AlertTitle>
      <AlertDescription>We couldn't process your entry fee. Please update your payment method.</AlertDescription>
    </Alert>
  </Stage>
);
