import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAdminPromocodes } from "./admin";

/**
 * Список акций обходит все страницы, а не берёт первую.
 *
 * Клиент читал `data.data` одного ответа, и с двадцать первой акции
 * правка с удалением до неё не доставали — строка просто не
 * показывалась. Отбор и поиск в разделе идут по загруженному списку,
 * поэтому обойти страницы надо в запросе.
 */
let адреса: string[] = [];

function страница(коды: string[], last: number) {
  return JSON.stringify({
    data: {
      current_page: 1,
      last_page: last,
      total: коды.length,
      data: коды.map((code) => ({ code, value: 10, max_usages: 5, is_active: true })),
    },
  });
}

function подменить(страницы: string[]) {
  адреса = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      адреса.push(String(url));
      const номер = Number(new URL(String(url), "https://x").searchParams.get("page") ?? 1);

      return new Response(страницы[номер - 1] ?? страницы[страницы.length - 1], {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

beforeEach(() => {
  адреса = [];
});

describe("загрузка списка акций", () => {
  it("собирает все страницы, а не первую", async () => {
    подменить([страница(["A", "B"], 3), страница(["C", "D"], 3), страница(["E"], 3)]);

    const акции = await fetchAdminPromocodes();

    expect(акции.map((p) => p.code)).toEqual(["A", "B", "C", "D", "E"]);
    expect(адреса).toHaveLength(3);
  });

  it("на одной странице делает один запрос, а не лишний", async () => {
    подменить([страница(["A"], 1)]);

    await fetchAdminPromocodes();

    expect(адреса).toHaveLength(1);
  });

  it("просит размер страницы больше прежних двадцати", async () => {
    подменить([страница(["A"], 1)]);

    await fetchAdminPromocodes();

    expect(адреса[0]).toContain("per_page=50");
  });

  it("не уходит в бесконечный обход и говорит, что список усечён", async () => {
    /*
     * Сломанный или просто очень длинный ответ не должен ни вешать
     * раздел, не показывать усечённый список как полный: ровно это и
     * чинила правка, только на двадцати строках. Отказ уходит наверх, и
     * раздел покажет «не загрузилось» с «Повторить».
     */
    адреса = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        адреса.push(String(url));

        return new Response(страница(["X" + адреса.length], 10_000), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    await expect(fetchAdminPromocodes()).rejects.toThrow(/страниц/);
    // Ровно потолок, а не «не больше»: `СТРАНИЦ_МАКСИМУМ = 2` прошёл бы
    // прежнюю проверку так же. Найдено ревью 01.10.
    expect(адреса).toHaveLength(200);
  });

  it("усечения нет — отказа нет", async () => {
    подменить([страница(["A"], 1)]);

    await expect(fetchAdminPromocodes()).resolves.toHaveLength(1);
  });

  it("дубль, пришедший из-за сдвига страниц, в список не попадает", async () => {
    // Строка, вставленная между запросами, сдвигает страницы, и одна
    // акция приходит дважды. Код уникален в таблице — по нему и отличаем.
    подменить([страница(["A", "B"], 2), страница(["B", "C"], 2)]);

    const акции = await fetchAdminPromocodes();

    expect(акции.map((p) => p.code)).toEqual(["A", "B", "C"]);
  });

  it("без last_page в ответе берёт одну страницу и не падает", async () => {
    адреса = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        адреса.push(String(url));

        return new Response(JSON.stringify({ data: { data: [{ code: "A" }] } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    await expect(fetchAdminPromocodes()).resolves.toHaveLength(1);
    expect(адреса).toHaveLength(1);
  });
});
