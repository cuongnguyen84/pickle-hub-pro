import React from "react";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";
import { cn } from "@/lib/utils";
import { isIOS } from "@/lib/capacitor-utils";

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
  hideBottomNav?: boolean;
}

const MainLayout = ({ children, className, hideBottomNav = false }: MainLayoutProps) => {
  // Calculate bottom padding based on platform
  // iOS needs more space for safe area + nav bar
  const isIOSDevice = isIOS();
  const bottomPadding = isIOSDevice ? 'pb-24' : 'pb-20';

  return (
    <div className="min-h-screen min-h-[-webkit-fill-available] bg-background">
      <AppHeader />
      <main className={cn(bottomPadding, "md:pb-0", className)}>
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
};

export default MainLayout;
