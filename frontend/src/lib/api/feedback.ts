import { api, getToken } from "./client";

export interface FeedbackInput {
  subject?: string;
  message: string;
  page?: string;
  guestEmail?: string;
}

export async function submitFeedback(input: FeedbackInput): Promise<{ id: number; status: string }> {
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
