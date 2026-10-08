import type { ReactNode } from "react";

/**
 * Подпись под полем: отказ, подтверждение или подсказка.
 *
 * Появилась 09.10 вместе с решением Ж1. До неё состояние поля передавалось
 * **только цветом рамки**: `Input` принимал `error` и перекрашивал границу,
 * а текста не было нигде — замер на 360 px показал у поля повтора пароля
 * `aria-invalid: null`, `aria-describedby: null` и ни одного узла со словом
 * «совпада». Человек, который не различает красный и серый, и экранный
 * диктор узнавали об ошибке одинаково: никак.
 *
 * Поэтому у каждого состояния здесь есть слова, а у отказа — ещё и
 * `role="alert"`, чтобы диктор прочёл его сразу, не дожидаясь, пока человек
 * дойдёт до поля.
 *
 * `id` обязателен: он уходит в `aria-describedby` поля, и без него связь
 * «поле ↔ подпись» существует только визуально.
 */
export type FieldMessageTone = "error" | "ok" | "hint";

const цвет: Record<FieldMessageTone, string> = {
  error: "var(--danger)",
  ok: "var(--success)",
  hint: "var(--foreground-50)",
};

export function FieldMessage({
  id,
  tone,
  children,
}: {
  id: string;
  tone: FieldMessageTone;
  children: ReactNode;
}) {
  return (
    <p
      id={id}
      /*
       * role="alert" только у отказа. У подтверждения и подсказки он был бы
       * вреден: диктор перебивал бы сам себя на каждом знаке, который человек
       * печатает, — а «Пароли совпадают» не новость, требующая немедленного
       * внимания.
       */
      role={tone === "error" ? "alert" : undefined}
      aria-live={tone === "error" ? undefined : "polite"}
      className="mt-[6px] text-[12px] leading-[16px]"
      style={{ color: цвет[tone] }}
    >
      {children}
    </p>
  );
}
