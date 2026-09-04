import wordmark from "@/assets/logo-modelizm-wordmark.png";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Холодный старт до готовности bootstrap/сессии/лоадера маршрута.
 *
 * Показываем не спиннер, а форму будущей страницы: шапка с логотипом, колонка
 * карточек и нижняя навигация на своих местах. Подмена скелетона реальным
 * содержимым не сдвигает вёрстку.
 *
 * Компонент рендерится вне провайдеров приложения (это pendingComponent корня),
 * поэтому здесь только разметка и токены — без роутера, i18n и запросов.
 */
export function AppBootPreload() {
  return (
    <div
      className="min-h-[100dvh] overflow-x-clip"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Загрузка…</span>

      <header
        className="flex items-center justify-between gap-2 px-4"
        style={{
          height: "var(--mobile-header-h)",
          marginTop: "var(--safe-top)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <img
          src={wordmark}
          width={1600}
          height={514}
          decoding="async"
          alt="МоДелизМ"
          className="block object-contain"
          style={{ height: 28, width: "auto", maxWidth: 180 }}
        />
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </header>

      <div
        className="mx-auto w-full max-w-[var(--container-max)] space-y-3 px-3 pt-4"
        style={{ paddingBottom: "var(--bottom-nav-space)" }}
      >
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-[var(--r-card)] border p-4"
            style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-2/5 rounded-md" />
                <Skeleton className="h-3 w-1/4 rounded-md" />
              </div>
            </div>
            <Skeleton className="mt-3.5 h-3 w-full rounded-md" />
            <Skeleton className="mt-2 h-3 w-4/5 rounded-md" />
            <Skeleton className="mt-3.5 rounded-xl" style={{ aspectRatio: "16 / 9" }} />
          </div>
        ))}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 lg:hidden"
        style={{
          background: "var(--background)",
          borderTop: "1px solid var(--border)",
          paddingBottom: "var(--safe-bottom)",
        }}
      >
        <div className="grid grid-cols-5 items-center" style={{ height: "var(--bottom-nav-h)" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-5 w-5 rounded-md" />
              <Skeleton className="h-2 w-10 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
