import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Загрузка видео при отказе хранилища (ДФ-3, 15.09).
 *
 * На проде у бакета нет CORS: PUT из браузера падает сетевой ошибкой, и видео
 * записи не загружалось вовсе. Теперь та же загрузка повторяется через сервер.
 */

const calls: string[] = [];

class FakeApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

vi.mock("./client", () => ({
  API_BASE_URL: "https://api.test/api/v1",
  ApiError: FakeApiError,
  getLocale: () => "ru",
  getToken: () => "token",
  api: vi.fn(async (path: string) => {
    calls.push(`api ${path}`);
    if (path === "/media/upload-session") {
      return {
        data: {
          session_uuid: "session-1",
          uploads: [{ media_uuid: "presigned-1", upload_url: "https://s3.test/put", headers: {} }],
        },
      };
    }
    if (path === "/media/fail") return {};
    if (path === "/media/confirm") {
      if (confirmFails) throw new FakeApiError(422, "confirm failed");
      return { data: [{ uuid: "presigned-1", url: null }] };
    }
    throw new Error(`unexpected ${path}`);
  }),
}));

vi.mock("@/lib/demo-mode", () => ({ isDemoMode: () => false }));

let putBehaviour: "network-error" | "ok" = "network-error";
let confirmFails = false;

class FakeXhr {
  status = 0;
  responseText = "";
  upload = { onprogress: null as null | ((e: unknown) => void) };
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  private method = "";
  private url = "";
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader() {}
  send() {
    calls.push(`xhr ${this.method} ${this.url}`);
    queueMicrotask(() => {
      if (this.method === "PUT") {
        if (putBehaviour === "network-error") return this.onerror?.();
        this.status = 200;
        return this.onload?.();
      }
      this.status = 201;
      this.responseText = JSON.stringify({
        data: { uuid: "direct-1", url: "https://api.test/m/direct-1" },
      });
      this.onload?.();
    });
  }
}

beforeEach(() => {
  calls.length = 0;
  putBehaviour = "network-error";
  confirmFails = false;
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const video = () => new File([new Uint8Array(1024)], "clip.mp4", { type: "video/mp4" });

describe("загрузка видео при отказе хранилища", () => {
  it("PUT в S3 упал сетевой ошибкой — видео уходит через сервер, сессия помечена failed", async () => {
    const { beginPresignedUpload } = await import("./media");
    const progress: number[] = [];
    const handle = await beginPresignedUpload(video(), "post_video", (p) => progress.push(p));
    const uploaded = await handle.done;

    expect(uploaded.uuid).toBe("direct-1");
    expect(calls).toContain("api /media/fail");
    expect(calls).toContain("xhr POST https://api.test/api/v1/media");
    expect(progress.at(-1)).toBe(100);
  });

  it("хранилище приняло файл — сервер не участвует", async () => {
    putBehaviour = "ok";
    const { beginPresignedUpload } = await import("./media");
    const handle = await beginPresignedUpload(video(), "review_video");
    const uploaded = await handle.done;

    expect(uploaded.uuid).toBe("presigned-1");
    expect(calls).not.toContain("xhr POST https://api.test/api/v1/media");
  });

  it("ошибку подтверждения не маскирует", async () => {
    putBehaviour = "ok";
    confirmFails = true;
    const { beginPresignedUpload } = await import("./media");
    const handle = await beginPresignedUpload(video(), "post_video");

    await expect(handle.done).rejects.toThrow("confirm failed");
    expect(calls).not.toContain("xhr POST https://api.test/api/v1/media");
  });
});
