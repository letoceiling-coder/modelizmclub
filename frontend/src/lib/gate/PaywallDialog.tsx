import { Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GateDialogShell } from "./GateDialogShell";

interface Props {
  open: boolean;
  returnTo?: string;
  onOpenChange: (open: boolean) => void;
}

/** The last rung. Sends the user to /subscription and keeps the way back. */
export function PaywallDialog({ open, returnTo, onOpenChange }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <GateDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={t("gate.paywall.title")}
      description={t("gate.paywall.description")}
      icon={<Crown size={22} />}
    >
      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={() => {
          onOpenChange(false);
          void navigate({ to: "/subscription", search: { returnTo } });
        }}
      >
        {t("gate.paywall.submit")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        className="mt-2 w-full"
        onClick={() => onOpenChange(false)}
      >
        {t("gate.paywall.later")}
      </Button>
    </GateDialogShell>
  );
}
