import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface SectionHeaderProps {
  title: string;
  href?: string;
  className?: string;
}

const SectionHeader = ({ title, href, className }: SectionHeaderProps) => {
  const { t } = useI18n();

  return (
    <div className={cn("flex items-center justify-between mb-6", className)}>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>

      {href && (
        <Link
          to={href}
          className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover transition-colors duration-200"
        >
          <span>{t.common.viewAll}</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
};

export default SectionHeader;
