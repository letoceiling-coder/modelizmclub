import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Поле ввода переписки: рост по тексту и Enter при наборе иероглифов.
 *
 * ТЗ 3.7 и проверка M07 требуют, чтобы поле росло до ограниченной высоты и
 * затем прокручивалось внутри, а Enter учитывал композицию ввода.
 *
 * Было ни того, ни другого, хотя намерение в коде стояло: у textarea были
 * `rows={1}` и `maxHeight: 120`, но высоту никто не считал — замер 05.10 на
 * 360 и 1280 дал 24 px и до двенадцати строк текста, и после. А условие
 * отправки `e.key === "Enter" && !e.shiftKey` истинно и во время
 * композиции: у человека, набирающего китайский или японский, первое же
 * подтверждение иероглифа отправляло недописанную строку.
 *
 * После правки замер даёт 24 → 120 с прокруткой внутри.
 */
const MESSENGER = join(import.meta.dirname, "messenger.tsx");

describe("поле ввода переписки", () => {
  it("высота считается по содержимому", () => {
    const источник = readFileSync(MESSENGER, "utf8");

    expect(источник).toContain("el.scrollHeight");
    expect(источник).toMatch(/el\.style\.height = `\$\{нужно\}px`/);
  });

  it("рост ограничен пределом, дальше прокрутка внутри", () => {
    const источник = readFileSync(MESSENGER, "utf8");

    expect(источник).toContain("ПРЕДЕЛ_ПОЛЯ");
    expect(источник).toMatch(/Math\.min\(el\.scrollHeight, ПРЕДЕЛ_ПОЛЯ\)/);
    expect(источник).toMatch(/overflowY = el\.scrollHeight > ПРЕДЕЛ_ПОЛЯ/);
  });

  it("высота сбрасывается перед замером, иначе поле не уменьшится", () => {
    const источник = readFileSync(MESSENGER, "utf8");

    // Без `height = "auto"` scrollHeight вернёт прежнюю высоту, и стёртый
    // текст оставит поле растянутым.
    expect(источник).toMatch(/el\.style\.height = "auto";/);
  });

  it("Enter не отправляет во время композиции ввода", () => {
    const источник = readFileSync(MESSENGER, "utf8");

    expect(источник).toContain("e.nativeEvent.isComposing");
    // 229 — Enter, съеденный редактором ввода там, где isComposing сброшен.
    expect(источник).toContain("e.nativeEvent.keyCode !== 229");
  });

  it("Shift+Enter по-прежнему переносит строку, а не отправляет", () => {
    const источник = readFileSync(MESSENGER, "utf8");

    expect(источник).toContain("!e.shiftKey");
  });
});
