import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface AffiliateDisclosureProps {
  className?: string;
}

/**
 * Inline affiliate disclosure note. Drop at the top of any buying guide that
 * uses <AffiliateLink>. Required for FTC / Amazon Associates compliance.
 */
export function AffiliateDisclosure({ className }: AffiliateDisclosureProps) {
  const { language } = useI18n();
  const text =
    language === "vi"
      ? "Tiết lộ: Bài viết có thể chứa link affiliate. Nếu bạn mua hàng qua link, ThePickleHub có thể nhận hoa hồng — bạn không phải trả thêm đồng nào. Chúng tôi chỉ giới thiệu sản phẩm mình thực sự tin tưởng."
      : "Disclosure: This article may contain affiliate links. If you buy through them, ThePickleHub may earn a commission at no extra cost to you. We only recommend products we genuinely trust.";
  return (
    <p className={cn("my-4 border-l-2 border-border pl-3 text-xs italic text-muted-foreground", className)}>
      {text}
    </p>
  );
}
