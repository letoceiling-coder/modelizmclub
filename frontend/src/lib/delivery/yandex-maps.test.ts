import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Загрузчик карт: то, что видно только в браузере, и оттого осталось бы без
 * проверок совсем.
 *
 * Ключ читается при загрузке модуля, поэтому каждый набор условий требует
 * своего импорта — `vi.resetModules` между ними обязателен.
 */

interface ТегСкрипта {
  src: string;
  async: boolean;
  onload?: () => void;
  onerror?: () => void;
}

const теги: ТегСкрипта[] = [];

function окружение(): void {
  теги.length = 0;
  vi.stubGlobal("document", {
    createElement: (): ТегСкрипта => {
      const тег: ТегСкрипта = { src: "", async: false };
      теги.push(тег);

      return тег;
    },
    head: { appendChild: () => {} },
  });
  vi.stubGlobal("window", { ymaps: undefined });
}

let ключ = "";
vi.mock("@/lib/delivery/maps-key", () => ({ yandexMapsKey: () => ключ }));

async function модуль(значение: string) {
  vi.resetModules();
  ключ = значение;

  return import("@/lib/delivery/yandex-maps");
}

describe("без ключа", () => {
  beforeEach(окружение);

  it("карта не настроена и скрипт не подключается", async () => {
    // Штатный режим: рядом список с поиском по адресу, и платить загрузкой
    // сотен килобайт за карту, которой не будет, незачем.
    const m = await модуль("");
    expect(m.isYandexMapsConfigured()).toBe(false);
    await expect(m.loadYandexMaps()).rejects.toThrow(/не настроены/);
    expect(теги).toHaveLength(0);
  });
});

describe("с ключом", () => {
  beforeEach(окружение);

  it("скрипт подключается один раз на вкладку", async () => {
    /*
     * Два открытия мастера подряд не должны вставлять второй тег: API 2.1 на
     * повторное подключение отвечает ошибкой, а не молча.
     */
    const m = await модуль("ключ-1");
    const первый = m.loadYandexMaps();
    const второй = m.loadYandexMaps();
    expect(теги).toHaveLength(1);
    expect(теги[0].src).toContain("apikey=%D0%BA%D0%BB%D1%8E%D1%87-1");

    const ymaps = { ready: (cb: () => void) => cb() };
    (window as unknown as { ymaps: unknown }).ymaps = ymaps;
    теги[0].onload?.();

    await expect(первый).resolves.toBe(ymaps);
    await expect(второй).resolves.toBe(ymaps);
  });

  it("отказ сети не запирает карту до перезагрузки страницы", async () => {
    const m = await модуль("ключ-2");
    const первый = m.loadYandexMaps();
    теги[0].onerror?.();
    await expect(первый).rejects.toThrow(/Не удалось загрузить/);

    // Следующая попытка пробует снова, а не отдаёт прежний отказ.
    m.loadYandexMaps().catch(() => {});
    expect(теги).toHaveLength(2);
  });

  it("скрипт отдался, но ymaps не появился — тоже не навсегда", async () => {
    // Так бывает на отозванном или чужом ключе. Без сброса обещания карта не
    // появилась бы до перезагрузки вкладки.
    const m = await модуль("ключ-3");
    const первый = m.loadYandexMaps();
    теги[0].onload?.();
    await expect(первый).rejects.toThrow(/объект ymaps не появился/);

    m.loadYandexMaps().catch(() => {});
    expect(теги).toHaveLength(2);
  });
});
