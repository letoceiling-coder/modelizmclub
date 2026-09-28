import { describe, it, expect } from "vitest";
import { SHARE_TARGETS, shareViaSystem } from "./share-targets";

const ССЫЛКА = "https://modelizmclub.ru/r/MDLZM-ABC123";
const ТЕКСТ = "Присоединяйся к МоДелизМ Клубу";

/** Что реально уедет в мессенджер: разбираем адрес, а не сравниваем строки. */
function параметры(href: string): URLSearchParams {
  return new URL(href).searchParams;
}

describe("способы отправки", () => {
  it("каждый веб-способ несёт и ссылку, и текст приглашения", () => {
    /*
     * Проверка заведена по следам разбора 28.09: на странице приглашений
     * WhatsApp получал `?text=<ссылка>` — только адрес. Увидеть это
     * можно было лишь открыв окно отправки, поэтому здесь проверяется не
     * «строится ли адрес», а «есть ли в нём оба куска».
     */
    for (const target of SHARE_TARGETS) {
      if (!target.href) continue;

      const href = target.href(ССЫЛКА, ТЕКСТ);
      const q = параметры(href);
      const всё = [...q.values()].join(" ");

      expect(всё, `${target.label}: нет ссылки`).toContain(ССЫЛКА);
      expect(всё, `${target.label}: нет текста приглашения`).toContain(ТЕКСТ);
    }
  });

  it("без текста способ всё равно передаёт ссылку", () => {
    for (const target of SHARE_TARGETS) {
      if (!target.href) continue;
      const всё = [...параметры(target.href(ССЫЛКА)).values()].join(" ");
      expect(всё, `${target.label}: нет ссылки`).toContain(ССЫЛКА);
    }
  });

  it("адреса ведут на сами мессенджеры", () => {
    const ожидаем: Record<string, string> = {
      telegram: "t.me",
      whatsapp: "wa.me",
      vk: "vk.com",
    };

    for (const target of SHARE_TARGETS) {
      if (!target.href) continue;
      expect(new URL(target.href(ССЫЛКА, ТЕКСТ)).hostname).toBe(ожидаем[target.id]);
    }
  });

  it("MAX есть в списке и идёт без веб-ссылки", () => {
    /*
     * Не придирка к типу, а защита от возврата к выдуманному адресу:
     * `max.ru/share?url=…` отвечает 404, а `web.max.ru/share` — экраном
     * входа на любой путь. Кнопка-ссылка увела бы людей туда вместо
     * отправки; MAX работает системным окном.
     */
    const max = SHARE_TARGETS.find((x) => x.id === "max");

    expect(max, "MAX пропал из списка способов").toBeDefined();
    expect(max?.href, "у MAX появился веб-адрес — проверьте, что он живой").toBeUndefined();
  });
});

describe("системное окно", () => {
  it("отмену не считает отказом", async () => {
    const было = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: {
        share: () => Promise.reject(new DOMException("отменено", "AbortError")),
        clipboard: { writeText: () => Promise.resolve() },
      },
      configurable: true,
    });

    // Именно «cancelled», а не «copied»: человек закрыл окно сам, и
    // класть ссылку в буфер вместо него — не то, о чём он просил.
    await expect(shareViaSystem(ССЫЛКА, ТЕКСТ)).resolves.toBe("cancelled");

    Object.defineProperty(globalThis, "navigator", { value: было, configurable: true });
  });

  it("без системного окна кладёт в буфер текст вместе со ссылкой", async () => {
    const было = globalThis.navigator;
    let положено = "";
    Object.defineProperty(globalThis, "navigator", {
      value: {
        clipboard: {
          writeText: (v: string) => {
            положено = v;
            return Promise.resolve();
          },
        },
      },
      configurable: true,
    });

    await expect(shareViaSystem(ССЫЛКА, ТЕКСТ)).resolves.toBe("copied");
    expect(положено).toContain(ССЫЛКА);
    expect(положено).toContain(ТЕКСТ);

    Object.defineProperty(globalThis, "navigator", { value: было, configurable: true });
  });
});
