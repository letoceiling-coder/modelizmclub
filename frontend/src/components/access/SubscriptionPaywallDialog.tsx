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
import type { FeedGuestAccessConfig } from "@/lib/api/feed-guest-access";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: FeedGuestAccessConfig | null;
  actionKey: string | null;
  onPrimary: () => void;
}

export function SubscriptionPaywallDialog({ open, onOpenChange, config, onPrimary }: Props) {
  const popup = config?.popup;

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
          <DialogTitle>{popup?.title ?? "Нужна подписка"}</DialogTitle>
          <DialogDescription>
            {popup?.description ?? "Войдите и оформите подписку, чтобы пользоваться этой функцией."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {popup?.secondary_cta ?? "Позже"}
          </Button>
          <Button type="button" onClick={onPrimary}>
            {popup?.primary_cta ?? "Оформить подписку"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
