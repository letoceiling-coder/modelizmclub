import { describe, expect, it } from "vitest";
import type { Message } from "@/lib/mock";
import { findFirstUnreadMessageId } from "./unread";
import { rememberDialogScroll, recallDialogScroll, forgetDialogScroll } from "./scroll-memory";

const ME = "me-uuid";
const THEM = "them-uuid";

function msg(id: string, authorId: string): Message {
  return { id, authorId, time: "2026-09-03T10:00:00Z", text: id };
}

const thread: Message[] = [msg("m1", THEM), msg("m2", ME), msg("m3", THEM), msg("m4", THEM)];

describe("findFirstUnreadMessageId", () => {
  it("без курсора непрочитанных нет — чат открывается внизу", () => {
    expect(findFirstUnreadMessageId(thread, undefined, ME)).toBeNull();
  });

  it("берёт первое чужое сообщение после курсора", () => {
    expect(findFirstUnreadMessageId(thread, "m2", ME)).toBe("m3");
  });

  it("свои сообщения после курсора непрочитанными не считает", () => {
    expect(findFirstUnreadMessageId([msg("m1", THEM), msg("m2", ME)], "m1", ME)).toBeNull();
  });

  it("курсор на последнем сообщении — читать нечего", () => {
    expect(findFirstUnreadMessageId(thread, "m4", ME)).toBeNull();
  });

  it("курсор старше загруженного окна — непрочитано всё чужое", () => {
    expect(findFirstUnreadMessageId(thread, "m0-очень-старое", ME)).toBe("m1");
  });
});

describe("память позиции скролла", () => {
  it("возвращает сохранённую позицию по uuid диалога", () => {
    rememberDialogScroll("dlg-1", 320.7);
    expect(recallDialogScroll("dlg-1")).toBe(321);
    expect(recallDialogScroll("dlg-2")).toBeUndefined();
    forgetDialogScroll("dlg-1");
    expect(recallDialogScroll("dlg-1")).toBeUndefined();
  });

  it("отрицательный скролл не сохраняем", () => {
    rememberDialogScroll("dlg-3", -40);
    expect(recallDialogScroll("dlg-3")).toBe(0);
    forgetDialogScroll("dlg-3");
  });
});
