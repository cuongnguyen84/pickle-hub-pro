import { ShieldX } from "lucide-react";
import { useI18n } from "@/i18n";

export const GeoBlockOverlay = () => {
  const { t } = useI18n();

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 text-white text-center p-6">
      <ShieldX className="w-16 h-16 mb-4 text-destructive" />
      <h2 className="text-xl font-semibold mb-2">{t.geoBlock.title}</h2>
      <p className="text-white/70 max-w-md">{t.geoBlock.description}</p>
    </div>
  );
};
