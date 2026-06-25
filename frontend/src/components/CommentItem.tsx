// CommentItem lives inline inside CommentSection (feed/CommentSection.tsx).
// This shim exposes the section as the public API for the comment item subsystem.
export { CommentSection as CommentItem } from "./feed/CommentSection";
