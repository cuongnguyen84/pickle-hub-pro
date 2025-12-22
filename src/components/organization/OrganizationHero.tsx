import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useI18n } from "@/i18n";
import { Building2, Share2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "react-router-dom";
import { FollowButton } from "@/components/follow";
import { useFollowCount } from "@/hooks/useFollowData";

interface OrganizationHeroProps {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
}

export const OrganizationHero = ({
  id,
  name,
  slug,
  description,
  logoUrl,
}: OrganizationHeroProps) => {
  const { t } = useI18n();
  const { data: followCount } = useFollowCount("organization", id);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success(t.common.copied);
  };

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />

      <div className="container-wide relative">
        {/* Breadcrumb */}
        <Breadcrumb className="pt-6 pb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  to="/"
                  className="text-foreground-muted hover:text-foreground transition-colors"
                >
                  {t.nav.home}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-foreground font-medium">
                {name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Hero content */}
        <div className="pb-8 pt-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            {/* Left: Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4 mb-4">
                <Avatar className="w-16 h-16 md:w-20 md:h-20 border-2 border-primary/20">
                  <AvatarImage src={logoUrl ?? undefined} alt={name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg md:text-xl font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Badge
                    variant="outline"
                    className="mb-2 text-foreground-muted"
                  >
                    <Building2 className="w-3 h-3 mr-1" />
                    {t.organization.title}
                  </Badge>
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
                    {name}
                  </h1>
                </div>
              </div>

              {/* Follower count */}
              {followCount !== undefined && followCount > 0 && (
                <div className="flex items-center gap-2 text-foreground-secondary mb-4">
                  <Users className="w-4 h-4" />
                  <span className="text-sm md:text-base">
                    {followCount.toLocaleString()} {t.follow.following.toLowerCase()}
                  </span>
                </div>
              )}

              {description && (
                <p className="text-foreground-muted max-w-2xl line-clamp-3">
                  {description}
                </p>
              )}

              {!description && (
                <p className="text-foreground-muted italic">
                  {t.organization.noDescription}
                </p>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="gap-2"
              >
                <Share2 className="w-4 h-4" />
                {t.common.share}
              </Button>
              <FollowButton targetType="organization" targetId={id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
