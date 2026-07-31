import { DirectionsRightRail } from "@/components/layout/DirectionsRightRail";

/** Feed page reuses the shared directions rail with guest-access guards. */
export function FeedRightRail() {
  return <DirectionsRightRail guestGuard />;
}
