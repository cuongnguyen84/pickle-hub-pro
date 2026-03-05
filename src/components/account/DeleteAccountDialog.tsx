import { useState } from "react";
import { useI18n } from "@/i18n";
import { useDeleteAccount } from "@/hooks/useDeleteAccount";
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
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

export function DeleteAccountDialog() {
  const { t } = useI18n();
  const deleteAccount = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const confirmWord = "DELETE";

  const handleDelete = () => {
    if (confirmText !== confirmWord) return;
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
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={confirmText !== confirmWord || deleteAccount.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAccount.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t.account.deleteAccountConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
