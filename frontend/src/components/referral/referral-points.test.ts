import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { словоБаллы } from "@/lib/format/plural";

/**
 * Страница «Пригласи друга» пишет награду из настроек, а не из кода.
 *
 * До 28.09 там стояло «+1 бесплатное объявление за каждого друга»: число
 * зашито константой `REFERRAL_BONUS_PER_INVITE = 1`, и поменять награду
 * можно было только правкой кода и выкаткой. Теперь награда — баллы, число
 * приходит с сервера, и смена его в админке меняет текст сама.
 */
const СТРАНИЦА = join(import.meta.dirname, "..", "..", "routes", "referral.tsx");
const БЛОК = join(import.meta.dirname, "InviteBlock.tsx");
const КЛИЕНТ = join(import.meta.dirname, "..", "..", "lib", "api", "referral.ts");
const КАРТОЧКА = join(import.meta.dirname, "..", "admin", "ReferralProgramAdminCard.tsx");

const читать = (путь: string) => readFileSync(путь, "utf8");

describe("награда за приглашение — баллы", () => {
  it("про бесплатное объявление на странице больше не написано", () => {
    for (const путь of [СТРАНИЦА, БЛОК]) {
      const текст = читать(путь);
      expect(текст, `${путь}: остался текст про бесплатные объявления`).not.toMatch(
        /бесплатн\w* объявлен/i,
      );
    }
  });

  it("текст награды собирается из настроек", () => {
    for (const путь of [СТРАНИЦА, БЛОК]) {
      const текст = читать(путь);
      expect(текст, `${путь}: награда не из настроек`).toContain("pointsPerInvite");
      expect(текст, `${путь}: нет слова про баллы`).toMatch(/словоБаллы/);
    }
  });

  /**
   * Зашитого «настоящего» числа не осталось.
   *
   * Запасное значение на один кадр допустимо, но оно ровно одно и названо
   * запасным. Два источника одной величины однажды разойдутся.
   */
  it("старых констант награды нет", () => {
    const библиотека = читать(join(import.meta.dirname, "..", "..", "lib", "referral.ts"));

    expect(библиотека).not.toContain("REFERRAL_BONUS_PER_INVITE");
    expect(библиотека).not.toContain("REFERRAL_MAX_BONUS");
    expect(библиотека, "запасное значение должно называться запасным").toContain(
      "REFERRAL_POINTS_FALLBACK",
    );
  });

  it("статистика «Бонусов» показывает баллы, а не объявления", () => {
    const текст = читать(СТРАНИЦА);

    const блок = текст.slice(
      текст.indexOf('label="Бонусов"'),
      текст.indexOf('label="Бонусов"') + 300,
    );
    expect(блок).toContain('unit={loading ? undefined : "баллов"}');
    expect(блок).not.toContain("объявл.");
  });

  /** Клиент знает про баллы и про условия, а старые ключи не читает. */
  it("клиент читает новые поля", () => {
    const клиент = читать(КЛИЕНТ);

    for (const поле of ["points_per_invite", "points_balance", "terms"]) {
      expect(клиент, `клиент не читает ${поле}`).toContain(поле);
    }
    expect(клиент).not.toContain("max_bonus");
  });

  /** В админке есть все поля, которые просил заказчик. */
  it("в админке правятся включение, размер, предел и условия", () => {
    const карточка = читать(КАРТОЧКА);

    expect(карточка, "нет выключателя").toContain("setEnabled");
    expect(карточка, "нет размера бонуса").toContain("setPointsPerInvite");
    expect(карточка, "нет предела приглашений").toContain("setMaxPaidInvites");
    expect(карточка, "нет текста условий").toContain("setTerms");
    expect(карточка, "не показаны действующие настройки").toContain("Сейчас действует");
    expect(карточка, "остались поля прежней награды").not.toContain("rewardListing");
  });

  describe("склонение «баллов»", () => {
    it("считает по числу, а не по последней цифре вслепую", () => {
      expect(словоБаллы(1)).toBe("балл");
      expect(словоБаллы(2)).toBe("балла");
      expect(словоБаллы(5)).toBe("баллов");
      // 11–14 — исключение, иначе выходит «11 балл».
      expect(словоБаллы(11)).toBe("баллов");
      expect(словоБаллы(12)).toBe("баллов");
      expect(словоБаллы(14)).toBe("баллов");
      expect(словоБаллы(21)).toBe("балл");
      expect(словоБаллы(102)).toBe("балла");
      expect(словоБаллы(100)).toBe("баллов");
      expect(словоБаллы(0)).toBe("баллов");
    });
  });
});
