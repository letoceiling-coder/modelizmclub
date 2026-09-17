import { describe, expect, it } from "vitest";
import { sendCommentDraft } from "./comment-draft";

function field(initial: string) {
  let value = initial;
  return {
    get: () => value,
    set: (update: (current: string) => string) => {
      value = update(value);
    },
    type: (next: string) => {
      value = next;
    },
  };
}

describe("sendCommentDraft", () => {
  it("clears the field while sending and keeps it clear when the server accepts", async () => {
    const f = field("проба поля");
    let duringSend = "";
    const ok = await sendCommentDraft("проба поля", f.set, async () => {
      duringSend = f.get();
      return true;
    });
    expect(duringSend).toBe("");
    expect(ok).toBe(true);
    expect(f.get()).toBe("");
  });

  // Прод 17.09: 403 phone_not_verified стирал набранный комментарий.
  it("puts the text back when the server refuses", async () => {
    const f = field("проба поля");
    const ok = await sendCommentDraft("проба поля", f.set, async () => false);
    expect(ok).toBe(false);
    expect(f.get()).toBe("проба поля");
  });

  it("does not overwrite what the person started typing during the send", async () => {
    const f = field("первый");
    await sendCommentDraft("первый", f.set, async () => {
      f.type("второй");
      return false;
    });
    expect(f.get()).toBe("второй");
  });

  it("treats a page that does not report the outcome as sent", async () => {
    const f = field("текст");
    expect(await sendCommentDraft("текст", f.set, () => undefined)).toBe(true);
    expect(f.get()).toBe("");
  });
});
