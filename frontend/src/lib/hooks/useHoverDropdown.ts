import { useRef, useState } from "react";

const CLOSE_DELAY_MS = 250;

/** Shared hover-open/close logic for a Radix DropdownMenu portaled back
 *  into its own trigger wrapper (portalContainer={wrapperRef.current}),
 *  instead of Radix's default document.body portal. That placement fixes
 *  a "closes right as you're about to click" gap-timing bug (a hover
 *  handler on the trigger and one on a separately-mounted document.body
 *  portal are two disjoint zones), but re-mounting content inside the
 *  wrapper on every open/close makes Chromium re-run hit-testing under a
 *  STATIONARY cursor and synthesize a phantom mouseenter/mouseleave with
 *  relatedTarget === document.documentElement (<html>) — indistinguishable
 *  by relatedTarget alone from a genuine leave when the DropdownMenu's
 *  default modal=true also sets document.body.style.pointerEvents="none"
 *  while open (browsers then hit-test any real cursor movement outside
 *  the trigger/content branch to <html> too). Consumers MUST pass
 *  modal={false} to their <DropdownMenu> to avoid that second case
 *  entirely.
 *
 *  Usage: spread wrapperRef/onWrapperMouseEnter/onWrapperMouseLeave onto
 *  the wrapping <div>, pass open/setOpen to <DropdownMenu modal={false}>,
 *  portalContainer={wrapperRef.current} + onMouseEnter={onContentMouseEnter}
 *  + onMouseLeave={onWrapperMouseLeave} onto <DropdownMenuContent>. */
export function useHoverDropdown() {
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

  return { open, setOpen, wrapperRef, onWrapperMouseEnter, onWrapperMouseLeave, onContentMouseEnter };
}
