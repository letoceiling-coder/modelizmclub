import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CallScreen } from "@/components/calls/CallScreen";
import { GroupCallScreen } from "@/components/calls/GroupCallScreen";
import { GroupCallInviteDialog } from "@/components/calls/GroupCallInviteDialog";
import { I18nProvider, FADE_MS, useLocaleFade } from "@/components/I18nProvider";
import { restoreSession } from "@/lib/auth/session";
import { bindCallAudioUnlock } from "@/lib/callAudio";
import "@/lib/icon-overrides"; // bootstrap published icon-override map on app start

// Preference is "light"/"dark"/"system" (settings) or unset (legacy: bare
// "theme" key holds the resolved value from the old binary toggle). "system"
// or unset resolves via prefers-color-scheme — matches ThemeProvider's
// runtime logic so there's no flash-of-wrong-theme on first paint.
const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('theme-preference');var t;if(p==='dark'||p==='light'){t=p;}else{var legacy=localStorage.getItem('theme');if((legacy==='dark'||legacy==='light')&&p!=='system'){t=legacy;}else{t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}}document.documentElement.setAttribute('data-theme',t);if(t==='dark')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.classList.add('dark');}})();`;

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 font-display text-xl font-semibold">{t("errors.notFound")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("errors.notFoundDesc")}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <a href="/feed" className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            {t("errors.goHome")}
          </a>
          <button
            type="button"
            onClick={() => { if (typeof window !== "undefined") window.history.back(); }}
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {t("errors.goBack")}
          </button>
          <a href="/diag" className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
            {t("errors.routeMap")}
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold">{t("errors.boundaryTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("errors.boundaryDesc")}</p>
        <button onClick={reset} className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">{t("errors.retry")}</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "МоДелизМ — сообщество моделистов" },
      { name: "description", content: "Социальная платформа для моделистов: RC авто, самолёты, квадрокоптеры, корабли, электроника. Чаты, объявления, сообщества." },
      { property: "og:title", content: "МоДелизМ — сообщество моделистов" },
      { name: "twitter:title", content: "МоДелизМ — сообщество моделистов" },
      { property: "og:description", content: "Социальная платформа для моделистов: RC авто, самолёты, квадрокоптеры, корабли, электроника. Чаты, объявления, сообщества." },
      { name: "twitter:description", content: "Социальная платформа для моделистов: RC авто, самолёты, квадрокоптеры, корабли, электроника. Чаты, объявления, сообщества." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/38877450-047f-4923-bb43-fd1fbd2c7a45/id-preview-7456b556--80bd810b-8913-49e2-87d8-ec618ddf722a.lovable.app-1780082915517.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/38877450-047f-4923-bb43-fd1fbd2c7a45/id-preview-7456b556--80bd810b-8913-49e2-87d8-ec618ddf722a.lovable.app-1780082915517.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" },
    ],
    scripts: [
      { children: THEME_INIT_SCRIPT },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Theme/lang are adjusted by inline scripts / client providers before hydration.
  // suppressHydrationWarning avoids React #418 when SSR defaults differ from DOM.
  return (
    <html lang="ru" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body suppressHydrationWarning>{children}<Scripts /></body>
    </html>
  );
}

/**
 * Toasts anchor bottom-right — out of the way of headers, cards and the main
 * content grid. On mobile, sit above the fixed bottom nav.
 */
function useBottomToastOffset(): number {
  const [offset, setOffset] = useState(16);
  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;height:var(--bottom-nav-space)";
    document.body.appendChild(probe);
    const navSpace = probe.getBoundingClientRect().height;
    document.body.removeChild(probe);

    const sync = () => {
      const mobile = window.matchMedia("(max-width: 1023px)").matches;
      setOffset(mobile && navSpace > 0 ? navSpace + 12 : 16);
    };
    sync();
    const mq = window.matchMedia("(max-width: 1023px)");
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return offset;
}

function FadingOutlet() {
  const fading = useLocaleFade();
  return (
    <div
      style={{
        opacity: fading ? 0.82 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      <Outlet />
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const bottomToastOffset = useBottomToastOffset();
  useEffect(() => {
    bindCallAudioUnlock();
    void restoreSession();
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void restoreSession();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <FadingOutlet />
          <CallScreen />
          <GroupCallScreen />
          <GroupCallInviteDialog />
          <Toaster
            position="bottom-right"
            closeButton
            duration={3500}
            visibleToasts={3}
            offset={{ bottom: 16, right: 16 }}
            mobileOffset={{ bottom: bottomToastOffset, right: 16, left: 16 }}
          />
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
