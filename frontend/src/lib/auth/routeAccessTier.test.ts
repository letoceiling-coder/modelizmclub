import { describe, expect, it } from "vitest";
import { levelFromAccessTier, levelOf, meets, firstFailingStep } from "@/lib/gate/levels";

/**
 * Решение, которое принимает enforceClientRouteAccess для вошедшего
 * пользователя: тир маршрута из карты доступа против уровня зрителя.
 *
 * Тир отвечает только на вопрос «нужен ли вход». Требование подтверждённого
 * телефона выражается отдельно, списком isVerifiedRequiredRoute, и в эту
 * матрицу не входит.
 */
const session = (phoneVerified: boolean, subscribed: boolean) =>
  ({
    user: { id: "1", phone_verified: phoneVerified, role: "user" },
    phoneVerified,
    subscription: { active: subscribed, plan: null, endsAt: null },
  }) as never;

const registered = session(false, false);
const verified = session(true, false);
const subscriber = session(true, true);

describe("тир маршрута против уровня зрителя", () => {
  it("«auth» означает «вошёл», а не «подтвердил телефон»", () => {
    expect(levelFromAccessTier("auth")).toBe("registered");
  });

  it("неизвестный тир требует больше, а не меньше", () => {
    // Опечатка в карте или значение из будущей версии не должны открывать
    // доступ. Все три существующих значения разобраны явно, сюда попадает
    // только неизвестное.
    expect(levelFromAccessTier("чепуха")).toBe("verified");
    expect(levelFromAccessTier(null)).toBe("verified");
    expect(levelFromAccessTier(undefined)).toBe("verified");
  });

  it("гостевой тир не закрывает никого", () => {
    const need = levelFromAccessTier("guest");
    for (const s of [registered, verified, subscriber]) {
      expect(meets(levelOf(s), need)).toBe(true);
    }
  });

  it("тир auth открыт всем вошедшим, включая учётку без СМС", () => {
    const need = levelFromAccessTier("auth");
    // Ровно то, ради чего правка: настройки — место, где подтверждают номер,
    // и требовать подтверждённый номер для входа туда значит запереть
    // человека без выхода.
    expect(meets(levelOf(registered), need)).toBe(true);
    expect(meets(levelOf(verified), need)).toBe(true);
    expect(meets(levelOf(subscriber), need)).toBe(true);
  });

  it("гость тиру auth не удовлетворяет", () => {
    expect(meets(levelOf(null), levelFromAccessTier("auth"))).toBe(false);
  });

  it("тир subscription: открыт только подписчику", () => {
    const need = levelFromAccessTier("subscription");
    expect(meets(levelOf(registered), need)).toBe(false);
    expect(meets(levelOf(verified), need)).toBe(false);
    expect(meets(levelOf(subscriber), need)).toBe(true);
  });

  /**
   * Окно всегда одно — первая непройденная ступень.
   *
   * Ступень подтверждения номера из этого пути ушла (решение З2 от 09.10):
   * вошедший без телефона на платном маршруте видит окно подписки, а не
   * «Подтвердите номер». Пока ступень была в пути, на `/reviews` открывалось
   * окно, которое доступа к обзорам всё равно не давало.
   */
  it("окно всегда одно — первая непройденная ступень", () => {
    expect(firstFailingStep(levelOf(registered), "verified")).toBeNull();
    expect(firstFailingStep(levelOf(registered), "subscriber")).toBe("paywall");
    expect(firstFailingStep(levelOf(verified), "subscriber")).toBe("paywall");
    expect(firstFailingStep(levelOf(subscriber), "subscriber")).toBeNull();
    // Гостю — только вход, и ни в каком случае не подтверждение или оплата.
    expect(firstFailingStep(levelOf(null), "subscriber")).toBe("auth");
  });
});
