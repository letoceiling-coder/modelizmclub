import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CallScreen } from "@/components/calls/CallScreen";
import { GroupCallScreen } from "@/components/calls/GroupCallScreen";
import { GroupCallInviteDialog } from "@/components/calls/GroupCallInviteDialog";
import { I18nProvider } from "@/components/I18nProvider";
import { restoreSession } from "@/lib/auth/session";
import { bindCallAudioUnlock } from "@/lib/callAudio";

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light'){var h=new Date().getHours();t=(h>=19||h<7)?'dark':'light';}document.documentElement.setAttribute('data-theme',t);if(t==='dark')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.classList.add('dark');}})();`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 font-display text-xl font-semibold">Страница не найдена</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Возможно, она была перемещена или удалена. Проверьте URL или вернитесь на главную.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <a href="/feed" className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            На главную
          </a>
          <button
            type="button"
            onClick={() => { if (typeof window !== "undefined") window.history.back(); }}
            className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Назад
          </button>
          <a href="/diag" className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
            Карта роутов
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold">Что-то пошло не так</h1>
        <p className="mt-2 text-sm text-muted-foreground">Попробуйте обновить страницу.</p>
        <button onClick={reset} className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Повторить</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "МоДелизМ Форум — сообщество моделистов" },
      { name: "description", content: "Социальная платформа для моделистов: RC авто, самолёты, квадрокоптеры, корабли, электроника. Чаты, объявления, сообщества." },
      { property: "og:title", content: "МоДелизМ Форум — сообщество моделистов" },
      { name: "twitter:title", content: "МоДелизМ Форум — сообщество моделистов" },
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    bindCallAudioUnlock();
    void restoreSession();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <Outlet />
          <CallScreen />
          <GroupCallScreen />
          <GroupCallInviteDialog />
          {/* Desktop: small top offset. Mobile: clear the sticky header +
              notch so toasts never cover the mobile navigation. */}
          <Toaster
            position="top-center"
            richColors
            offset={{ top: 16 }}
            mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 60px)" }}
          />
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
