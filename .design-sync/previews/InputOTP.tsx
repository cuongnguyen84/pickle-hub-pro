import * as React from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "vite_react_shadcn_ts";
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12 }}>{children}</div>
);
export const SixDigit = () => (
  <Stage>
    <InputOTP maxLength={6} value="284">
      <InputOTPGroup>
        <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  </Stage>
);
