import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserDisplayNameProps {
  displayName: string;
  isCreator?: boolean;
  className?: string;
  badgeClassName?: string;
}

export function UserDisplayName({
  displayName,
  isCreator = false,
  className,
  badgeClassName,
}: UserDisplayNameProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="truncate">{displayName}</span>
      {isCreator && (
        <BadgeCheck
          className={cn(
            "h-4 w-4 text-primary shrink-0",
            badgeClassName
          )}
        />
      )}
    </span>
  );
}

export default UserDisplayName;
