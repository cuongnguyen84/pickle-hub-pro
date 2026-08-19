// ============================================================================
// Closing an account — and the one case where we cannot do it for you (B12)
// ----------------------------------------------------------------------------
// A shop owner's account cannot be deleted: shops.owner_user_id is ON DELETE
// RESTRICT, so the attempt fails at the last step with a message written for a
// server fault. Letting them type DELETE and then handing them that is a small
// cruelty, so the dialog asks first and explains instead.
//
// This is NOT the control. delete-account refuses a shop owner on the server,
// before it touches anything — a locked screen is a courtesy, and a request
// that never renders it must meet the same answer. What this component owes
// the person is the sentence the server cannot deliver well: what is in the
// way, and what to do about it.
//
// It also does not claim to have sent anything. Opening a mail client is not
// the same as a request arriving, and saying otherwise would leave someone
// waiting for a reply to a message they never sent.
// ============================================================================

import { useState } from "react";
import { useI18n } from "@/i18n";
import { useDeleteAccount } from "@/hooks/useDeleteAccount";
import { useMyShop } from "@/hooks/shop/useSellerApplication";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, AlertTriangle, Mail, Store } from "lucide-react";

const SUPPORT_EMAIL = "tapickleballvn@gmail.com";

export function DeleteAccountDialog() {
  const { t } = useI18n();
  const deleteAccount = useDeleteAccount();
  const myShop = useMyShop();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const confirmWord = "DELETE";
  // Ownership, not membership: a manager on somebody else's shop owns nothing
  // and keeps the ordinary flow. useMyShop already asks exactly that question
  // (owner_user_id = me), so the two paths cannot drift apart.
  const ownsShop = !!myShop.data;

  const handleDelete = () => {
    if (confirmText !== confirmWord || ownsShop) return;
    deleteAccount.mutate();
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="w-full"
        variant="outline"
      >
        <Trash2 className="w-4 h-4 mr-2 text-destructive" />
        <span className="text-destructive">{t.account.deleteAccount}</span>
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <AlertDialogTitle>{t.account.deleteAccountTitle}</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-3">
              {ownsShop ? (
                <>
                  <p className="flex items-start gap-2">
                    <Store className="w-4 h-4 mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
                    <span>{t.account.deleteBlockedShopOwner}</span>
                  </p>
                  <p className="text-sm">{t.account.deleteBlockedShopOwnerWhy}</p>
                  {/* A link, not a submit. Nothing here claims a request was
                      sent — opening a mail client is not sending anything. */}
                  <p className="text-sm">{t.account.deleteBlockedShopOwnerNoAutoSend}</p>
                </>
              ) : (
                <>
                  <p>{t.account.deleteAccountWarning}</p>
                  <ul className="list-disc list-inside text-sm space-y-1 text-foreground-muted">
                    <li>{t.account.deleteDataProfile}</li>
                    <li>{t.account.deleteDataTournaments}</li>
                    <li>{t.account.deleteDataContent}</li>
                  </ul>
                  <p className="font-medium text-destructive">{t.account.deleteAccountIrreversible}</p>
                  <p className="text-sm">
                    {t.account.deleteConfirmInstruction.replace("{word}", confirmWord)}
                  </p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={confirmWord}
                    className="mt-2"
                  />
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>
              {ownsShop ? t.account.deleteBlockedShopOwnerBack : t.common.cancel}
            </AlertDialogCancel>
            {ownsShop ? (
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t.account.deleteBlockedShopOwnerEmailSubject)}`}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                {t.account.deleteBlockedShopOwnerCta}
              </a>
            ) : (
              <AlertDialogAction
                onClick={handleDelete}
                disabled={confirmText !== confirmWord || deleteAccount.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteAccount.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t.account.deleteAccountConfirm}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
