import { useState } from "react";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ForumImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

const ForumImageUpload = ({ images, onChange, maxImages = 4 }: ForumImageUploadProps) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !user) return;
    const files = Array.from(e.target.files);
    const remaining = maxImages - images.length;
    if (files.length > remaining) {
      toast({ title: t.forum.maxImages, variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of files.slice(0, remaining)) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error } = await supabase.storage
          .from("forum-images")
          .upload(path, file, { upsert: false });
        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from("forum-images")
          .getPublicUrl(path);
        newUrls.push(urlData.publicUrl);
      }
      onChange([...images, ...newUrls]);
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length < maxImages && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          className="gap-1.5"
          asChild
        >
          <label className="cursor-pointer">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            {t.forum.attachImages} ({images.length}/{maxImages})
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
          </label>
        </Button>
      )}
    </div>
  );
};

export default ForumImageUpload;
