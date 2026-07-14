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
  // synchronously fire a PHANTOM mouseleave right after mount and a phantom
  // mouseenter right after unmount — even though the pointer never moved.
  // This happens on EVERY mount/unmount, not just the hover-driven ones: an
  // Escape-driven or click-outside-driven close ALSO unmounts the content
  // and re-triggers the same phantom mouseenter while the cursor is still
  // resting on the trigger, silently REOPENING a menu the user just closed
  // (measured live: ~15-33ms after the close). Left unfiltered, the
  // hover-driven case alone chains into a repeating open→close→reopen pulse
  // for as long as the cursor stays put ("дёргается"). A genuine leave/enter
  // always has relatedTarget pointing at a real element the cursor actually
  // moved to/from; these phantom ones consistently arrive with relatedTarget
  // === document.documentElement (<html>) — a real "cursor left the browser
  // window" leave gives relatedTarget === null, which this does NOT filter,
  // so that case still closes normally. Guard BOTH directions symmetrically:
  // an unfiltered phantom mouseenter alone is enough to undo Escape/
  // outside-click closes.
  const isPhantomHoverEvent = (e: React.MouseEvent) => e.relatedTarget === document.documentElement;
  const onWrapperMouseEnter = (e: React.MouseEvent) => {
    if (isPhantomHoverEvent(e)) return;
    cancelClose();
    setOpen(true);
  };
  const onWrapperMouseLeave = (e: React.MouseEvent) => {
    if (isPhantomHoverEvent(e)) return;
    scheduleClose();
  };
  const onContentMouseEnter = (e: React.MouseEvent) => {
    if (isPhantomHoverEvent(e)) return;
    cancelClose();
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
      onMouseEnter={onWrapperMouseEnter}
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
