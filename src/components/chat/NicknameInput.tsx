import { useState, useEffect } from "react";
import { Edit3, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

interface NicknameInputProps {
  onNicknameUpdate?: () => void;
}

export function NicknameInput({ onNicknameUpdate }: NicknameInputProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const [currentNickname, setCurrentNickname] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [nextEditDate, setNextEditDate] = useState<Date | null>(null);

  // Fetch current nickname and check if can edit
  useEffect(() => {
    if (!user?.id) return;

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, display_name_updated_at")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setCurrentNickname(data.display_name);
        setNickname(data.display_name || "");
        
        // Check if 7 days have passed since last update
        if (data.display_name_updated_at) {
          const lastUpdate = new Date(data.display_name_updated_at);
          const nextAllowed = new Date(lastUpdate);
          nextAllowed.setDate(nextAllowed.getDate() + 7);
          
          if (new Date() < nextAllowed) {
            setCanEdit(false);
            setNextEditDate(nextAllowed);
          }
        }
      }
    };

    fetchProfile();
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id || !nickname.trim()) return;
    
    // Validate nickname length
    if (nickname.trim().length < 2 || nickname.trim().length > 30) {
      toast({
        title: t.chat.nicknameError || "Nickname error",
        description: t.chat.nicknameLengthError || "Nickname must be 2-30 characters",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: nickname.trim(),
        display_name_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setIsLoading(false);

    if (error) {
      toast({
        title: t.common.error,
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setCurrentNickname(nickname.trim());
    setIsEditing(false);
    setCanEdit(false);
    const nextAllowed = new Date();
    nextAllowed.setDate(nextAllowed.getDate() + 7);
    setNextEditDate(nextAllowed);
    
    toast({
      title: t.chat.nicknameUpdated || "Nickname updated",
    });
    
    onNicknameUpdate?.();
  };

  const handleCancel = () => {
    setNickname(currentNickname || "");
    setIsEditing(false);
  };

  if (!user) return null;

  // Show current nickname with edit button (if can edit)
  if (!isEditing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm border-b border-border">
        <span className="text-foreground-muted text-xs">
          {t.chat.nickname || "Nickname"}:
        </span>
        <span className="font-medium text-foreground truncate flex-1">
          {currentNickname || user.email?.split("@")[0]}
        </span>
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsEditing(true)}
          >
            <Edit3 className="h-3 w-3" />
          </Button>
        ) : nextEditDate && (
          <span className="text-[10px] text-foreground-muted">
            {t.chat.nextEdit || "Next edit"}: {nextEditDate.toLocaleDateString()}
          </span>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
      <Input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder={t.chat.nicknamePlaceholder || "Enter nickname"}
        className="h-7 text-sm flex-1"
        maxLength={30}
        autoFocus
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={handleSave}
        disabled={isLoading || !nickname.trim()}
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Check className="h-3 w-3 text-green-500" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={handleCancel}
        disabled={isLoading}
      >
        <X className="h-3 w-3 text-destructive" />
      </Button>
    </div>
  );
}
