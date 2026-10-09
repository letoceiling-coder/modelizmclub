import { describe, expect, it } from "vitest";

import { controlForServerVerdict } from "./levels";

describe("controlForServerVerdict", () => {
  it("shows the button whenever the server allows or says nothing", () => {
    for (const viewer of ["guest", "registered", "verified", "subscriber"] as const) {
      expect(controlForServerVerdict(viewer, true)).toBe("show");
      expect(controlForServerVerdict(viewer, undefined)).toBe("show");
    }
  });

  it("keeps the button for a guest — the click opens the login window", () => {
    expect(controlForServerVerdict("guest", false)).toBe("show");
  });

  /**
   * Вошедшему «нельзя» значит нельзя по существу — решение З2 от 09.10.
   *
   * Здесь проверялось «кнопка остаётся, клик попросит подтвердить номер».
   * Это было верно, пока реакции и комментарии требовали телефона. После З2
   * они его не требуют, и `can` их больше не занижает (см. `HasCanFlags`):
   * отказ сервера вошедшему означает закрытые комментарии, блокировку или
   * чужую запись. Окно подтверждения номера такой отказ не снимет, и
   * показывать его значило бы обещать выход там, где его нет.
   *
   * Ступень `registered` в лестницу больше не приходит (см. `levelOf`), и
   * проверяется это нарочно: смысл у неё теперь тот же, что у остальных
   * вошедших.
   */
  it("вошедшему кнопку прячет: отказ окончателен (решение З2)", () => {
    expect(controlForServerVerdict("registered", false)).toBe("hide");
    expect(controlForServerVerdict("verified", false)).toBe("hide");
    expect(controlForServerVerdict("subscriber", false)).toBe("hide");
  });
});
