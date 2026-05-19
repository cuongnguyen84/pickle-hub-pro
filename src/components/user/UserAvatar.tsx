import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  isCreator?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  showBadge?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-20 w-20",
};

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-10 w-10",
};

const badgeSizes = {
  sm: "h-3 w-3 -right-0.5 -bottom-0.5",
  md: "h-4 w-4 -right-0.5 -bottom-0.5",
  lg: "h-5 w-5 -right-1 -bottom-1",
  xl: "h-6 w-6 -right-1 -bottom-1",
};

export function UserAvatar({
  avatarUrl,
  displayName,
  isCreator = false,
  size = "md",
  showBadge = true,
  className,
}: UserAvatarProps) {
  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : "U";

  return (
    <div className={cn("relative inline-block", className)}>
      <Avatar className={cn(sizeClasses[size])}>
        <AvatarImage src={avatarUrl || undefined} alt={displayName || "User"} />
        <AvatarFallback className="bg-primary/20 text-primary">
          {avatarUrl ? initials : <User className={iconSizes[size]} />}
        </AvatarFallback>
      </Avatar>
      
      {/* Creator Badge */}
      {showBadge && isCreator && (
        <div
          className={cn(
            "absolute bg-primary rounded-full p-0.5 border-2 border-background",
            badgeSizes[size]
          )}
        >
          <BadgeCheck className="h-full w-full text-primary-foreground" />
        </div>
      )}
    </div>
  );
}

export default UserAvatar;
