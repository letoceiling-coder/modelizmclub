import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mapApiUser } from "@/lib/api/auth";

/*
 * Значок «Pro» в шапке профиля.
 *
 * Разметка была написана под поле `user.subscription`, которого не
 * заполнял ни один маппер: `mapApiUser` его не ставил, `/auth/me` не
 * отдавал, публичный профиль тоже. Условие было ложным всегда, и ни один
 * подписчик отметки не получал. Найдено разбором 03.10.
 *
 * Поэтому здесь две проверки разной природы: маппер — что признак с
 * сервера доезжает до модели; чтение разметки — что разметка смотрит
 * именно на него. Без второй маппер можно починить, а значок останется
 * привязан к мёртвому полю, и тест будет зелёным.
 */
describe("признак подписчика доезжает от сервера до модели", () => {
  const базовый = { uuid: "u-1", id: 1, email: "a@b.c" };

  it("is_subscriber: true становится isSubscriber", () => {
    expect(mapApiUser({ ...базовый, is_subscriber: true }).isSubscriber).toBe(true);
  });

  it("без поля в ответе признака нет", () => {
    expect(mapApiUser(базовый).isSubscriber).toBe(false);
  });

  it("льгота «подписка не требуется» подписчиком не делает", () => {
    const u = mapApiUser({ ...базовый, subscription_exempt: true });
    expect(u.subscriptionExempt).toBe(true);
    expect(u.isSubscriber).toBe(false);
  });
});

describe("шапка профиля смотрит на признак, а не на мёртвое поле", () => {
  const разметка = readFileSync("src/components/profile/ProfileView.tsx", "utf8");

  it("условие значка — user.isSubscriber", () => {
    expect(разметка).toContain("{user.isSubscriber && (");
  });

  it("на user.subscription разметка больше не опирается", () => {
    expect(разметка).not.toContain("user.subscription &&");
  });
});
