import { describe, expect, it } from "vitest";

import i18n, { loadLocale, setLocale } from "@/lib/i18n";

describe("lazy locales", () => {
  it("ships only the default locale synchronously", () => {
    expect(i18n.hasResourceBundle("ru", "translation")).toBe(true);
    expect(i18n.hasResourceBundle("en", "translation")).toBe(false);
    expect(i18n.t("common.save")).toBe("Сохранить");
  });

  it("loads a lazy locale on demand and keeps the t() API", async () => {
    await loadLocale("en");
    expect(i18n.hasResourceBundle("en", "translation")).toBe(true);

    setLocale("en");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(i18n.language).toBe("en");
    expect(i18n.t("common.save")).toBe("Save");

    setLocale("ru");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(i18n.t("common.save")).toBe("Сохранить");
  });
});
