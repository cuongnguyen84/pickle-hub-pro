import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";

interface LoadMoreButtonProps {
  onClick: () => void;
  isLoading: boolean;
  hasMore: boolean;
}

export const LoadMoreButton = ({ onClick, isLoading, hasMore }: LoadMoreButtonProps) => {
  const { t } = useI18n();

  if (!hasMore) return null;

  return (
    <div className="flex justify-center pt-6">
      <Button
        variant="outline"
        onClick={onClick}
        disabled={isLoading}
        className="min-w-[160px]"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : null}
        {isLoading ? t.common.loading : t.common.loadMore}
      </Button>
    </div>
  );
};
