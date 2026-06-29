import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { signOut } from "@/lib/auth/session";

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
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex flex-1 items-center justify-center gap-[8px] font-medium transition-colors duration-150 hover:bg-muted md:flex-none ${className ?? ""}`}
        style={{
          height: 40,
          padding: "0 18px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--foreground-70)",
          fontSize: 14,
        }}
      >
        <LogOut size={14} />
        {t("auth.logout")}
      </button>
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
