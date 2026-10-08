import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Правило совпадения паролей применено во ВСЕХ трёх формах с повтором
 * пароля, а не в одной.
 *
 * Решение Ж1 от 09.10 требует пункт 7: «Те же правила — в форме смены и
 * восстановления пароля». Легко починить регистрацию и забыть две
 * остальные: до правки они и расходились — на `/register` отказ показывался
 * с текстом `pages.register.passwordMismatch`, на `/reset-password` —
 * `pages.resetPassword.passwordMismatch`, в настройках —
 * `authPages.registerPasswordMismatch`. Три ключа с одним и тем же словом,
 * каждый свой.
 *
 * Поведение самого правила проверяет `password-match.test.ts`. Здесь — что
 * правило применено везде, где есть повтор пароля. Раскладки и событий в
 * среде node нет, поэтому проверка читает исходники: тот же приём, что в
 * `lib/ui/rows-reachable.test.ts`.
 */
const КОРЕНЬ = join(import.meta.dirname, "..");

const ФОРМЫ = [
  { имя: "регистрация", файл: "routes/register.tsx" },
  { имя: "восстановление пароля", файл: "routes/reset-password.tsx" },
  { имя: "смена пароля в настройках", файл: "routes/settings.security.tsx" },
] as const;

const читать = (файл: string) => readFileSync(join(КОРЕНЬ, файл), "utf8");

/**
 * Код без комментариев.
 *
 * Первая версия этой проверки искала строки по всему файлу и дважды нашла
 * их в комментариях: в `register.tsx` объяснено, что было раньше
 * («Было `disabled={loading || !acceptTerms …}`»), и приведён пример
 * `autoComplete="new-password"`. Проверка на отсутствие прежнего кода
 * краснела из-за его описания, а счёт полей давал три вместо двух.
 *
 * Поэтому утверждения о коде делаются по коду. Утверждения о наличии
 * (`toContain`) комментарием не обманешь только так же — считаем их тоже
 * по очищенному тексту.
 */
const безКомментариев = (код: string) =>
  код.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const кодБезПрозы = (файл: string) => безКомментариев(читать(файл));

describe("решение Ж1 применено во всех формах с повтором пароля", () => {
  it.each(ФОРМЫ)("$имя берёт правило из lib/password-match", ({ файл }) => {
    const код = читать(файл);
    expect(код).toContain('from "@/lib/password-match"');
    expect(код).toContain("passwordMatchState(");
  });

  it.each(ФОРМЫ)("$имя показывает состояние словами, а не только цветом", ({ файл }) => {
    const код = читать(файл);
    // Подпись под полем — общий компонент, у отказа в нём role="alert".
    expect(код).toContain("FieldMessage");
    // Оба состояния названы: и несовпадение, и совпадение.
    expect(код).toContain("passwordField.mismatch");
    expect(код).toContain("passwordField.match");
  });

  it.each(ФОРМЫ)("$имя уводит к первому проблемному месту", ({ файл }) => {
    const код = читать(файл);
    expect(код).toContain("revealAndFocus(");
  });

  it.each(ФОРМЫ)("$имя учитывает уход из поля повтора", ({ файл }) => {
    const код = кодБезПрозы(файл);
    // Без onBlur уход с неполным повтором остался бы незамеченным, а
    // решение Ж1 требует краснеть и в этом случае.
    expect(код).toMatch(/onBlur=\{\(\) => setConfirm(ation)?Left\(true\)\}/);
  });

  it("в формах не осталось трёх разных ключей про одно и то же", () => {
    const все = ФОРМЫ.map((ф) => кодБезПрозы(ф.файл)).join("\n");
    for (const старый of [
      "pages.register.passwordMismatch",
      "pages.resetPassword.passwordMismatch",
      "authPages.registerPasswordMismatch",
    ]) {
      expect(все, `ключ ${старый} всё ещё используется`).not.toContain(старый);
    }
  });

  it("кнопка регистрации нажимаема при незаполненной форме", () => {
    const код = кодБезПрозы("routes/register.tsx");
    /*
     * У `Button` в выключенном состоянии стоит `disabled:pointer-events-none`,
     * то есть нажатие не доходит даже до формы. Поэтому `disabled` у кнопки
     * отправки зависит только от того, идёт ли отправка.
     */
    expect(код).toContain('<Button type="submit" disabled={loading}');
    expect(код).not.toContain("disabled={loading || !acceptTerms");
  });

  it("форма регистрации проверяется нами, а не браузером", () => {
    // Без noValidate браузер показывает свой пузырь у первого пустого поля,
    // и до подписей у полей дело не доходит.
    expect(читать("routes/register.tsx")).toContain("noValidate");
    expect(читать("routes/reset-password.tsx")).toContain("noValidate");
  });

  it("оба поля пароля при регистрации названы новыми для менеджера паролей", () => {
    const код = кодБезПрозы("routes/register.tsx");
    const сколько = код.match(/autoComplete="new-password"/g)?.length ?? 0;
    expect(сколько, "нужно два поля с new-password").toBe(2);
  });

  it("согласие на рекламу не обязательно, а два других обязательны", () => {
    const код = кодБезПрозы("routes/register.tsx");
    // Два обязательных согласия и одно необязательное: `accept_ads` на
    // сервере объявлен `sometimes|boolean`, и условием регистрации он быть
    // не должен.
    expect(код.match(/marker=\{t\("pages\.register\.consentRequired"\)\}/g)?.length).toBe(2);
    expect(код.match(/marker=\{t\("pages\.register\.consentOptional"\)\}/g)?.length).toBe(1);
  });
});
