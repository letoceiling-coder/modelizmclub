import type { CSSProperties, ReactNode } from "react";
import { oauthRedirectUrl, oauthProviderLabel, type OAuthProvider } from "@/lib/api/oauth";

const PROVIDERS: OAuthProvider[] = ["vk", "yandex", "max"];

const oauthLinkStyle: CSSProperties = {
  background: "var(--background-surface)",
  border: "1px solid var(--border)",
  padding: "10px 14px",
  borderRadius: "var(--r-button)",
  fontSize: "var(--fs-sm)",
  color: "var(--foreground)",
  fontWeight: 500,
  cursor: "pointer",
  textAlign: "center",
  textDecoration: "none",
  display: "block",
};

export function OAuthButtons({ className }: { className?: string }) {
  return (
    <div className={className ?? "mt-[16px] grid grid-cols-3 gap-[8px]"}>
      {PROVIDERS.map((provider) => (
        <a key={provider} href={oauthRedirectUrl(provider)} style={oauthLinkStyle}>
          {oauthProviderLabel(provider)}
        </a>
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
