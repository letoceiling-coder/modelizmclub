import { afterEach, describe, expect, it, vi } from "vitest";

import { SCROLL_TOP_EVENT, scrollSectionToTop, type ScrollTopDetail } from "./scroll-top";

interface WindowStub {
  scrollTo: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
  matchMedia?: (query: string) => { matches: boolean };
}

function stubWindow(reduceMotion: boolean | "unsupported" = false): WindowStub {
  const stub: WindowStub = {
    scrollTo: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  if (reduceMotion !== "unsupported") {
    stub.matchMedia = () => ({ matches: reduceMotion });
  }
  (globalThis as { window?: unknown }).window = stub;
  return stub;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("scrollSectionToTop", () => {
  it("прокручивает наверх плавно и сообщает разделу", () => {
    const win = stubWindow(false);

    scrollSectionToTop("feed");

    expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(win.dispatchEvent).toHaveBeenCalledTimes(1);
    const event = win.dispatchEvent.mock.calls[0][0] as CustomEvent<ScrollTopDetail>;
    expect(event.type).toBe(SCROLL_TOP_EVENT);
    expect(event.detail).toEqual({ section: "feed" });
  });

  it("не анимирует прокрутку при prefers-reduced-motion", () => {
    const win = stubWindow(true);

    scrollSectionToTop("ads");

    expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });

  it("работает там, где matchMedia недоступен", () => {
    const win = stubWindow("unsupported");

    expect(() => scrollSectionToTop("profile")).not.toThrow();
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("ничего не делает на сервере", () => {
    expect(() => scrollSectionToTop("feed")).not.toThrow();
  });
});
