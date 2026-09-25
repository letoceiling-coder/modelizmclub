import { describe, it, expect } from "vitest";
import { hasSellerRating, formatSellerRating, reviewsNoun } from "./seller-rating";

describe("рейтинг продавца", () => {
  it("без отзывов не показывается", () => {
    // «0,0» рядом со звездой читается как плохая оценка, а не как
    // «оценок пока нет».
    expect(hasSellerRating(0, 0)).toBe(false);
    expect(hasSellerRating(4.9, 0)).toBe(false);
    expect(hasSellerRating(0, 12)).toBe(false);
    expect(hasSellerRating(undefined as unknown as number, undefined)).toBe(false);
  });

  it("с отзывами показывается", () => {
    expect(hasSellerRating(4.9, 47)).toBe(true);
    expect(hasSellerRating(1, 1)).toBe(true);
  });

  it("читается с запятой и одним знаком", () => {
    expect(formatSellerRating(4.9)).toBe("4,9");
    expect(formatSellerRating(5)).toBe("5,0");
    expect(formatSellerRating(4.94)).toBe("4,9");
    expect(formatSellerRating(4.999)).toBe("5,0");
    // Ровные половинки не проверяем: toFixed округляет их по тому, какое
    // двоичное число оказалось ближе, и 4.95 даёт «5,0», а 8.45 — «8,4».
    // Закреплять это значило бы закреплять случайность представления.
  });

  it("не выдаёт мусор на негодных числах", () => {
    // `rating` приходит из JSON и числом считается только на бумаге.
    expect(formatSellerRating(0)).toBe("0,0");
    expect(hasSellerRating(-1, 5)).toBe(false);
    expect(hasSellerRating(Number.NaN, 5)).toBe(false);
  });
});

describe("склонение отзывов", () => {
  it("единица", () => {
    expect(reviewsNoun(1)).toBe("отзыв");
    expect(reviewsNoun(21)).toBe("отзыв");
    expect(reviewsNoun(101)).toBe("отзыв");
  });

  it("два-четыре", () => {
    expect(reviewsNoun(2)).toBe("отзыва");
    expect(reviewsNoun(33)).toBe("отзыва");
  });

  it("подростковые — всегда «отзывов»", () => {
    for (const n of [11, 12, 13, 14, 111, 112]) {
      expect(reviewsNoun(n)).toBe("отзывов");
    }
  });

  it("остальное", () => {
    expect(reviewsNoun(0)).toBe("отзывов");
    expect(reviewsNoun(5)).toBe("отзывов");
    expect(reviewsNoun(47)).toBe("отзывов");
  });
});
