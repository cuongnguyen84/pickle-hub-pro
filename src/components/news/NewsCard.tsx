import { ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useI18n } from "@/i18n";

interface NewsCardProps {
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
}

export function NewsCard({ title, summary, source, sourceUrl, publishedAt }: NewsCardProps) {
  const { language } = useI18n();
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "dd MMM yyyy", { locale: language === "vi" ? vi : undefined });
  };

  return (
    <article className="group p-4 bg-surface border border-border-subtle rounded-lg hover:bg-surface-elevated hover:border-border transition-all duration-200">
      <a 
        href={sourceUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="block"
      >
        <h3 className="font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-sm text-foreground-secondary line-clamp-3 mb-3">
          {summary}
        </p>
        <div className="flex items-center justify-between text-xs text-foreground-muted">
          <span className="flex items-center gap-1">
            {source}
            <ExternalLink className="w-3 h-3 opacity-50" />
          </span>
          <time dateTime={publishedAt}>{formatDate(publishedAt)}</time>
        </div>
      </a>
    </article>
  );
}
