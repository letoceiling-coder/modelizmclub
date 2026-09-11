import { describe, expect, it } from "vitest";

import type { Comment } from "@/lib/mock";

import { appendCommentPage, hasComment, mergePendingComments } from "./comment-thread";

const c = (id: string, replies: Comment[] = []): Comment =>
  ({
    id,
    authorId: "u",
    time: "2026-09-11T00:00:00Z",
    text: id,
    likes: 0,
    replies,
    images: [],
  }) as Comment;

const ids = (list: Comment[]) => list.map((x) => x.id);

describe("mergePendingComments", () => {
  it("keeps a comment sent while the first page was in flight", () => {
    const merged = mergePendingComments([c("a"), c("b")], [{ comment: c("new") }]);
    expect(ids(merged)).toEqual(["a", "b", "new"]);
  });

  it("does not duplicate what the server already returned", () => {
    const merged = mergePendingComments([c("a"), c("new")], [{ comment: c("new") }]);
    expect(ids(merged)).toEqual(["a", "new"]);
  });

  it("puts a pending reply back under its parent", () => {
    const merged = mergePendingComments([c("a"), c("b")], [{ parentId: "a", comment: c("r") }]);
    expect(ids(merged[0].replies ?? [])).toEqual(["r"]);
    expect(merged[1].replies).toEqual([]);
  });

  it("returns the server page untouched when nothing is pending", () => {
    const server = [c("a")];
    expect(mergePendingComments(server, [])).toBe(server);
  });
});

describe("appendCommentPage", () => {
  it("skips comments already on screen", () => {
    expect(ids(appendCommentPage([c("a"), c("new")], [c("new"), c("c")]))).toEqual([
      "a",
      "new",
      "c",
    ]);
  });
});

describe("hasComment", () => {
  it("finds replies as well as roots", () => {
    const list = [c("a", [c("r")])];
    expect(hasComment(list, "a")).toBe(true);
    expect(hasComment(list, "r")).toBe(true);
    expect(hasComment(list, "x")).toBe(false);
  });
});
