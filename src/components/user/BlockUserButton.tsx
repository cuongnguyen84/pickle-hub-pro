import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Ban } from "lucide-react";

interface BlockUserButtonProps {
  targetUserId: string;
  targetDisplayName?: string;
  variant?: "icon" | "full";
}

export function BlockUserButton({ targetUserId, targetDisplayName, variant = "icon" }: BlockUserButtonProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Don't show for own profile or unauthenticated
  if (!user || user.id === targetUserId) return null;

  const { data: isBlocked = false } = useQuery({
    queryKey: ["blocked-user", user.id, targetUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from("blocked_users")
        .select("id")
        .eq("blocker_user_id", user!.id)
        .eq("blocked_user_id", targetUserId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const toggleBlock = useMutation({
    mutationFn: async () => {
      if (isBlocked) {
        await supabase
          .from("blocked_users")
          .delete()
          .eq("blocker_user_id", user!.id)
          .eq("blocked_user_id", targetUserId);
      } else {
        await supabase
          .from("blocked_users")
          .insert({ blocker_user_id: user!.id, blocked_user_id: targetUserId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-user", user!.id, targetUserId] });
      toast({
        title: isBlocked ? t.moderation.unblocked : t.moderation.blocked,
        description: isBlocked
          ? t.moderation.unblockedDesc.replace("{name}", targetDisplayName || "")
          : t.moderation.blockedDesc.replace("{name}", targetDisplayName || ""),
      });
      setOpen(false);
    },
    onError: () => {
      toast({ title: t.common.error, variant: "destructive" });
    },
  });

  return (
    <>
      {variant === "icon" ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-foreground-muted hover:text-destructive"
          onClick={() => setOpen(true)}
          title={isBlocked ? t.moderation.unblock : t.moderation.block}
        >
          <Ban className="w-4 h-4" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className={isBlocked ? "" : "text-destructive hover:text-destructive"}
          onClick={() => setOpen(true)}
        >
          <Ban className="w-4 h-4 mr-2" />
          {isBlocked ? t.moderation.unblock : t.moderation.block}
        </Button>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isBlocked ? t.moderation.unblock : t.moderation.block} {targetDisplayName}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBlocked ? t.moderation.unblockConfirm : t.moderation.blockConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toggleBlock.mutate()}
              className={isBlocked ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
            >
              {isBlocked ? t.moderation.unblock : t.moderation.block}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
