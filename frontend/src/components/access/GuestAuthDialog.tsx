import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin: () => void;
  onRegister: () => void;
}

/** Guest-only prompt: sign in or register. Never a subscription paywall. */
export function GuestAuthDialog({ open, onOpenChange, onLogin, onRegister }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <div
            className="mb-2 grid h-12 w-12 place-items-center rounded-full"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <LogIn size={22} />
          </div>
          <DialogTitle>
            {typeof window !== "undefined" && window.location.pathname.startsWith("/deals")
              ? t("guestAuth.dealsTitle")
              : t("guestAuth.title")}
          </DialogTitle>
          <DialogDescription>
            {typeof window !== "undefined" && window.location.pathname.startsWith("/deals")
              ? t("guestAuth.dealsDescription")
              : t("guestAuth.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button type="button" className="w-full" onClick={onLogin}>
            {t("guestAuth.login")}
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={onRegister}>
            {t("guestAuth.register")}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            {t("guestAuth.later")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function guestReturnPath(): string {
  if (typeof window === "undefined") return "/feed";
  const path = `${window.location.pathname}${window.location.search}`;
  if (!path.startsWith("/") || path.startsWith("/login") || path.startsWith("/register")) return "/feed";
  return path;
}
