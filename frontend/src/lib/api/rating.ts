import { api } from "./client";

/**
 * User rating/reviews client (backend Modules\User):
 *   GET /users/{id}/rating   → { average, count }
 *   GET /users/{id}/reviews  → { data: [{ id, author{id,display_name}, rating, text, date }] }
 * `id` is the NUMERIC user id (users.id), not the uuid — the frontend user
 * object carries it as `numericId` (mapped from /auth/me).
 */

export interface UserRatingAggregate {
  average: number;
  count: number;
}

export interface UserReviewApi {
  id: string;
  author: { id: number; display_name: string | null };
  rating: number;
  text: string | null;
  date: string;
}

export async function fetchUserRating(numericUserId: number): Promise<UserRatingAggregate> {
  return api<UserRatingAggregate>(`/users/${numericUserId}/rating`);
}

export async function fetchUserReviews(numericUserId: number): Promise<UserReviewApi[]> {
  const res = await api<{ data: UserReviewApi[] }>(`/users/${numericUserId}/reviews`);
  return res.data ?? [];
}
