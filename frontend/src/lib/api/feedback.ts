import { api, getToken } from "./client";

export interface FeedbackInput {
  subject?: string;
  message: string;
  page?: string;
  guestEmail?: string;
}

export async function submitFeedback(
  input: FeedbackInput,
): Promise<{ id: number; status: string }> {
  const res = await api<{ data: { id: number; status: string } }>("/feedback", {
    method: "POST",
    auth: Boolean(getToken()),
    json: {
      subject: input.subject || null,
      message: input.message,
      page: input.page || null,
      guest_email: input.guestEmail || null,
    },
  });
  return res.data;
}

/** Обращение пользователя вместе с ответом, если он уже есть. */
export interface MyFeedbackItem {
  id: number;
  subject: string;
  message: string;
  page: string;
  status: "new" | "read" | "resolved" | string;
  reply: string;
  repliedAt: string;
  createdAt: string;
}

interface ApiMyFeedback {
  id: number;
  subject?: string | null;
  message?: string | null;
  page?: string | null;
  status?: string | null;
  reply?: string | null;
  replied_at?: string | null;
  created_at?: string | null;
}

export async function fetchMyFeedback(): Promise<MyFeedbackItem[]> {
  const res = await api<{ data: ApiMyFeedback[] }>("/users/me/feedback");
  return (res.data ?? []).map((f) => ({
    id: f.id,
    subject: f.subject ?? "",
    message: f.message ?? "",
    page: f.page ?? "",
    status: f.status ?? "new",
    reply: f.reply ?? "",
    repliedAt: f.replied_at ?? "",
    createdAt: f.created_at ?? "",
  }));
}
