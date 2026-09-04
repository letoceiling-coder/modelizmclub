import { describe, expect, it } from "vitest";
import type { Post } from "@/lib/mock";
import type { FeedResult } from "@/lib/api/feed";
import {
  bumpFeedComments,
  feedPostsOf,
  patchFeedPost,
  prependFeedPost,
  removeFeedPost,
  toggleFeedLike,
  toggleFeedSave,
  type FeedPages,
} from "./feed";

function post(id: string, extra: Partial<Post> = {}): Post {
  return {
    id,
    authorId: "u1",
    date: "2026-09-01T10:00:00Z",
    category: "Авиация",
    title: `Пост ${id}`,
    text: "",
    likes: 10,
    comments: 2,
    saves: 1,
    reposts: 0,
    isLiked: false,
    isSaved: false,
    ...extra,
  };
}

function page(posts: Post[], n = 1, lastPage = 2): FeedResult {
  return { posts, page: n, lastPage, total: 20 };
}

function pages(...list: FeedResult[]): FeedPages {
  return { pages: list, pageParams: list.map((p) => p.page) };
}

describe("feed cache updaters", () => {
  it("optimistic like bumps the flag and the counter of one post only", () => {
    const data = pages(page([post("a"), post("b")]), page([post("c")], 2));
    const next = toggleFeedLike(data, "b", true);
    const posts = feedPostsOf(next);

    expect(posts.find((p) => p.id === "b")).toMatchObject({ isLiked: true, likes: 11 });
    expect(posts.find((p) => p.id === "a")).toMatchObject({ isLiked: false, likes: 10 });
    expect(posts.find((p) => p.id === "c")).toMatchObject({ isLiked: false, likes: 10 });
  });

  it("rolls back to the exact previous flag and counter", () => {
    const data = pages(page([post("a"), post("b", { isLiked: true, likes: 7 })]));

    const liked = toggleFeedLike(data, "a", true);
    const rolledBack = toggleFeedLike(liked, "a", false);
    expect(feedPostsOf(rolledBack)).toEqual(feedPostsOf(data));

    const unliked = toggleFeedLike(data, "b", false);
    expect(feedPostsOf(unliked).find((p) => p.id === "b")).toMatchObject({
      isLiked: false,
      likes: 6,
    });
    const restored = toggleFeedLike(unliked, "b", true);
    expect(feedPostsOf(restored)).toEqual(feedPostsOf(data));
  });

  it("is idempotent, so a double click or a refetch never double-counts", () => {
    const data = pages(page([post("a")]));
    const once = toggleFeedLike(data, "a", true);
    const twice = toggleFeedLike(once, "a", true);
    expect(feedPostsOf(twice).find((p) => p.id === "a")).toMatchObject({
      isLiked: true,
      likes: 11,
    });
  });

  it("never drives a counter below zero", () => {
    const data = pages(
      page([post("a", { likes: 0, isLiked: true, saves: 0, isSaved: true, comments: 0 })]),
    );
    expect(feedPostsOf(toggleFeedLike(data, "a", false))[0].likes).toBe(0);
    expect(feedPostsOf(toggleFeedSave(data, "a", false))[0].saves).toBe(0);
    expect(feedPostsOf(bumpFeedComments(data, "a", -1))[0].comments).toBe(0);
  });

  it("leaves the cache untouched when the post is not there", () => {
    const data = pages(page([post("a")]));
    expect(toggleFeedLike(data, "zzz", true)).toEqual(data);
    expect(toggleFeedLike(undefined, "a", true)).toBeUndefined();
  });

  it("keeps page metadata while patching, removing and prepending", () => {
    const data = pages(page([post("a"), post("b")]), page([post("c")], 2));

    const patched = patchFeedPost(data, "c", { title: "Новый" });
    expect(patched?.pages[1]).toMatchObject({ page: 2, lastPage: 2, total: 20 });
    expect(feedPostsOf(patched).find((p) => p.id === "c")?.title).toBe("Новый");

    expect(feedPostsOf(removeFeedPost(data, "a")).map((p) => p.id)).toEqual(["b", "c"]);

    const prepended = prependFeedPost(data, post("new"));
    expect(feedPostsOf(prepended).map((p) => p.id)).toEqual(["new", "a", "b", "c"]);
    expect(prepended?.pageParams).toEqual([1, 2]);
  });

  it("prepending into an empty cache creates the first page", () => {
    const created = prependFeedPost(undefined, post("new"));
    expect(feedPostsOf(created).map((p) => p.id)).toEqual(["new"]);
    expect(created?.pageParams).toEqual([1]);
  });
});
