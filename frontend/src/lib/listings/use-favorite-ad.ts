import { useCallback, useEffect, useRef } from "react";

import { addFavoriteListing, removeFavoriteListing } from "@/lib/api/listings";
import { getToken } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";
import { actions, selectors, useStore } from "@/lib/store";
import { toast } from "@/lib/toast";
import { inlineFeedback } from "@/lib/ui/inline-feedback";
import { useGuestAccessOptional, type ResumeRef } from "@/components/access/GuestAccessProvider";
import type { ID } from "@/lib/mock";

/**
 * Избранное объявления — один источник поведения на все карточки.
 *
 * ПОЧЕМУ ХУК. Переключение было написано трижды, почти слово в слово:
 * `CatalogCard`, `routes/index.tsx`, `routes/ads.$id.tsx` — по двадцать строк
 * оптимистичного обновления, запроса, откат и тост. А в `AdCard` стояла
 * четвёртая, сломанная версия: `useState(false)` и `setLiked(v => !v)`, без
 * стора и без сервера. Аудит 03.10 нашёл её; выяснилось, что отрисовывается
 * она только при `compact === false`, а оба вызова передают `compact`, —
 * то есть на экране её не было. Но ловушка остаётся: кто отрисует карточку
 * без `compact`, получит сердечко, которое загорается и ничего не сохраняет.
 *
 * Три копии и одна не-копия — ровно тот случай, под который в `CLAUDE.md`
 * написано «не создавайте второго, если есть первое». Здесь первое и есть.
 *
 * ЧТО ВНУТРИ, и почему именно так:
 *
 * - **начальное значение из стора**, а не из `useState`. Стор наполняется с
 *   сервера при восстановлении сессии (`syncFavoritesFromServer`), поэтому
 *   уже отмеченное объявление показывает полное сердце с первого кадра;
 * - **подпись сразу по нажатию**, а не после ответа. Прямоугольник кнопки
 *   снимается в момент показа: на медленной сети человек успевает
 *   пролистать список, и подпись всплыла бы у чужой карточки — той, что
 *   оказалась в этих координатах;
 * - **откат и тост при отказе**. Молчание на экране неотличимо от «ничего не
 *   произошло», а состояние оптимистичное — не вернуть его значит показать
 *   человеку то, чего сервер не принял;
 * - **гость уходит в гейт** через `requireAccount`, а не получает отказ.
 */
export function useFavoriteAd(adId: ID, options: FavoriteAdOptions = {}) {
  const favorite = useStore(selectors.isAdFavorite(adId));
  const guest = useGuestAccessOptional();

  /*
   * Настройки — через ref, а не в зависимостях.
   *
   * Вызывающие передают объектный литерал, и он новый на каждой отрисовке:
   * положи его в зависимости — и `toggle` пересоздаётся каждый раз, а вместе
   * с ним и обработчик на кнопке в списке из тридцати карточек. Подписи
   * читаются в момент нажатия, так что свежесть ref'а здесь достаточна.
   */
  const настройки = useRef(options);
  useEffect(() => {
    настройки.current = options;
  });

  const toggle = useCallback(
    (anchor: Element | null = null) => {
      const options = настройки.current;

      const run = async (): Promise<void> => {
        // Гость без гейта (его может не быть в дереве) — переключать нечего:
        // сервер запрос не примет, а локальная отметка разошлась бы с ним.
        if (!getToken() && !isDemoMode()) return;

        const next = !favorite;
        actions.toggleFavoriteAd(adId);

        const подпись = next ? options.addedLabel : options.removedLabel;
        if (подпись && !inlineFeedback(anchor, подпись)) {
          toast.success(подпись, { id: "favorite-toggle" });
        }

        if (isDemoMode()) return;

        try {
          const count = next ? await addFavoriteListing(adId) : await removeFavoriteListing(adId);
          options.onCount?.(count);
        } catch {
          actions.toggleFavoriteAd(adId);
          toast.error(options.failedLabel ?? "Не удалось обновить избранное", {
            id: "favorite-toggle",
          });
        }
      };

      if (guest) {
        /*
         * Третий довод — намерение «вернуться и доделать» после входа.
         *
         * Страница объявления передаёт его с 25.09: гость нажал «сохранить»,
         * ушёл в окно входа, вошёл — и объявление оказывается в избранном
         * само (`lib/gate/resumable.ts`). Без этого довода нажатие пропадало
         * бы вместе с окном. Карточки в списках намерения не передают: там
         * человек никуда не уходил со страницы.
         */
        guest.requireAccount(
          () => {
            void run();
          },
          undefined,
          options.resumeIntent,
        );
        return;
      }

      void run();
    },
    [adId, favorite, guest],
  );

  return { favorite, toggle };
}

export interface FavoriteAdOptions {
  /** Подпись-подтверждение при добавлении. Без неё подпись не показывается. */
  addedLabel?: string;
  /** Подпись-подтверждение при снятии. */
  removedLabel?: string;
  /** Сообщение об отказе. */
  failedLabel?: string;
  /**
   * Сервер возвращает число добавивших — страница объявления показывает его
   * рядом с сердечком и обновляет по ответу.
   */
  onCount?: (count: number) => void;
  /**
   * Что доделать после входа, если нажал гость. Передаётся в гейт
   * (`lib/gate/resumable.ts`).
   */
  resumeIntent?: ResumeRef;
}
