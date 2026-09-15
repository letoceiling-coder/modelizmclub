import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { formatChatAttachmentError } from "@/lib/chat-attachments";

describe("formatChatAttachmentError", () => {
  it("молчит об отказе по подписке — его показывает окно подписки", () => {
    const err = new ApiError(403, "Оформите подписку, чтобы писать в чатах.", undefined, {
      code: "subscription_required",
    });
    expect(formatChatAttachmentError(err)).toBe("");
  });

  it("молчит о неподтверждённом телефоне", () => {
    const err = new ApiError(403, "Подтвердите телефон", undefined, { code: "phone_not_verified" });
    expect(formatChatAttachmentError(err)).toBe("");
  });

  it("показывает прочие отказы текстом сервера", () => {
    const err = new ApiError(403, "Это действие не авторизовано.", undefined, {});
    expect(formatChatAttachmentError(err)).toBe("Это действие не авторизовано.");
  });
});
