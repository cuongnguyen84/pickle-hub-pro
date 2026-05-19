import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

interface LivestreamGateOverlayProps {
  livestreamId: string;
}

export function LivestreamGateOverlay({ livestreamId }: LivestreamGateOverlayProps) {
  const { t } = useI18n();
  const redirectPath = `/livestream/${livestreamId}`;

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black/80 backdrop-blur-md">
      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
        <Lock className="w-8 h-8 text-primary" />
      </div>

      <div className="text-center space-y-2 px-6">
        <h3 className="text-lg font-semibold text-white">{t.live.previewEnded}</h3>
        <p className="text-sm text-white/70">{t.live.signupToWatch}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          asChild
          className="min-w-[160px]"
        >
          <a href={`/login?redirect=${encodeURIComponent(redirectPath)}`}>
            {t.live.loginToWatch}
          </a>
        </Button>
        <Button
          variant="outline"
          asChild
          className="min-w-[160px] border-white/30 text-white hover:bg-white/10 hover:text-white"
        >
          <a href={`/login?redirect=${encodeURIComponent(redirectPath)}&tab=signup`}>
            {t.live.createAccount}
          </a>
        </Button>
      </div>
    </div>
  );
}
