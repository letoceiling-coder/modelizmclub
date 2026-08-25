import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "@/lib/toast";
import { completeOAuthLogin } from "@/lib/api/auth";
import { setCurrentUser } from "@/lib/store";
import { resetSessionCache, syncFavoritesFromServer } from "@/lib/auth/session";
import {
  oauthRedirectUrl,
  oauthProviderLabel,
  startMaxAuth,
  pollMaxAuth,
  type OAuthProvider,
} from "@/lib/api/oauth";

const PROVIDERS: OAuthProvider[] = ["vk", "yandex", "max"];
const MAX_AUTH_STORAGE_KEY = "max_auth_session";

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
  width: "100%",
  fontFamily: "inherit",
};

type StoredMaxAuth = {
  session: string;
  bot_url: string;
  expires_at: number;
};

function readStoredMaxAuth(): StoredMaxAuth | null {
  try {
    const raw = sessionStorage.getItem(MAX_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredMaxAuth;
    if (!parsed.session || !parsed.bot_url || !parsed.expires_at) return null;
    if (parsed.expires_at <= Date.now()) {
      sessionStorage.removeItem(MAX_AUTH_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function OAuthButtons({
  className,
  redirect,
}: {
  className?: string;
  redirect?: string;
}) {
  const nav = useNavigate();
  const [maxWaiting, setMaxWaiting] = useState(false);
  const [botUrl, setBotUrl] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const finishingRef = useRef(false);

  const stopPoll = () => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const clearMaxAuth = () => {
    stopPoll();
    sessionStorage.removeItem(MAX_AUTH_STORAGE_KEY);
    setMaxWaiting(false);
    setBotUrl(null);
  };

  useEffect(() => {
    return () => stopPoll();
  }, []);

  const finish = async (token: string) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const user = await completeOAuthLogin(token);
    resetSessionCache();
    setCurrentUser(user);
    void syncFavoritesFromServer();
    toast.success("Вы вошли");
    sessionStorage.removeItem(MAX_AUTH_STORAGE_KEY);
    const target = redirect?.startsWith("/") ? redirect : "/feed";
    nav({ to: target as "/feed", replace: true });
  };

  const beginPoll = (session: string, expiresAt: number) => {
    stopPoll();
    pollRef.current = window.setInterval(() => {
      void (async () => {
        if (Date.now() > expiresAt) {
          clearMaxAuth();
          toast.error("Время входа через MAX истекло. Нажмите MAX ещё раз.");
          return;
        }
        try {
          const status = await pollMaxAuth(session);
          if (status.status === "ready" && status.token) {
            stopPoll();
            await finish(status.token);
            return;
          }
          if (status.status === "denied") {
            clearMaxAuth();
            toast.error("Вход через MAX отменён");
            return;
          }
          if (status.status === "expired") {
            clearMaxAuth();
            toast.error("Сессия MAX истекла. Нажмите MAX ещё раз.");
          }
        } catch {
          /* keep polling */
        }
      })();
    }, 1500);
  };

  useEffect(() => {
    const stored = readStoredMaxAuth();
    if (!stored) return;
    setBotUrl(stored.bot_url);
    setMaxWaiting(true);
    beginPoll(stored.session, stored.expires_at);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume once on mount
  }, []);

  const startMax = async () => {
    if (maxWaiting) return;
    const popup = window.open("about:blank", "max-login");
    setMaxWaiting(true);
    try {
      const started = await startMaxAuth();
      const expiresAt = Date.now() + started.expires_in * 1000;
      setBotUrl(started.bot_url);
      sessionStorage.setItem(
        MAX_AUTH_STORAGE_KEY,
        JSON.stringify({ session: started.session, bot_url: started.bot_url, expires_at: expiresAt } satisfies StoredMaxAuth),
      );
      if (popup && !popup.closed) {
        popup.location.replace(started.bot_url);
      }
      toast.success("В MAX нажмите кнопку, затем вернитесь на эту вкладку");
      beginPoll(started.session, expiresAt);
    } catch {
      popup?.close();
      clearMaxAuth();
      toast.error("Не удалось начать вход через MAX");
    }
  };

  return (
    <div className={className ?? "mt-[16px]"}>
      <div className="grid grid-cols-3 gap-[8px]">
        {PROVIDERS.map((provider) =>
          provider === "max" ? (
            <button
              key={provider}
              type="button"
              onClick={() => void startMax()}
              disabled={maxWaiting}
              style={{ ...oauthLinkStyle, opacity: maxWaiting ? 0.7 : 1 }}
            >
              {maxWaiting ? "MAX…" : oauthProviderLabel(provider)}
            </button>
          ) : (
            <a key={provider} href={oauthRedirectUrl(provider)} style={oauthLinkStyle}>
              {oauthProviderLabel(provider)}
            </a>
          ),
        )}
      </div>
      {maxWaiting && botUrl && (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--background-surface)",
            fontSize: "var(--fs-sm)",
            lineHeight: 1.45,
            color: "var(--foreground)",
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>Не закрывайте эту вкладку</p>
          <p style={{ margin: "8px 0 0", color: "var(--foreground-70)" }}>
            1. В MAX нажмите «Поделиться номером и войти» или «Войти без номера».
            <br />
            2. Вернитесь сюда — вход завершится сам. Если MAX открылся в этой вкладке, нажмите «Вернуться на сайт» в боте.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <a href={botUrl} target="_blank" rel="noreferrer" style={{ ...oauthLinkStyle, width: "auto", padding: "8px 12px" }}>
              Открыть MAX снова
            </a>
            <button type="button" onClick={clearMaxAuth} style={{ ...oauthLinkStyle, width: "auto", padding: "8px 12px" }}>
              Отменить
            </button>
          </div>
        </div>
      )}
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
