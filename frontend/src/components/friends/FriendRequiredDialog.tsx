import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
  adding?: boolean;
}

/** Chat is limited to friends — prompt to send a request instead of opening a dialog. */
export function FriendRequiredDialog({ open, onOpenChange, onAdd, adding = false }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <div
            className="mb-2 grid h-12 w-12 place-items-center rounded-full"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <UserPlus size={22} />
          </div>
          <DialogTitle>{t("pages.friends.writeNeedFriendTitle")}</DialogTitle>
          <DialogDescription>{t("pages.friends.writeNeedFriendDesc")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button type="button" className="w-full" loading={adding} onClick={onAdd}>
            <UserPlus size={16} /> {t("pages.friends.writeNeedFriendAdd")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            {t("pages.friends.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
