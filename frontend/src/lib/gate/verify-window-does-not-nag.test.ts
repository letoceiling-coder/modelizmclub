import { beforeEach, describe, expect, it } from "vitest";

/**
 * Окно «Подтвердите номер» не всплывает само. Решение З3 от 09.10.
 *
 * Четвёртая жалоба владельца: «Окно „Подтвердите номер“ всплывает постоянно».
 * Причина была в двух местах сразу.
 *
 * **Первое.** `lib/api/client` рассылал событие доступа на любой неудачный
 * запрос с кодом `phone_not_verified` — в том числе на фоновый: счётчик
 * непрочитанного, чат сообщества, закладки. Человек ничего не нажимал, окно
 * открывалось само. Рассылка оттуда убрана, и это проверяет
 * `api-client-does-not-open-windows.test.ts`.
 *
 * **Второе.** Закрытое окно ничем не запоминалось: следующий же непрошеный
 * вызов открывал его снова. Это проверяется здесь.
 *
 * Разница между «само» и «по просьбе» выражена признаком `byUserAction`:
 * нажатие на действие открывает окно всегда, остальное — только пока его в
 * этом заходе не закрыли.
 */
describe("окно подтверждения номера", () => {
  beforeEach(async () => {
    const { closeGate, clearVerifyGateDismissal } = await import("./gateStore");
    closeGate();
    clearVerifyGateDismissal();
    closeGate();
    clearVerifyGateDismissal();
  });

  it("открывается непрошено, пока его не закрыли", async () => {
    const { openGate, getGateState } = await import("./gateStore");
    openGate("verify", "/feed");
    expect(getGateState().open).toBe("verify");
  });

  it("после закрытия само больше не возвращается в этом заходе", async () => {
    const { openGate, closeGate, getGateState, isVerifyGateDismissed } =
      await import("./gateStore");

    openGate("verify", "/feed");
    closeGate();
    expect(isVerifyGateDismissed()).toBe(true);

    // Непрошеный вызов — например, страж маршрута на следующем переходе.
    openGate("verify", "/communities");
    expect(getGateState().open).toBeNull();
  });

  it("но по нажатию открывается и после отказа", async () => {
    const { openGate, closeGate, getGateState } = await import("./gateStore");

    openGate("verify", "/feed");
    closeGate();

    // Человек сам нажал «Разместить объявление» — это просьба, не навязывание.
    openGate("verify", "/ads/new", { byUserAction: true });
    expect(getGateState().open).toBe("verify");
  });

  /**
   * Запрет держится и там, где хранилища нет вовсе.
   *
   * Отказ пишется в `sessionStorage` — заход и есть вкладка. Но обращение к
   * нему бросает исключение в приватном окне, при запрещённых данных сайта и
   * в этом самом прогоне: окружение проверок — node, и `window` здесь нет.
   * Поэтому запись и чтение обёрнуты в try/catch, а запрет дублируется в
   * памяти процесса (`CLAUDE.md`, раздел про браузерное хранилище: «читать и
   * писать в try/catch, страница должна работать и без него»).
   *
   * Эта проверка и есть доказательство запасного пути: здесь хранилище
   * недоступно, а запрет всё равно работает.
   */
  it("работает и без доступного хранилища", async () => {
    const { openGate, closeGate, getGateState, isVerifyGateDismissed } =
      await import("./gateStore");

    expect(typeof window, "окружение проверок — node, хранилища здесь нет").toBe("undefined");

    openGate("verify", "/feed");
    closeGate();

    expect(isVerifyGateDismissed()).toBe(true);
    openGate("verify", "/communities");
    expect(getGateState().open).toBeNull();
  });

  it("успешное подтверждение стирает отказ", async () => {
    const { openGate, closeGate, clearVerifyGateDismissal, isVerifyGateDismissed } =
      await import("./gateStore");

    openGate("verify", "/feed");
    closeGate();
    clearVerifyGateDismissal();

    expect(isVerifyGateDismissed()).toBe(false);
  });

  it("закрытие окна входа и окна подписки ничего не запоминает", async () => {
    const { openGate, closeGate, getGateState, isVerifyGateDismissed } =
      await import("./gateStore");

    openGate("auth", "/feed");
    closeGate();
    expect(isVerifyGateDismissed()).toBe(false);

    openGate("paywall", "/reviews");
    closeGate();
    expect(isVerifyGateDismissed()).toBe(false);

    // И окно подтверждения после этого по-прежнему открывается непрошено.
    openGate("verify", "/feed");
    expect(getGateState().open).toBe("verify");
  });
});

/**
 * Требование телефона снято со страниц и действий. Решение З2.
 *
 * Жалобы 1 и 3 владельца — «мессенджер не работает», «сообщество посмотреть
 * нельзя» — держались на двух списках во фронтенде: маршруты, которые нельзя
 * открыть без SMS, и действия, которым мало входа. Оба опустели, и эта
 * проверка не даёт наполнить их молча.
 */
describe("список страниц и действий с требованием телефона", () => {
  it("страниц, закрытых без подтверждённого телефона, нет ни одной", async () => {
    const { isVerifiedRequiredRoute } = await import("@/lib/feed-guest-access/routes");

    for (const path of [
      "/feed",
      "/messenger",
      "/communities",
      "/communities/modelists",
      "/channels",
      "/friends",
      "/ads",
      "/ads/new",
      "/my-ads",
      "/settings",
      "/settings/account",
      "/profile",
      "/deals",
      "/reviews",
    ]) {
      expect(isVerifiedRequiredRoute(path), path + " требует SMS, хотя по З2 не должен").toBe(
        false,
      );
    }
  });

  it("действий, требующих телефон мимо сервера, нет ни одного", async () => {
    const { isVerifiedRequiredAction } = await import("@/lib/feed-guest-access/routes");

    for (const key of [
      "ads.safe_deal",
      "ads.call_seller",
      "messenger.send",
      "feed.post.like",
      "feed.post.comment",
      "feed.compose.open",
      "friends.request",
    ]) {
      expect(isVerifiedRequiredAction(key), key + " требует SMS мимо сервера").toBe(false);
    }
  });
});
