import { describe, expect, it } from "vitest";
import { levelFromAccessTier, levelOf, meets, firstFailingStep } from "@/lib/gate/levels";

/**
 * Решение, которое принимает enforceClientRouteAccess для вошедшего
 * пользователя: тир маршрута из карты доступа против уровня зрителя.
 *
 * До 07.09 тир `auth` для вошедшего не проверялся вовсе — ветки были только
 * для гостя, для жёсткого списка isVerifiedRequiredRoute и для тира
 * `subscription`. Матрица ниже закрепляет то, что теперь должно происходить
 * на прямой ссылке под каждым из трёх состояний.
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
  it("«auth» в карте означает уровень verified", () => {
    expect(levelFromAccessTier("auth")).toBe("verified");
  });

  it("гостевой тир не закрывает никого", () => {
    const need = levelFromAccessTier("guest");
    for (const s of [registered, verified, subscriber]) {
      expect(meets(levelOf(s), need)).toBe(true);
    }
  });

  it("тир auth: без СМС закрыт, с СМС и с подпиской открыт", () => {
    const need = levelFromAccessTier("auth");
    expect(meets(levelOf(registered), need)).toBe(false);
    expect(meets(levelOf(verified), need)).toBe(true);
    expect(meets(levelOf(subscriber), need)).toBe(true);
  });

  it("тир subscription: открыт только подписчику", () => {
    const need = levelFromAccessTier("subscription");
    expect(meets(levelOf(registered), need)).toBe(false);
    expect(meets(levelOf(verified), need)).toBe(false);
    expect(meets(levelOf(subscriber), need)).toBe(true);
  });

  it("окно всегда одно — первая непройденная ступень", () => {
    expect(firstFailingStep(levelOf(registered), "verified")).toBe("verify");
    expect(firstFailingStep(levelOf(verified), "subscriber")).toBe("paywall");
    expect(firstFailingStep(levelOf(subscriber), "subscriber")).toBeNull();
  });
});
