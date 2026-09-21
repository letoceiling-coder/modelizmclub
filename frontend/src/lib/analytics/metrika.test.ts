import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Счётчик молчит, пока человек не согласился.
 *
 * Проверяется дверь, а не сам счётчик: `loadAnalyticsIfConsented` —
 * единственное место, откуда счётчик может появиться на странице.
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

const { GOALS } = await import("@/lib/analytics/metrika");
const { loadAnalyticsIfConsented, writeCookiePrefs } = await import("@/lib/cookie-consent");

describe("аналитика подключается только с согласия", () => {
  beforeEach(() => {
    store.clear();
    загрузки.length = 0;
  });

  it("выбора нет — счётчик не грузится", async () => {
    await loadAnalyticsIfConsented();
    expect(загрузки).toHaveLength(0);
  });

  it("отказ от аналитики — счётчик не грузится", async () => {
    writeCookiePrefs({ analytics: false, ads: false });
    await loadAnalyticsIfConsented();
    expect(загрузки).toHaveLength(0);
  });

  it("согласие на рекламу без аналитики счётчик не включает", async () => {
    // Два разных выбора в баннере. Реклама — не аналитика.
    writeCookiePrefs({ analytics: false, ads: true });
    await loadAnalyticsIfConsented();
    expect(загрузки).toHaveLength(0);
  });

  it("согласие на аналитику — грузится", async () => {
    writeCookiePrefs({ analytics: true, ads: false });
    await loadAnalyticsIfConsented();
    expect(загрузки).toHaveLength(1);
  });

  /*
   * Ради этого случая загрузка и стала ожидаемой (`Promise`).
   *
   * «Принять» в баннере зовёт ту же функцию, а страница к этому моменту уже
   * смонтирована: без оповещения первый просмотр у согласившегося ушёл бы
   * только со следующей перезагрузкой.
   */
  it("о запуске узнают подписчики", async () => {
    const { onAnalyticsConsent } = await import("@/lib/cookie-consent");
    let сказали = 0;
    const off = onAnalyticsConsent(() => (сказали += 1));

    writeCookiePrefs({ analytics: true, ads: false });
    await loadAnalyticsIfConsented();
    off();

    expect(сказали).toBe(1);
  });

  it("после отписки не зовут", async () => {
    const { onAnalyticsConsent } = await import("@/lib/cookie-consent");
    let сказали = 0;
    onAnalyticsConsent(() => (сказали += 1))();

    writeCookiePrefs({ analytics: true, ads: false });
    await loadAnalyticsIfConsented();

    expect(сказали).toBe(0);
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
