import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Logged-in user without SMS: never a subscription paywall. */
export function PhoneVerifyDialog({ open, onOpenChange, onConfirm }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <div
            className="mb-2 grid h-12 w-12 place-items-center rounded-full"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <Smartphone size={22} />
          </div>
          <DialogTitle>{t("phoneVerify.title")}</DialogTitle>
          <DialogDescription>{t("phoneVerify.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button type="button" className="w-full" onClick={onConfirm}>
            {t("phoneVerify.confirm")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            {t("phoneVerify.later")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
