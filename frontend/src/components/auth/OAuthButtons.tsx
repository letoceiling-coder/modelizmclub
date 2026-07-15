import type { ReactNode } from "react";
import { startOAuthLogin, oauthProviderLabel, type OAuthProvider } from "@/lib/api/oauth";

const PROVIDERS: OAuthProvider[] = ["vk", "yandex"];

export function OAuthButtons({ className }: { className?: string }) {
  return (
    <div className={className ?? "mt-[16px] grid grid-cols-2 gap-[8px]"}>
      {PROVIDERS.map((provider) => (
        <button
          key={provider}
          type="button"
          onClick={() => startOAuthLogin(provider)}
          style={{
            background: "var(--background-surface)",
            border: "1px solid var(--border)",
            padding: "10px 14px",
            borderRadius: "var(--r-button)",
            fontSize: "var(--fs-sm)",
            color: "var(--foreground)",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {oauthProviderLabel(provider)}
        </button>
      ))}
    </div>
  );
}

export function OAuthDivider({ children }: { children?: ReactNode }) {
  return (
    <div className="mt-[24px] flex items-center gap-[12px]" style={{ color: "var(--foreground-50)", fontSize: "var(--fs-xs)" }}>
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
      {children ?? "ИЛИ"}
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}
