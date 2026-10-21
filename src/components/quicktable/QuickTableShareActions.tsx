import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Same three actions on the chat success card and the tournament share box. */
export function QuickTableShareActions({
  url,
  title,
  message,
  copyLink,
  copyZalo,
  sendZalo,
  copied,
}: {
  url: string;
  title: string;
  message: string;
  copyLink: string;
  copyZalo: string;
  sendZalo: string;
  copied: string;
}) {
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(copied);
    } catch {
      /* clipboard blocked */
    }
  };
  const zalo = `https://sp.zalo.me/share?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Button type="button" variant="outline" onClick={() => void copy(url)} style={{ flex: 1, minHeight: 44 }}>
        <Copy className="w-4 h-4" /> {copyLink}
      </Button>
      <Button type="button" variant="outline" onClick={() => void copy(message)} style={{ flex: 1, minHeight: 44 }}>
        <Copy className="w-4 h-4" /> {copyZalo}
      </Button>
      <Button variant="outline" asChild style={{ flex: 1, minHeight: 44 }}>
        <a href={zalo} target="_blank" rel="noopener noreferrer">{sendZalo}</a>
      </Button>
    </div>
  );
}
