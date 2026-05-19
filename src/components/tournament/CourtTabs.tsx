import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface CourtTabsProps<T extends { title?: string | null }> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  gridClassName?: string;
}

// Parse court number from title (e.g., "Court 1", "Sân 2", "Court A")
const parseCourtFromTitle = (title: string | null | undefined): string | null => {
  if (!title) return null;
  
  // Match patterns like "Court 1", "Sân 1", "Court A", "COURT 2", etc.
  const patterns = [
    /(?:court|sân)\s*(\d+|[a-z])/i,
    /(?:court|sân)\s*#?(\d+|[a-z])/i,
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].toUpperCase();
    }
  }
  
  return null;
};

export function CourtTabs<T extends { title?: string | null; id?: string }>({
  items,
  renderItem,
  gridClassName = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6",
}: CourtTabsProps<T>) {
  const { courts, hasCourts } = useMemo(() => {
    const courtMap = new Map<string, T[]>();
    
    items.forEach((item) => {
      const court = parseCourtFromTitle(item.title);
      if (court) {
        const existing = courtMap.get(court) || [];
        courtMap.set(court, [...existing, item]);
      }
    });
    
    // Sort courts numerically/alphabetically
    const sortedCourts = Array.from(courtMap.entries()).sort((a, b) => {
      const aNum = parseInt(a[0]);
      const bNum = parseInt(b[0]);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      return a[0].localeCompare(b[0]);
    });
    
    return {
      courts: sortedCourts,
      hasCourts: sortedCourts.length > 1,
    };
  }, [items]);

  const [activeTab, setActiveTab] = useState<string>("all");

  // If no court grouping found, render items normally
  if (!hasCourts) {
    return (
      <div className={gridClassName}>
        {items.map((item) => renderItem(item))}
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="mb-4 h-auto p-1 bg-background-surface flex-wrap">
        <TabsTrigger 
          value="all" 
          className="text-sm px-4"
        >
          Tất cả ({items.length})
        </TabsTrigger>
        {courts.map(([court, courtItems]) => (
          <TabsTrigger 
            key={court} 
            value={court}
            className="text-sm px-4"
          >
            Court {court} ({courtItems.length})
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="all" className="mt-0">
        <div className={gridClassName}>
          {items.map((item) => renderItem(item))}
        </div>
      </TabsContent>

      {courts.map(([court, courtItems]) => (
        <TabsContent key={court} value={court} className="mt-0">
          <div className={gridClassName}>
            {courtItems.map((item) => renderItem(item))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
