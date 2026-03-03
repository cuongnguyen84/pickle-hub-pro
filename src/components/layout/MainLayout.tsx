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
    <div className="min-h-screen min-h-[-webkit-fill-available] bg-background flex flex-col">
      <AppHeader />
      <main className={cn("flex-1", bottomPadding, "md:pb-0", className)}>
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
