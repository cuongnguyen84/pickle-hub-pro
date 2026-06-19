import * as React from "react";
import { ToastProvider, Toast, ToastTitle, ToastDescription, ToastAction, ToastClose, ToastViewport } from "vite_react_shadcn_ts";
export const Success = () => (
  <div className="bg-background text-foreground" style={{ minHeight: 320, position: "relative" }}>
    <ToastProvider>
      <Toast open>
        <div style={{ display: "grid", gap: 4 }}>
          <ToastTitle>Registration confirmed</ToastTitle>
          <ToastDescription>You're in for Summer Slam 2026.</ToastDescription>
        </div>
        <ToastAction altText="View">View</ToastAction>
        <ToastClose />
      </Toast>
      <ToastViewport />
    </ToastProvider>
  </div>
);
