import { beforeEach, describe, expect, it, vi } from "vitest";
import { GOALS, MASK_SELECTOR } from "@/lib/analytics/metrika";

/*
 * Счётчик молчит, пока человек не согласился.
 *
 * Проверяется дверь, а не сам счётчик: номер задаётся сборкой, и в прогоне
 * его нет — `loadMetrika` в таких условиях не делает ничего по построению.
 * Ценность здесь в том, что `loadAnalyticsIfConsented` не зовёт загрузку
 * раньше выбора: это единственное место, откуда счётчик может появиться.
 */
/*
 * `readCookiePrefs` выходит раньше чтения, когда `window` нет: она написана
 * так нарочно, чтобы не падать на сервере при отрисовке. В прогоне окружение
 * node, поэтому окно подставляем — иначе проверка «с согласием грузится»
 * молча превращалась бы в «без согласия не грузится», то есть утверждала бы
 * не то, что написано в её названии.
 */
vi.stubGlobal("window", globalThis);

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const загрузки: number[] = [];
vi.mock("@/lib/analytics/metrika", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, loadMetrika: () => загрузки.push(1) };
});

const { loadAnalyticsIfConsented, writeCookiePrefs } = await import("@/lib/cookie-consent");
/*
 * Загрузка идёт динамическим импортом, и одного такта микроочереди ей мало:
 * промис модуля разрешается позже. Ждём, пока он доедет, а не гадаем с
 * числом тактов — иначе проверка стала бы мигающей.
 */
const дождаться = async (условие: () => boolean, мс = 500): Promise<void> => {
  const край = Date.now() + мс;
  while (!условие() && Date.now() < край) await new Promise((r) => setTimeout(r, 5));
};

describe("аналитика подключается только с согласия", () => {
  beforeEach(() => {
    store.clear();
    загрузки.length = 0;
  });

  it("выбора нет — счётчик не грузится", async () => {
    loadAnalyticsIfConsented();
    await дождаться(() => загрузки.length > 0, 60);
    expect(загрузки).toHaveLength(0);
  });

  it("отказ от аналитики — счётчик не грузится", async () => {
    writeCookiePrefs({ analytics: false, ads: false });
    loadAnalyticsIfConsented();
    await дождаться(() => загрузки.length > 0, 60);
    expect(загрузки).toHaveLength(0);
  });

  it("согласие на рекламу без аналитики счётчик не включает", async () => {
    // Два разных выбора в баннере. Реклама — не аналитика.
    writeCookiePrefs({ analytics: false, ads: true });
    loadAnalyticsIfConsented();
    await дождаться(() => загрузки.length > 0, 60);
    expect(загрузки).toHaveLength(0);
  });

  it("согласие на аналитику — грузится", async () => {
    writeCookiePrefs({ analytics: true, ads: false });
    loadAnalyticsIfConsented();
    await дождаться(() => загрузки.length > 0);
    expect(загрузки).toHaveLength(1);
  });
});

describe("цели", () => {
  it("все семь названы и не повторяются", () => {
    const значения = Object.values(GOALS);
    expect(значения).toHaveLength(7);
    expect(new Set(значения).size).toBe(7);
  });

  it("имена — те, что заведены в отчётах", () => {
    // Опечатка здесь не ломает сборку, но цель просто не появится в
    // Метрике: она сопоставляется по строке.
    expect(GOALS).toEqual({
      signup: "signup",
      phoneVerified: "phone_verified",
      postPublished: "post_published",
      listingPublished: "listing_published",
      dealCreated: "deal_created",
      subscribed: "subscribed",
      communityJoined: "community_joined",
    });
  });
});

describe("маска Вебвизора", () => {
  it("закрывает все поля ввода, а не список чувствительных", () => {
    // Перечислять по одному — значит однажды завести новое поле и забыть
    // его добавить. Цена забывчивости — чужой пароль в записи.
    for (const s of ["input", "textarea", "select", "[contenteditable]"]) {
      expect(MASK_SELECTOR).toContain(s);
    }
  });
});
