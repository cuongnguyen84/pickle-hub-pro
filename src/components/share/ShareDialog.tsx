import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { Share2, Copy, Check, Code, QrCode, Download } from "lucide-react";

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
  const [copied, setCopied] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const baseUrl = window.location.origin;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  // For social sharing, use edge function URL that returns proper OG tags
  // Social crawlers (Facebook, Twitter) don't run JS, so they need server-rendered OG tags
  const socialShareUrl = type === "live" 
    ? `${supabaseUrl}/functions/v1/og-live?id=${id}`
    : `${baseUrl}/video/${id}`;
  
  // Direct watch URL for QR codes and embed (these work without OG)
  const watchUrl = `${baseUrl}/${type === "live" ? "live" : "video"}/${id}`;
  const embedUrl = `${baseUrl}/embed/${type}/${id}`;

  const embedCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="100%"
  style="aspect-ratio: 16/9; border: none;"
  allow="autoplay; fullscreen"
  allowfullscreen
></iframe>`;

  const embedCodeNoTitle = `<iframe
  src="${embedUrl}?title=0"
  width="100%"
  height="100%"
  style="aspect-ratio: 16/9; border: none;"
  allow="autoplay; fullscreen"
  allowfullscreen
></iframe>`;

  // Generate QR code using a simple SVG approach
  useEffect(() => {
    const generateQR = async () => {
      // Using Google Charts API for QR code (simple, no dependency)
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(watchUrl)}&format=png`;
      setQrDataUrl(qrUrl);
    };
    generateQR();
  }, [watchUrl]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast({
        title: t.share.copied,
        description: t.share.copiedDesc,
      });
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      toast({
        title: t.errors.error,
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const downloadQR = () => {
    if (!qrDataUrl) return;
    
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: t.share.qrDownloaded,
      description: t.share.qrDownloadedDesc,
    });
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

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="link" className="gap-2">
              <Copy className="w-4 h-4" />
              Link
            </TabsTrigger>
            <TabsTrigger value="embed" className="gap-2">
              <Code className="w-4 h-4" />
              Embed
            </TabsTrigger>
            <TabsTrigger value="qr" className="gap-2">
              <QrCode className="w-4 h-4" />
              QR
            </TabsTrigger>
          </TabsList>

          {/* Link Tab */}
          <TabsContent value="link" className="space-y-4">
            <p className="text-sm text-foreground-secondary">
              {t.share.linkDesc}
            </p>
            
            {/* Social share URL - optimized for Facebook/Twitter */}
            {type === "live" && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground-muted">
                  {t.share.socialLink}
                </label>
                <div className="flex gap-2">
                  <Input
                    value={socialShareUrl}
                    readOnly
                    className="flex-1 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(socialShareUrl, "social")}
                  >
                    {copied === "social" ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-foreground-muted">
                  {t.share.socialLinkDesc}
                </p>
              </div>
            )}
            
            {/* Direct watch URL */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground-muted">
                {type === "live" ? t.share.directLink : "Link"}
              </label>
              <div className="flex gap-2">
                <Input
                  value={watchUrl}
                  readOnly
                  className="flex-1 text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(watchUrl, "link")}
                >
                  {copied === "link" ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Embed Tab */}
          <TabsContent value="embed" className="space-y-4">
            <p className="text-sm text-foreground-secondary">
              {t.share.embedDesc}
            </p>
            
            {/* With title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.share.withTitle}</label>
              <div className="flex gap-2">
                <textarea
                  value={embedCode}
                  readOnly
                  className="flex-1 text-xs font-mono bg-muted p-2 rounded-md resize-none h-24"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => copyToClipboard(embedCode, "embed")}
                >
                  {copied === "embed" ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Without title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.share.withoutTitle}</label>
              <div className="flex gap-2">
                <textarea
                  value={embedCodeNoTitle}
                  readOnly
                  className="flex-1 text-xs font-mono bg-muted p-2 rounded-md resize-none h-24"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => copyToClipboard(embedCodeNoTitle, "embedNoTitle")}
                >
                  {copied === "embedNoTitle" ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* QR Tab */}
          <TabsContent value="qr" className="space-y-4">
            <p className="text-sm text-foreground-secondary">
              {t.share.qrDesc}
            </p>
            <div className="flex flex-col items-center gap-4">
              {qrDataUrl && (
                <div className="bg-white p-4 rounded-lg">
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    className="w-48 h-48"
                  />
                </div>
              )}
              <Button
                variant="outline"
                className="gap-2"
                onClick={downloadQR}
              >
                <Download className="w-4 h-4" />
                {t.share.downloadQR}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
