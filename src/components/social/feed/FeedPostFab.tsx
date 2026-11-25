import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { isIOS } from "@/lib/platform";
import { type Language } from "@/lib/social/feed-formatters";
import FeedComposer from "./FeedComposer";

/**
 * Floating "new post" button for the feed (UGC v1, shown to signed-in
 * users by the caller in Feed.tsx; guests never mount it). Replaces
 * the fixed composer block that used to
 * sit at the top of the stream: the button stays reachable at any
 * scroll depth and opens the same FeedComposer inside a bottom sheet.
 *
 * Stacking: the AI assistant FAB (AssistantGate) already floats at the
 * bottom right - mobile bottom = nav height (56px, iOS 68px) + 12px,
 * height 44px; desktop bottom-6, height 48px, both at z-index 9990
 * (under BottomNav's 9999). This button parks directly above it with
 * a 12px gap in the same layer, so the two never overlap; on mobile
 * both stay above the bottom navigation bar.
 *
 * Loaded lazily from Feed.tsx together with the composer and the
 * sheet, so none of this reaches the feed's initial chunk.
 */
export default function FeedPostFab({ language }: { language: Language }) {
  const [open, setOpen] = useState(false);
  const vi = language === "vi";
  const bottom = isIOS()
    ? "calc(68px + env(safe-area-inset-bottom, 0px) + 12px + 44px + 12px)"
    : "calc(56px + 12px + 44px + 12px)";

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={vi ? "Đăng bài bằng ảnh" : "Post with a photo"}
        className="fixed right-4 bottom-[var(--postfab-b)] z-[9990] h-11 rounded-full px-4 shadow-lg md:right-6 md:bottom-[84px] md:h-12"
        style={{ ["--postfab-b" as string]: bottom }}
      >
        <ImagePlus className="h-5 w-5" aria-hidden />
        {vi ? "Đăng bài" : "New post"}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="z-[10001] max-h-[88dvh] overflow-y-auto rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <div style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
            <SheetHeader>
              <SheetTitle>
                {vi ? "Đăng bài bằng ảnh" : "Post with a photo"}
              </SheetTitle>
              <SheetDescription>
                {vi
                  ? "Chọn một ảnh, viết vài dòng nếu muốn, rồi bấm Đăng bài."
                  : "Choose a photo, add a few lines if you like, then press Post."}
              </SheetDescription>
            </SheetHeader>
            <div style={{ marginTop: 16 }}>
              <FeedComposer
                language={language}
                variant="sheet"
                onPosted={() => setOpen(false)}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
