import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Flag, Loader2 } from "lucide-react";

interface ReportDialogProps {
  contentType: "livestream" | "tournament" | "profile" | "forum_post";
  contentId: string;
  contentTitle?: string;
  trigger?: React.ReactNode;
}

const REPORT_REASONS = {
  vi: [
    "Nội dung không phù hợp",
    "Spam hoặc quảng cáo",
    "Thông tin sai lệch",
    "Vi phạm bản quyền",
    "Khác",
  ],
  en: [
    "Inappropriate content",
    "Spam or advertising",
    "Misleading information",
    "Copyright violation",
    "Other",
  ],
};

export function ReportDialog({ contentType, contentId, contentTitle, trigger }: ReportDialogProps) {
  const { user } = useAuth();
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reasons = REPORT_REASONS[language] || REPORT_REASONS.en;

  const handleSubmit = async () => {
    if (!user || !selectedReason) return;

    setIsSubmitting(true);
    try {
      const reason = selectedReason === "Khác" || selectedReason === "Other"
        ? `${selectedReason}: ${additionalInfo}`
        : selectedReason;

      const { error } = await supabase.from("content_reports" as any).insert({
        reporter_user_id: user.id,
        content_type: contentType,
        content_id: contentId,
        reason,
      } as any);

      if (error) {
        if (error.code === "23505") {
          toast({ title: t.report.alreadyReported, variant: "destructive" });
        } else {
          throw error;
        }
      } else {
        toast({ title: t.report.success });
      }
      setOpen(false);
      setSelectedReason("");
      setAdditionalInfo("");
    } catch {
      toast({ title: t.report.error, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className="text-foreground-muted hover:text-destructive"
        >
          <Flag className="w-4 h-4 mr-1" />
          {t.report.report}
        </Button>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.report.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.report.description}
              {contentTitle && (
                <span className="block mt-1 font-medium text-foreground">
                  "{contentTitle}"
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {reasons.map((reason) => (
                <div key={reason} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason} id={reason} />
                  <Label htmlFor={reason} className="cursor-pointer">{reason}</Label>
                </div>
              ))}
            </RadioGroup>

            {(selectedReason === "Khác" || selectedReason === "Other") && (
              <Textarea
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder={t.report.additionalInfo}
                maxLength={300}
                rows={3}
              />
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit}
              disabled={!selectedReason || isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t.report.submit}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
