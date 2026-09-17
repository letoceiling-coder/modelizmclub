import { describe, expect, it } from "vitest";
import type { User } from "@/lib/mock";
import { applyOwnProfilePatch } from "@/lib/api/social";

const user = {
  id: "u-1",
  name: "Тест",
  city: "Москва",
  cityId: 1,
  bio: "Старый текст о себе",
  avatar: "",
  interests: "",
} as unknown as User;

/*
 * Ответ PATCH /users/me — источник правды о сохранённом. Сервер превращает
 * пустую строку в null (ConvertEmptyStringsToNull), и `null ?? старое`
 * возвращало на экран то, что человек только что стёр. На проде 17.09:
 * «о себе» стёрто и сохранено, сервер ответил bio: null, вкладка до
 * перезагрузки показывала прежний текст.
 */
describe("applyOwnProfilePatch", () => {
  it("стёртое «о себе» пропадает сразу, а не после перезагрузки", () => {
    const next = applyOwnProfilePatch(user, {
      display_name: "Тест",
      bio: null,
      city_id: 1,
      city: { id: 1, name: "Москва" },
    });
    expect(next.bio).toBeUndefined();
  });

  it("убранный город пропадает сразу", () => {
    const next = applyOwnProfilePatch(user, {
      display_name: "Тест",
      bio: "Старый текст о себе",
      city_id: null,
      city: null,
    });
    expect(next.city).toBe("");
    expect(next.cityId).toBeUndefined();
  });

  it("поля, которых нет в ответе, остаются прежними", () => {
    const next = applyOwnProfilePatch(user, { avatar: { url: "https://x/y.jpg" } });
    expect(next.bio).toBe("Старый текст о себе");
    expect(next.city).toBe("Москва");
    expect(next.cityId).toBe(1);
  });
});
