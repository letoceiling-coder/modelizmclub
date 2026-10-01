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

  it("не уходит в бесконечный обход, если last_page всё растёт", async () => {
    // Сломанный ответ не должен вешать раздел: обход ограничен потолком.
    адреса = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        адреса.push(String(url));

        return new Response(страница(["X"], 10_000), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    await fetchAdminPromocodes();

    expect(адреса.length).toBeLessThanOrEqual(200);
    expect(адреса.length).toBeGreaterThan(1);
  });
});
