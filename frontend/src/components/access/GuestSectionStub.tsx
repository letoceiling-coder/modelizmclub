import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { resolveMinTier } from "@/lib/feed-guest-access/store";

/** True when a guest opened a section that admins keep behind login. */
export function useGuestRouteBlocked(actionKey: string): boolean {
  const { isGuest, config } = useGuestAccess();
  return isGuest && resolveMinTier(actionKey, config) !== "guest";
}

/** Shown in place of a section a guest can't use yet. Opens the shared auth
 *  dialog instead of bouncing the visitor to /login. */
export function GuestSectionStub({
  icon,
  title,
  description,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  const { requireLogin } = useGuestAccess();

  return (
    <EmptyState icon={icon as never} title={title} description={description}>
      <Button onClick={() => requireLogin(() => {})}>
        <LogIn size={14} /> Войти
      </Button>
    </EmptyState>
  );
}
