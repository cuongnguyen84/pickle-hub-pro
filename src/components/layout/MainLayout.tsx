import React, { useRef } from "react";
import AppHeader from "./AppHeader";
import { cn } from "@/lib/utils";
import { isIOS, isNativeApp, isAndroid } from "@/lib/capacitor-utils";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
}

const MainLayout = ({ children, className }: MainLayoutProps) => {
  const isIOSDevice = isIOS();
  const isAndroidDevice = isAndroid();
  const isNative = isNativeApp();
  const mainRef = useRef<HTMLElement>(null);
  const { isActive, indicatorWidth, indicatorSide, indicatorOpacity, isThresholdMet } = useSwipeNavigation(mainRef);
  
  const bottomPadding = (isAndroidDevice && isNative) 
    ? 'pb-28' 
    : (isIOSDevice ? 'pb-24' : 'pb-20');

  return (
    <div className="h-full flex flex-col w-full max-w-[100vw] overflow-hidden bg-background">
      <AppHeader />
      <main
        ref={mainRef}
        className={cn("flex-1 overflow-y-auto overflow-x-hidden -webkit-overflow-scrolling-touch w-full max-w-[100vw] relative", bottomPadding, "md:pb-0", className)}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
        {isActive && (
          <div
            className={cn(
              "fixed top-1/2 -translate-y-1/2 z-50 flex items-center justify-center pointer-events-none transition-colors",
              indicatorSide === "left" ? "left-0 rounded-r-full" : "right-0 rounded-l-full",
              isThresholdMet ? "bg-primary/90" : "bg-muted/70"
            )}
            style={{
              width: `${indicatorWidth}px`,
              height: "48px",
              opacity: indicatorOpacity,
            }}
          >
            {indicatorWidth > 20 && (
              indicatorSide === "left"
                ? <ChevronLeft className="h-5 w-5 text-primary-foreground" />
                : <ChevronRight className="h-5 w-5 text-primary-foreground" />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default MainLayout;
