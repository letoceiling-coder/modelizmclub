import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrimary: () => void;
  title?: string;
  description?: string;
  primaryCta?: string;
}

/** Signed-in user without a subscription: never auth or phone copy. */
export function SubscriptionPaywallDialog({
  open,
  onOpenChange,
  onPrimary,
  title,
  description,
  primaryCta,
}: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <div
            className="mb-2 grid h-12 w-12 place-items-center rounded-full"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <Crown size={22} />
          </div>
          <DialogTitle>{title?.trim() || t("subscriptionPaywall.title")}</DialogTitle>
          <DialogDescription>
            {description?.trim() || t("subscriptionPaywall.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button type="button" className="w-full" onClick={onPrimary}>
            {primaryCta?.trim() || t("subscriptionPaywall.confirm")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            {t("subscriptionPaywall.later")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
