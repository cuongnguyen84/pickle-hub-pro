import React from "react";
import AppHeader from "./AppHeader";
import { cn } from "@/lib/utils";
import { isIOS, isNativeApp, isAndroid } from "@/lib/capacitor-utils";

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
}

const MainLayout = ({ children, className }: MainLayoutProps) => {
  const isIOSDevice = isIOS();
  const isAndroidDevice = isAndroid();
  const isNative = isNativeApp();
  
  const bottomPadding = (isAndroidDevice && isNative) 
    ? 'pb-28' 
    : (isIOSDevice ? 'pb-24' : 'pb-20');

  return (
    <div className="h-full flex flex-col w-full max-w-[100vw] overflow-hidden bg-background">
      <AppHeader />
      <main className={cn("flex-1 overflow-y-auto overflow-x-hidden -webkit-overflow-scrolling-touch w-full max-w-[100vw]", bottomPadding, "md:pb-0", className)} style={{ WebkitOverflowScrolling: 'touch' }}>
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
