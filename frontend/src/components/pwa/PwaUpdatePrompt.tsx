import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

/**
 * Регистрирует service worker и предлагает обновиться, когда приехала новая
 * версия. Молча подменять код у открытого приложения нельзя: пользователь может
 * быть в середине формы, поэтому момент перезагрузки выбирает он.
 *
 * Монтируется один раз в корне (routes/__root.tsx).
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  // Тост живёт до ответа пользователя — следим, чтобы он не задвоился на
  // повторных рендерах.
  const toastRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!needRefresh) {
      if (toastRef.current !== null) {
        toast.dismiss(toastRef.current);
        toastRef.current = null;
      }
      return;
    }
    if (toastRef.current !== null) return;

    toastRef.current = toast("Доступна новая версия", {
      description: "Обновите страницу, чтобы получить последние изменения.",
      duration: Infinity,
      action: {
        label: "Обновить",
        onClick: () => {
          void updateServiceWorker(true);
        },
      },
      onDismiss: () => {
        toastRef.current = null;
        setNeedRefresh(false);
      },
    });
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
