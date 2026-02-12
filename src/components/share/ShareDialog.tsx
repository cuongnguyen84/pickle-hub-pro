import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { Share2, Copy, Check } from "lucide-react";

interface ShareDialogProps {
  type: "live" | "video";
  id: string;
  title: string;
  thumbnail?: string;
  children?: React.ReactNode;
}

export const ShareDialog = ({ type, id, title, thumbnail, children }: ShareDialogProps) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Use clean domain URL - _redirects proxies to edge functions for OG tags
  const shareUrl = type === "live"
    ? `https://thepicklehub.net/share/live/${id}`
    : `https://thepicklehub.net/share/video/${id}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: t.share.copied,
        description: t.share.copiedDesc,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: t.errors.error,
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="w-4 h-4" />
            {t.share.share}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.share.shareTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-foreground-secondary">
            {t.share.linkDesc}
          </p>
          
          <Button
            onClick={copyToClipboard}
            className="w-full gap-2"
            variant={copied ? "outline" : "default"}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-success" />
                {t.share.copied}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                {t.share.directLink}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
