import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Отказ загрузки тарифов отличается от «тарифов нет». ТЗ 2.9, правило
 * «Пустой catch запрещён» из CLAUDE.md.
 *
 * Стояло `.catch(() => setPlans([]))`: ворота `check-empty-catch.sh` такое
 * пропускают — тело не пустое, — а человек видел ответ, которого сервер не
 * давал. Замер 07.10 на боевой сборке, 1280×900, `/api/v1/plans` → 500, тем
 * же селектором до и после:
 *
 * | Страница | API отвечает | Отказ: было | Отказ: стало |
 * | --- | --- | --- | --- |
 * | `/subscription` | 491 px, цены 99/0/99/99 ₽ | 0 px, детей 0, текста нет | 261 px, «Повторить» |
 * | `/` | 785 px, те же цены | 346 px, «Подробнее» | 563 px, «Повторить» |
 *
 * Нажатие «Повторить» проверено отдельно: запросов к `/plans` стало 2, блок
 * вернулся к 491 px с ценами.
 *
 * Сторож исходниковый: в проекте нет оснастки для отрисовки компонентов, и
 * заводить её под один случай дороже, чем она даёт. Поэтому проверяется то,
 * от чего зависит поведение: что отказ виден отдельным признаком, что он
 * разбирается **раньше** пустого списка, и что «Повторить» действительно
 * перезапускает запрос.
 */
describe("тарифы: отказ загрузки — не пустой список", () => {
  const hook = readFileSync(join(process.cwd(), "src/lib/hooks/usePricingPlans.ts"), "utf8");
  const selector = readFileSync(
    join(process.cwd(), "src/components/subscription/PlanTermSelector.tsx"),
    "utf8",
  );

  it("хук отдаёт признак отказа и способ повторить", () => {
    expect(hook).toMatch(/failed:\s*boolean/);
    expect(hook).toMatch(/reload:\s*\(\)\s*=>\s*void/);
    expect(hook).toMatch(/return \{ plans, loading, failed, reload \}/);
  });

  it("отказ записывается, а не стирается", () => {
    const тело = hook.slice(hook.indexOf(".catch("), hook.indexOf(".finally("));
    expect(тело.length).toBeGreaterThan(40);
    expect(тело).toContain("reportReadFailure");
    expect(тело).toContain("setFailed(true)");
  });

  it("«Повторить» перезапускает запрос, а не только гасит сообщение", () => {
    // Счётчик попытки стоит в зависимостях эффекта — иначе кнопка меняла бы
    // только состояние, а запрос второй раз не уходил.
    const эффект = hook.slice(hook.indexOf("useEffect("), hook.indexOf("return { plans"));
    expect(эффект.length).toBeGreaterThan(100);
    expect(эффект).toMatch(/\}, \[попытка\]\)/);
    expect(hook).toMatch(/const reload = useCallback\(\(\) => setПопытка/);
  });

  it("новый запрос снимает прежний отказ", () => {
    // Иначе после успешного повтора сообщение осталось бы на экране.
    const эффект = hook.slice(hook.indexOf("useEffect("), hook.indexOf("fetchPublicPlans()"));
    expect(эффект).toContain("setFailed(false)");
  });

  it("отказ разбирается раньше пустого списка", () => {
    const отказ = selector.indexOf("if (failed)");
    const пусто = selector.indexOf("if (plans.length === 0)");
    expect(отказ).toBeGreaterThan(0);
    expect(пусто).toBeGreaterThan(0);
    // Порядок и есть починка: при обратном отказ снова превращался бы в
    // `emptyFallback ?? null`, то есть в пустое место на /subscription.
    expect(отказ).toBeLessThan(пусто);
  });

  it("показывается общий «Не удалось загрузить» с «Повторить»", () => {
    const строка = selector.slice(
      selector.indexOf("if (failed)"),
      selector.indexOf("if (plans.length"),
    );
    expect(строка).toContain("LoadFailed");
    expect(строка).toContain("onRetry={reload}");
    expect(selector).toContain('from "@/components/ui/load-failed"');
  });

  it("скелетон остаётся перед отказом: сначала загрузка, потом вывод", () => {
    const загрузка = selector.indexOf("if (loading)");
    expect(загрузка).toBeGreaterThan(0);
    expect(загрузка).toBeLessThan(selector.indexOf("if (failed)"));
  });
});
