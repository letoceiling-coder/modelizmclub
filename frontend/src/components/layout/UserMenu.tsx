import { useRef, useState } from "react";
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Radix portals DropdownMenuContent to document.body by default, so it's
// not a DOM descendant of the trigger — a hover handler on the trigger and
// one on the (separately-mounted) content are two disjoint zones with a
// real gap between them (sideOffset). Crossing that gap at normal mouse
// speed usually beats a close timer, but not always — enough to reproduce
// "closes right as you're about to click". CLOSE_DELAY_MS plus routing the
// portal back inside wrapperRef (below) fixes both the timing margin and
// the gap itself.
const CLOSE_DELAY_MS = 250;

export function UserMenu() {
  const me = useStore(selectors.currentUser);
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  // Because DropdownMenuContent portals INTO wrapperRef (see portalContainer
  // below), it is a real DOM descendant of the exact element these hover
  // handlers are on. Mounting/unmounting that descendant while the cursor
  // sits stationary over the wrapper makes Chromium re-run hit-testing and
  // synchronously fire a PHANTOM mouseleave (right after open) and a phantom
  // mouseenter (right after close) — even though the pointer never moved.
  // Measured live: this phantom leave fires ~15ms after every open, its
  // scheduled close then fires the phantom-triggered unmount, which itself
  // fires a phantom re-enter ~15ms later — reopening the menu and repeating
  // the cycle for as long as the cursor stays put, a visible open→close→
  // reopen pulse ("дёргается"). A genuine leave always has relatedTarget
  // pointing at whatever real element the cursor moved onto; these phantom
  // ones consistently arrive with relatedTarget === document.documentElement
  // (<html>) — a real "moved off-window" leave gives relatedTarget === null,
  // which this does NOT filter, so that case still closes normally.
  const onWrapperMouseLeave = (e: React.MouseEvent) => {
    if (e.relatedTarget === document.documentElement) return;
    scheduleClose();
  };

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
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={onWrapperMouseLeave}
    >
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
          portalContainer={wrapperRef.current}
          align="end"
          sideOffset={8}
          className="w-56"
          onMouseEnter={cancelClose}
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
