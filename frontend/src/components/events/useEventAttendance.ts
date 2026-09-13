import { useCallback, useState } from "react";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { attendEvent, eventErrors, unattendEvent, type ClubEvent } from "@/lib/api/events";
import { toast } from "@/lib/toast";

/**
 * «Пойду» / «Иду» — одна логика для карточки, страницы и баннера.
 *
 * Гость сначала входит (окно входа, потом действие продолжается). Ответ
 * сервера заменяет событие целиком: счётчик и отметка берутся оттуда, а не
 * угадываются на клиенте.
 */
export function useEventAttendance(onChange: (event: ClubEvent) => void) {
  const { requireAccount } = useGuestAccess();
  const [busyUuid, setBusyUuid] = useState<string | null>(null);

  const toggle = useCallback(
    (event: ClubEvent) => {
      requireAccount(() => {
        void (async () => {
          setBusyUuid(event.uuid);
          try {
            if (event.going) {
              onChange(await unattendEvent(event.uuid));
            } else {
              const { event: next, joined } = await attendEvent(event.uuid);
              onChange(next);
              toast.success(
                joined && next.community
                  ? `Вы отметились и вступили в «${next.community.name}»`
                  : "Вы отметились — напомним за сутки",
              );
            }
          } catch (error) {
            toast.error(eventErrors(error).message);
          } finally {
            setBusyUuid(null);
          }
        })();
      });
    },
    [onChange, requireAccount],
  );

  return { toggle, busyUuid };
}
