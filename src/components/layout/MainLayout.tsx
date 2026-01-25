import React from "react";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";
import { cn } from "@/lib/utils";
import { isIOS, isNativeApp, isAndroid } from "@/lib/capacitor-utils";

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
  hideBottomNav?: boolean;
}

const MainLayout = ({ children, className, hideBottomNav = false }: MainLayoutProps) => {
  // Calculate bottom padding based on platform
  // Android native needs more space to avoid overlapping with system navigation
  const isIOSDevice = isIOS();
  const isAndroidDevice = isAndroid();
  const isNative = isNativeApp();
  
  // Android native app needs more bottom padding (72px nav + 16px safe area)
  const bottomPadding = (isAndroidDevice && isNative) 
    ? 'pb-28' 
    : (isIOSDevice ? 'pb-24' : 'pb-20');

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
