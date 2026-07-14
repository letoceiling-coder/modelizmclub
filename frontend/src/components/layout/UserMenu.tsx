import { Link } from "@tanstack/react-router";
import { User, ClipboardList, Crown, LogOut, Sun, Moon, ShieldCheck } from "lucide-react";
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
import { useTheme } from "@/components/ThemeProvider";
import { useHoverDropdown } from "@/lib/hooks/useHoverDropdown";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function UserMenu() {
  const me = useStore(selectors.currentUser);
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const { open, setOpen, wrapperRef, onWrapperMouseEnter, onWrapperMouseLeave, onContentMouseEnter } = useHoverDropdown();

  const hasAvatar = Boolean(me.avatar && me.avatar.trim());

  const handleSignOut = () => {
    void signOut().then(() => {
      window.location.href = "/login";
    });
  };

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={onWrapperMouseEnter}
      onMouseLeave={onWrapperMouseLeave}
    >
      {/* modal={false}: see useHoverDropdown's doc comment — Radix's default
          modal DropdownMenu disables body pointer-events while open, which
          makes genuine cursor-leave events indistinguishable from the
          phantom DOM-mutation events the hook filters. */}
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
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
          portalContainer={wrapperRef.current}
          align="end"
          sideOffset={8}
          className="w-56"
          onMouseEnter={onContentMouseEnter}
          onMouseLeave={onWrapperMouseLeave}
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
          {me.isAdmin && (
            <DropdownMenuItem asChild>
              <Link to={ROUTES.admin} className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> {t("nav.admin")}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => { e.preventDefault(); toggleTheme(); }}
            className="flex items-center gap-2"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {isDark ? "Светлая тема" : "Тёмная тема"}
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
