import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useStore, selectors, setCurrentUser } from "@/lib/store";
import { fetchMe } from "@/lib/api/auth";
import { pollMaxAuth, startMaxLink, unlinkMax } from "@/lib/api/oauth";
import { fetchNotifPrefs, saveMaxChannelPref } from "@/lib/api/notification-prefs";
import { isDemoMode } from "@/lib/demo-mode";
import { ApiError } from "@/lib/api/client";
import { canUnlinkMax, isMaxOAuthUser } from "@/lib/auth/verification";

const STORAGE_KEY = "max_link_session";

type StoredLink = {
  session: string;
  bot_url: string;
  expires_at: number;
};

function readStored(): StoredLink | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLink;
    if (!parsed.session || !parsed.bot_url || !parsed.expires_at) return null;
    if (parsed.expires_at <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function MaxAccountCard() {
  const { t } = useTranslation();
  const currentUser = useStore(selectors.currentUser);
  const linked = isMaxOAuthUser(currentUser);
  const canUnlink = canUnlinkMax(currentUser);

  const [waiting, setWaiting] = useState(false);
  const [botUrl, setBotUrl] = useState<string | null>(null);
  const [maxEnabled, setMaxEnabled] = useState(true);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const pollRef = useRef<number | null>(null);

  const stopPoll = () => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const clearWaiting = () => {
    stopPoll();
    sessionStorage.removeItem(STORAGE_KEY);
    setWaiting(false);
    setBotUrl(null);
  };

  useEffect(() => () => stopPoll(), []);

  useEffect(() => {
    if (!linked) return;
    let alive = true;
    void fetchNotifPrefs()
      .then((state) => {
        if (alive) setMaxEnabled(state.maxEnabled);
      })
      .catch(() => {
        /* keep default on */
      });
    return () => {
      alive = false;
    };
  }, [linked]);

  const beginPoll = (session: string, expiresAt: number) => {
    stopPoll();
    pollRef.current = window.setInterval(() => {
      void (async () => {
        if (Date.now() > expiresAt) {
          clearWaiting();
          toast.error(t("pages.settings.maxLinkExpired"));
          return;
        }
        try {
          const status = await pollMaxAuth(session);
          if (status.status === "ready") {
            stopPoll();
            sessionStorage.removeItem(STORAGE_KEY);
            const user = await fetchMe();
            if (user) setCurrentUser(user);
            setWaiting(false);
            setBotUrl(null);
            setMaxEnabled(true);
            toast.success(t("pages.settings.maxLinked"));
            return;
          }
          if (status.status === "denied") {
            clearWaiting();
            toast.error(t("pages.settings.maxLinkDenied"));
            return;
          }
          if (status.status === "conflict") {
            clearWaiting();
            toast.error(status.message || t("pages.settings.maxLinkConflict"));
            return;
          }
          if (status.status === "expired") {
            clearWaiting();
            toast.error(t("pages.settings.maxLinkExpired"));
          }
        } catch {
          /* keep polling */
        }
      })();
    }, 1500);
  };

  useEffect(() => {
    const stored = readStored();
    if (!stored || linked) return;
    setBotUrl(stored.bot_url);
    setWaiting(true);
    beginPoll(stored.session, stored.expires_at);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume once on mount
  }, []);

  const startLink = async () => {
    if (waiting) return;
    if (isDemoMode()) {
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          oauth_providers: [...new Set([...(currentUser.oauth_providers ?? []), "max"])],
        });
      }
      setMaxEnabled(true);
      toast.success(t("pages.settings.maxLinked"));
      return;
    }
    const popup = window.open("about:blank", "max-link");
    setWaiting(true);
    try {
      const started = await startMaxLink();
      const expiresAt = Date.now() + started.expires_in * 1000;
      setBotUrl(started.bot_url);
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ session: started.session, bot_url: started.bot_url, expires_at: expiresAt } satisfies StoredLink),
      );
      if (popup && !popup.closed) {
        popup.location.replace(started.bot_url);
      }
      toast.success(t("pages.settings.maxLinkOpened"));
      beginPoll(started.session, expiresAt);
    } catch (err) {
      popup?.close();
      clearWaiting();
      toast.error(err instanceof ApiError ? err.message : t("pages.settings.maxLinkFailed"));
    }
  };

  const onConnectClick = () => {
    if (linked) {
      setReplaceOpen(true);
      return;
    }
    void startLink();
  };

  const onToggle = (value: boolean) => {
    setMaxEnabled(value);
    void saveMaxChannelPref(value).catch(() => {
      setMaxEnabled(!value);
      toast.error(t("pages.settings.notificationsSaveFailed"));
    });
  };

  const onUnlink = async () => {
    setUnlinkOpen(false);
    if (isDemoMode()) {
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          oauth_providers: (currentUser.oauth_providers ?? []).filter((p) => p !== "max"),
        });
      }
      toast.success(t("pages.settings.maxUnlinked"));
      return;
    }
    try {
      const providers = await unlinkMax();
      if (currentUser) setCurrentUser({ ...currentUser, oauth_providers: providers });
      const user = await fetchMe();
      if (user) setCurrentUser(user);
      toast.success(t("pages.settings.maxUnlinked"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("pages.settings.maxUnlinkFailed"));
    }
  };

  return (
    <Card id="max-account" className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
      <div className="mb-[10px] flex flex-wrap items-center gap-[8px]">
        <h2 className="text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>
          {t("pages.settings.maxTitle")}
        </h2>
        {linked && !waiting ? (
          <Badge variant="published" withIcon={false}>{t("pages.settings.maxConnected")}</Badge>
        ) : waiting ? (
          <Badge variant="moderation" withIcon={false}>{t("pages.settings.maxWaiting")}</Badge>
        ) : (
          <Badge variant="draft" withIcon={false}>{t("pages.settings.maxDisconnected")}</Badge>
        )}
      </div>

      {waiting && botUrl ? (
        <div className="space-y-[12px]">
          <p className="text-[15px] font-medium" style={{ color: "var(--foreground)" }}>
            {t("pages.settings.maxKeepTab")}
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--foreground-70)" }}>
            {t("pages.settings.maxWaitingHint")}
          </p>
          <div className="flex flex-wrap gap-[8px]">
            <Button asChild variant="outline" size="sm">
              <a href={botUrl} target="_blank" rel="noreferrer">{t("pages.settings.maxOpenAgain")}</a>
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearWaiting}>
              {t("pages.settings.maxCancel")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[14px] leading-relaxed" style={{ color: "var(--foreground-70)" }}>
            {linked ? t("pages.settings.maxConnectedDesc") : t("pages.settings.maxDisconnectedDesc")}
          </p>
          {linked && (
            <div className="mt-[14px] flex items-center justify-between gap-[12px]">
              <span className="text-[15px]" style={{ color: "var(--foreground)" }}>
                {t("pages.settings.maxNotifyToggle")}
              </span>
              <Switch
                checked={maxEnabled}
                onCheckedChange={onToggle}
                aria-label={t("pages.settings.maxNotifyToggle")}
              />
            </div>
          )}
          <div className="mt-[14px] flex flex-wrap gap-[8px]">
            <Button type="button" onClick={onConnectClick}>
              {linked ? t("pages.settings.maxReplace") : t("pages.settings.maxConnect")}
            </Button>
            {linked && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setUnlinkOpen(true)}
                disabled={!canUnlink}
              >
                {t("pages.settings.maxUnlink")}
              </Button>
            )}
          </div>
          {linked && !canUnlink && (
            <p className="mt-[10px] text-[12px] leading-relaxed" style={{ color: "var(--foreground-50)" }}>
              {t("pages.settings.maxUnlinkBlocked")}
            </p>
          )}
        </>
      )}

      <AlertDialog open={replaceOpen} onOpenChange={setReplaceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.settings.maxReplaceTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("pages.settings.maxReplaceDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("pages.settings.maxCancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setReplaceOpen(false);
                void startLink();
              }}
            >
              {t("pages.settings.maxReplace")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unlinkOpen} onOpenChange={setUnlinkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.settings.maxUnlinkTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("pages.settings.maxUnlinkDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("pages.settings.maxCancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onUnlink()}>
              {t("pages.settings.maxUnlink")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
