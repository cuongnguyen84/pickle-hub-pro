import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface ImageLightboxProps {
  src: string | null;
  onClose: () => void;
}

const ImageLightbox = ({ src, onClose }: ImageLightboxProps) => {
  if (!src) return null;

  return (
    <Dialog open={!!src} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/95 border-none flex items-center justify-center">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-50 w-8 h-8 rounded-full bg-background/50 flex items-center justify-center text-foreground hover:bg-background/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <img
          src={src}
          alt=""
          className="max-w-full max-h-[85vh] object-contain rounded"
        />
      </DialogContent>
    </Dialog>
  );
};

export default ImageLightbox;
