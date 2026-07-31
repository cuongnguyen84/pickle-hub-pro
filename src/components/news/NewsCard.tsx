import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useI18n } from "@/i18n";
import { Link } from "react-router-dom";

interface NewsCardProps {
  title: string;
  summary: string;
  source: string;
  slug: string;
  language: "en" | "vi";
  publishedAt: string;
}

export function NewsCard({ title, summary, source, slug, language: itemLanguage, publishedAt }: NewsCardProps) {
  const { language } = useI18n();
  const href = itemLanguage === "vi" ? `/vi/news/${slug}` : `/news/${slug}`;
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "dd MMM yyyy", { locale: language === "vi" ? vi : undefined });
  };

  return (
    <article className="group glass-card p-4">
      <Link to={href} className="block">
        <h3 className="font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-sm text-foreground-secondary line-clamp-3 mb-3">
          {summary}
        </p>
        <div className="flex items-center justify-between text-xs text-foreground-muted">
          <span>{source}</span>
          <time dateTime={publishedAt}>{formatDate(publishedAt)}</time>
        </div>
      </Link>
    </article>
  );
}
