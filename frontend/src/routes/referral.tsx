import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy / QA alias — реферальный блок на странице подписки. */
export const Route = createFileRoute("/referral")({
  beforeLoad: () => {
    throw redirect({ to: "/subscription", hash: "invite-friend", replace: true });
  },
});
