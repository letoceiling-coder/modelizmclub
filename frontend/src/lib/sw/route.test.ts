import { describe, expect, it } from "vitest";
import { swRoute } from "@/lib/sw/route";

const ORIGIN = "https://modelizmclub.ru";
const route = (url: string, extra: { method?: string; mode?: string } = {}) =>
  swRoute({ method: extra.method ?? "GET", mode: extra.mode ?? "cors", url, selfOrigin: ORIGIN });

describe("маршрутизация в service worker", () => {
  it("картинка приходит режимом no-cors — главный случай ветки", () => {
    // Все картинки грузятся обычным `<img src>` на чужой origin без
    // `crossorigin`. Именно этот режим делает ответ opaque, и именно поэтому
    // кэшировать медиа нельзя — маршрут существует как отказ от стратегии.
    expect(route("https://api.modelizmclub.ru/api/v1/media/5c988e33", { mode: "no-cors" })).toBe(
      "media",
    );
  });

  it("вложение спора приходит режимом cors и тоже считается медиа", () => {
    // Идёт через openAuthorizedMedia с заголовком Authorization. Ответ
    // настоящий, 200 — и лечь в кэш он не должен тем более: доступ к нему
    // проверяет сервер, а Cache API сопоставляет только по адресу.
    expect(route("https://api.modelizmclub.ru/api/v1/media/d1sput3", { mode: "cors" })).toBe(
      "media",
    );
  });

  it("картинка по uuid — не данные, а файл", () => {
    // Ради этого случая всё и затевалось: до 21.09 адрес попадал под правило
    // для API, и залп из полусотни картинок половиной получал 503 при живом
    // сервере.
    expect(
      route("https://api.modelizmclub.ru/api/v1/media/5c988e33-5132-4e6c-9af0-2e6f3a6de278"),
    ).toBe("media");
  });

  it("производная картинки — тоже файл", () => {
    expect(route("https://api.modelizmclub.ru/api/v1/media/5c988e33/card.webp")).toBe("media");
  });

  it("всё прочее под /api/ остаётся данными", () => {
    expect(route("https://api.modelizmclub.ru/api/v1/conversations")).toBe("api");
    expect(route("https://api.modelizmclub.ru/api/v1/admin/media?per_page=48")).toBe("api");
  });

  it("список медиа в админке — данные, а не файл", () => {
    // `/api/v1/admin/media` начинается с `/api/`, но не с `/api/v1/media/`:
    // это один запрос списком, ему кэш вперёд не нужен.
    expect(route("https://api.modelizmclub.ru/api/v1/admin/media")).toBe("api");
  });

  it("навигация решается раньше всего", () => {
    expect(route(`${ORIGIN}/feed`, { mode: "navigate" })).toBe("page");
  });

  it("файлы сборки — из кэша", () => {
    expect(route(`${ORIGIN}/assets/styles-B-oCtWFo.css`)).toBe("asset");
    expect(route(`${ORIGIN}/pwa/icon-192.png`)).toBe("asset");
  });

  it("чужой origin вне API не наш", () => {
    expect(route("https://vtb.rbsuat.com/payment/merchants/ecom/payment.html")).toBe(null);
    expect(route("https://s3.ru-3.storage.selcloud.ru/knowledge-raw/media/x.png")).toBe(null);
  });

  it("не-GET не перехватываем", () => {
    expect(route("https://api.modelizmclub.ru/api/v1/conversations", { method: "POST" })).toBe(
      null,
    );
    // В том числе загрузку самих картинок.
    expect(route("https://api.modelizmclub.ru/api/v1/media", { method: "POST" })).toBe(null);
  });

  it("корень и обычные страницы без режима navigate не наше дело", () => {
    expect(route(`${ORIGIN}/`)).toBe(null);
  });
});
