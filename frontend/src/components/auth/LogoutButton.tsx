import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { signOut } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";

interface Props {
  className?: string;
  variant?: "sidebar" | "profile";
}

export function LogoutButton({ className, variant = "sidebar" }: Props) {
  const { t } = useTranslation();

  const handleClick = (): void => {
    void signOut().then(() => {
      window.location.href = "/login";
    });
  };

  if (variant === "profile") {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        className={`h-[40px] flex-1 rounded-[10px] md:flex-none ${className ?? ""}`}
      >
        <LogOut size={14} />
        {t("auth.logout")}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors ${className ?? ""}`}
    >
      <LogOut className="h-4 w-4" />
      {t("auth.logout")}
    </button>
  );
}
