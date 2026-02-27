import { useForumCategories } from "@/hooks/useForumCategories";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ForumCategoryNavProps {
  activeSlug?: string;
  onSelect: (slug: string | undefined) => void;
}

const ForumCategoryNav = ({ activeSlug, onSelect }: ForumCategoryNavProps) => {
  const { t } = useI18n();
  const { data: categories = [] } = useForumCategories();

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-2 pb-2">
        <button
          onClick={() => onSelect(undefined)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
            !activeSlug
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground-secondary hover:text-foreground hover:bg-muted/80"
          )}
        >
          {t.forum.allCategories}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.slug)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
              activeSlug === cat.slug
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground-secondary hover:text-foreground hover:bg-muted/80"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

export default ForumCategoryNav;
