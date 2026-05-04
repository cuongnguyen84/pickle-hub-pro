// ============================================================================
// ShareSheet — shared component
// Native Web Share API on mobile (navigator.share), copy-link fallback for
// desktop / browsers without native share. Toast confirms copy.
// ============================================================================

import { useState } from "react";
import { Share2, Link as LinkIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface ShareSheetProps {
  url: string;
  title?: string;
  text?: string;
}

export const ShareSheet = ({ url, title, text }: ShareSheetProps) => {
  const [copied, setCopied] = useState(false);

  const tryNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url, title, text });
        return true;
      } catch (e) {
        // User cancelled — silent
        if ((e as { name?: string }).name === "AbortError") return true;
        return false;
      }
    }
    return false;
  };

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback: select+copy
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast({ title: "Đã copy link", description: url });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Không copy được link",
        description: "Vui lòng copy thủ công từ thanh địa chỉ.",
        variant: "destructive",
      });
    }
  };

  const handleClick = async () => {
    const ok = await tryNativeShare();
    if (!ok) await copyLink();
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      className="gap-1"
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      <span>Share</span>
    </Button>
  );
};

export default ShareSheet;
