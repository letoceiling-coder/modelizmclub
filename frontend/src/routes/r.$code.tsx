import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { rememberReferralCodeAndTrack } from "@/lib/referral-cookie";
import { getToken } from "@/lib/api/client";

export const Route = createFileRoute("/r/$code")({
  component: ReferralShortLinkPage,
});

function ReferralShortLinkPage() {
  const { code } = Route.useParams();
  const nav = useNavigate();

  useEffect(() => {
    void rememberReferralCodeAndTrack(code);
    if (getToken()) {
      void nav({ to: "/referral", replace: true });
      return;
    }
    void nav({ to: "/register", search: { ref: code }, replace: true });
  }, [code, nav]);

  return (
    <div
      className="flex min-h-screen items-center justify-center text-sm"
      style={{ color: "var(--foreground-50)" }}
    >
      Переходим к регистрации…
    </div>
  );
}
