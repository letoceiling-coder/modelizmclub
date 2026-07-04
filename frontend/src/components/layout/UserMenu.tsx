import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { User, ClipboardList, Crown, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useStore, selectors } from "@/lib/store";
import { signOut } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function UserMenu() {
  const me = useStore(selectors.currentUser);
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  const hasAvatar = Boolean(me.avatar && me.avatar.trim());

  const handleSignOut = () => {
    void signOut().then(() => {
      window.location.href = "/login";
    });
  };

  return (
    <div onMouseEnter={() => { cancelClose(); setOpen(true); }} onMouseLeave={scheduleClose}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("nav.profile")}
            className="grid place-items-center rounded-full outline-none transition-colors"
            style={{ width: 40, height: 40 }}
          >
            <Avatar className="h-9 w-9">
              {hasAvatar && <AvatarImage src={me.avatar} alt="" className="object-cover" />}
              <AvatarFallback
                className="text-[13px] font-bold"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {initials(me.name)}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-56"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <DropdownMenuItem asChild>
            <Link to={ROUTES.profile} className="flex items-center gap-2">
              <User className="h-4 w-4" /> {t("nav.profile")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={ROUTES.myAds} className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> {t("nav.myAds")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to={ROUTES.subscription} className="flex items-center gap-2">
              <Crown className="h-4 w-4" /> {t("nav.subscription")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleSignOut} className="flex items-center gap-2">
            <LogOut className="h-4 w-4" /> {t("auth.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
