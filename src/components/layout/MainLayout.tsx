import React from "react";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
  hideBottomNav?: boolean;
}

const MainLayout = ({ children, className, hideBottomNav = false }: MainLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className={cn("pb-20 md:pb-0", className)}>
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
};

export default MainLayout;
