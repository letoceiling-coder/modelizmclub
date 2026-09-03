import { Crown } from "lucide-react";
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
  const navigate = useNavigate();

  return (
    <GateDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Нужна подписка"
      description="Оформите подписку, чтобы пользоваться этой функцией"
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
        Оформить подписку
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        className="mt-2 w-full"
        onClick={() => onOpenChange(false)}
      >
        Позже
      </Button>
    </GateDialogShell>
  );
}
