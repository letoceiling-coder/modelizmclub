import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Пустой список направлений объясняется словами. Промпт 2 шаг 3.
 *
 * Замер 07.10 на боевой сборке, 1280×950, мастер объявления:
 *
 * | Дерево объявлений | Селектов | Вариантов «Категория» | Объяснение | «Далее» |
 * | --- | --- | --- | --- | --- |
 * | пусто (как было на стенде) | 1 | — | есть | выключено |
 * | 7 полок (полки связаны) | 2 | 7 | нет | работает |
 *
 * До правки при пустом дереве рисовался `select` с нулём вариантов, и
 * «Далее» было выключено без единого слова о причине: продавец видел
 * исправную с виду форму, которая не пускает дальше.
 *
 * Причина пустоты на стенде — данные: ни у одного направления не указана
 * полка каталога (`post_categories.listing_category_id` пуст у всех 30),
 * поэтому `visibleMirrorIds` отдаёт ноль. На проде так станет в тот же миг,
 * когда полки отвяжут в админке, — значит это не «не может случиться».
 *
 * После связывания полок мастер проходится целиком: фото настоящим
 * событием выбора файла (`201 POST /media`), три шага, `201 POST /listings`,
 * «Объявление опубликовано», переход на `/my-ads`.
 */
describe("мастер объявления: пустое дерево направлений", () => {
  const src = readFileSync(join(process.cwd(), "src/routes/ads.new.tsx"), "utf8");
  const ru = readFileSync(join(process.cwd(), "src/lib/i18n/locales/ru.ts"), "utf8");

  it("ответ отличается от пустоты: есть признак «загружено»", () => {
    // Без него пустой список до ответа и после выглядел бы одинаково, и
    // объяснение мелькало бы на каждой загрузке формы.
    expect(src).toMatch(/const \[catsLoaded, setCatsLoaded\] = useState\(false\)/);
    expect(src).toContain("setCatsLoaded(true)");
  });

  it("объяснение показывается только после ответа и только при пустом списке", () => {
    expect(src).toMatch(/catsLoaded && cats\.length === 0 \?/);
  });

  it("текст объяснения есть в словаре и говорит, что делать", () => {
    const m = ru.match(/categoriesEmpty:\s*\n?\s*"([^"]+)"/);
    expect(m, "ключа pages.adsNew.categoriesEmpty нет").toBeTruthy();
    const текст = m![1];
    expect(текст).toMatch(/не настроены/);
    // Человеку нужен следующий шаг, а не только сообщение о беде.
    expect(текст).toMatch(/поддержк/i);
  });

  it("признак доезжает до шага с выбором категории", () => {
    // Иначе условие выше вычислялось бы по `undefined` и молчало всегда.
    const объявление = src.slice(
      src.indexOf("function StepData({"),
      src.indexOf("function StepData({") + 1200,
    );
    expect(объявление).toMatch(/\n {2}catsLoaded,/);
    expect(объявление).toMatch(/catsLoaded: boolean;/);
    expect(src).toMatch(/catsLoaded=\{catsLoaded\}/);
  });

  it("при непустом списке рисуется выбор, а не объяснение", () => {
    const ветка = src.slice(src.indexOf("catsLoaded && cats.length === 0 ?"));
    // Срез до конца этой ветки: 400 знаков не хватало — `options` стоит
    // дальше, и проверка краснела на верном коде.
    const иначе = ветка.slice(ветка.indexOf(") : ("), ветка.indexOf("</Field>"));
    expect(иначе.length, "ветка «иначе» не найдена").toBeGreaterThan(200);
    expect(иначе).toContain("NativeSelect");
    expect(иначе).toContain("options={cats.map(");
  });
});
